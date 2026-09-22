import { niceTicks } from '../utils/math.js';
import { LAYOUT } from '../core/layout.js';
import { PriceFormatter } from '../utils/formatter.js';
import { chooseCalendarStep, calendarBoundaries, robustBarInterval } from '../utils/calticks.js';
import { priceToY, yToPrice, deriveVisibleStartIdx, indexToX, xToIndex } from '../utils/projection.js';
import { IChart } from '../types/index.js';

/**
 * Handles price and time axis rendering
 */
export class Axes {
  private chart: IChart;

  constructor(chart: IChart) {
    this.chart = chart;
  }

  /**
   * Draw price axis with nice-tick algorithm
   * VIRTUAL: Derives prices from the current viewport boundaries
   */
  public drawPriceAxis(ctx: CanvasRenderingContext2D): void {
    const { w, h, axisWidth, bottomMargin, chartBottom } = this.chart.state;

    // 1. Calculate the price at the top and bottom of the visible chart area
    const clipBottom = chartBottom || (h - bottomMargin);
    const topPrice = yToPrice(0, this.chart.state);
    const bottomPrice = yToPrice(clipBottom, this.chart.state);

    // 2. Feed THESE dynamic prices into the niceTicks algorithm
    // Dynamic tick count based on font size to prevent vertical overlap
    const fontSize = this.chart.options.layout.fontSize ?? 12;
    const chartHeight = this.chart.state.chartBottom || (h - bottomMargin);
    const maxTicks = Math.max(5, Math.min(10, Math.round(chartHeight / (fontSize * 3))));
    let ticks = niceTicks(
      Math.min(topPrice, bottomPrice),
      Math.max(topPrice, bottomPrice),
      maxTicks
    );

    // === ALWAYS SHOW 0% LABEL IN PERCENTAGE MODE ===
    // Inject the reference price if not already in the tick array
    if (this.chart.state.priceScaleMode === 'percentage' &&
        this.chart.state.referencePrice > 0) {
      const refPrice = this.chart.state.referencePrice;
      // Check with floating-point tolerance if already present
      const refIncluded = ticks.some(tick => Math.abs(tick - refPrice) < 0.01);
      if (!refIncluded) {
        const refY = priceToY(refPrice, this.chart.state);
        const clipBottom = this.chart.state.chartBottom || (this.chart.state.h - this.chart.state.bottomMargin);
        // Only inject if reference is within or slightly outside visible range
        if (refY >= -50 && refY <= clipBottom + 50) {
          ticks.push(refPrice);
          ticks.sort((a, b) => a - b);
        }
      }
    }

    // Get live price to avoid overlapping labels (only if price line is visible)
    const data = this.chart.dataManager.data;
    const showPriceLine = this.chart.options.priceScale.currentPrice?.show !== false;
    const currentPrice = showPriceLine && data.length > 0 ? data[data.length - 1].close : null;
    const currentPriceY = currentPrice !== null ? priceToY(currentPrice, this.chart.state) : LAYOUT.OFFSCREEN_PRICE_FALLBACK;

    // Draw price labels
    ctx.fillStyle = this.chart.options.layout.textColor ?? '#888';
    ctx.font = `${this.chart.options.layout.fontSize ?? 12}px ${this.chart.options.layout.fontFamily ?? 'system-ui'}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    ticks.forEach(price => {
      const y = priceToY(price, this.chart.state);

      // Only draw if within visible chart area
      const clipBottom = this.chart.state.chartBottom || (h - bottomMargin);
      if (y < 0 || y > clipBottom) return;


      // Use Professional Formatter
      let label = this.chart.priceFormatter.formatPrice(price);
      // In percentage mode, display as +/-% deviation from reference price
      if (this.chart.state.priceScaleMode === 'percentage') {
        const ref = this.chart.state.referencePrice;
        if (ref > 0) {
          const pct = ((price - ref) / ref) * 100;
          label = PriceFormatter.formatPercentage(pct);
        } else {
          label = PriceFormatter.formatPercentage(price);
        }
      }
      ctx.fillText(label, w - LAYOUT.LABEL_OFFSET, y);
    });

    ctx.textAlign = 'left';
  }

  /**
   * Draw time axis with interval snapping
   * VIRTUAL & SNAPPED: Anchors to clean time boundaries (e.g. 13:00, 14:00)
   */
  public drawTimeAxis(ctx: CanvasRenderingContext2D): void {
    const { w, h, barWidth, data, offsetX, axisWidth, bottomMargin } = this.chart.state;
    if (data.length === 0) return;

    const chartWidth = w - axisWidth;

    // Robust cadence: median of successive deltas over a small sample, so a
    // data gap between the first two bars cannot poison the whole grid.
    const interval = robustBarInterval(data, LAYOUT.DEFAULT_TIME_INTERVAL);
    const isDailyPlus = interval >= 86400000;

    // 4. Styles
    const vertOptions = this.chart.options.grid.vertLines || {};
    ctx.fillStyle = this.chart.options.layout.textColor ?? '#888';
    ctx.font = `${this.chart.options.layout.fontSize ?? 12}px ${this.chart.options.layout.fontFamily ?? 'system-ui'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (!this.chart.options.timeScale.visible) return;

    const drawVertLines = this.chart.options.grid.show && vertOptions.show !== false;
    if (drawVertLines) {
      ctx.strokeStyle = vertOptions.color ?? '#2a2a2a';
      ctx.lineWidth = vertOptions.width ?? 1;
      ctx.setLineDash([]);
    }

    // 5. Virtual time range for full-width coverage (incl. empty zones)
    const firstGridIdx = Math.ceil((-offsetX - 100) / barWidth);
    const lastGridIdx = Math.floor((chartWidth - offsetX + 100) / barWidth);
    const firstVirtualTime = data[0].time + (firstGridIdx * interval);
    const lastVirtualTime = data[0].time + (lastGridIdx * interval);

    // 6. Calendar-anchored step: boundaries land on local midnight (intraday)
    //    or local month starts (daily/weekly/monthly cadence).
    const tz = PriceFormatter.isValidTimezone(this.chart.options.timeScale.timezone)
      ? this.chart.options.timeScale.timezone : undefined;
    const step = chooseCalendarStep(interval, barWidth, LAYOUT.TIME_LABEL_TARGET_PIXELS);

    const labelY = h - bottomMargin / 2;
    const MIN_LABEL_SPACING = 40;
    let lastLabelX = -Infinity;
    let lastLabelRight = -Infinity;

    // 7. Single walk over calendar boundaries: grid lines at every boundary,
    //    labels at boundaries that survive spacing/overlap suppression.
    let prevBoundaryTime: number | null = null;
    for (const t of calendarBoundaries(firstVirtualTime, lastVirtualTime, step, tz)) {
      const x = indexToX((t - data[0].time) / interval, this.chart.state);
      if (x < -100 || x > chartWidth + 100) { prevBoundaryTime = t; continue; }
      if (x >= 0 && x <= chartWidth) {
        if (drawVertLines) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h - bottomMargin);
          ctx.stroke();
        }
        if (x - lastLabelX >= MIN_LABEL_SPACING) {
          const label = this.formatBoundaryLabel(t, prevBoundaryTime, interval, isDailyPlus);
          const halfW = ctx.measureText(label).width / 2;
          if (x - halfW > lastLabelRight + 2) {
            ctx.fillText(label, x, labelY);
            lastLabelX = x;
            lastLabelRight = x + halfW;
          }
        }
      }
      prevBoundaryTime = t;
    }

    ctx.textAlign = 'left';
  }

  /**
   * Format a boundary label.
   *
   * Intraday cadence (< 1 day bars): time label normally; full date when this
   * boundary is the first drawn on a new calendar day (local midnight with
   * calendar-divisor steps — 00:00 always shows the date).
   *
   * Daily/weekly/monthly cadence (>= 1 day): month name at the first boundary
   * of each month, year at the year change, day number otherwise.
   */
  private formatBoundaryLabel(t: number, prevBoundary: number | null, interval: number, isDailyPlus: boolean): string {
    const ts = this.chart.options.timeScale;
    const tz = PriceFormatter.isValidTimezone(ts.timezone) ? ts.timezone : undefined;

    // timeVisible = false → the axis shows only dates (existing behavior)
    if (!ts.timeVisible) {
      return PriceFormatter.formatDate(t, tz, ts.dateFormat, false);
    }

    if (isDailyPlus) {
      const monthChanged = prevBoundary == null || PriceFormatter.getZonedMonthKey(t, tz) !== PriceFormatter.getZonedMonthKey(prevBoundary, tz);
      if (monthChanged) {
        const yearChanged = prevBoundary != null && PriceFormatter.getZonedYear(t, tz) !== PriceFormatter.getZonedYear(prevBoundary, tz);
        if (yearChanged) {
          return PriceFormatter.getZonedYear(t, tz);
        }
        return PriceFormatter.formatMonthShort(t, tz);
      }
      return PriceFormatter.formatDayNumber(t, tz);
    }

    const dayChanged = prevBoundary == null || PriceFormatter.isDifferentDay(t, prevBoundary, tz);
    if (dayChanged) {
      return PriceFormatter.formatDate(t, tz, ts.dateFormat, false);
    }
    const p = PriceFormatter.getWallParts(t, tz);
    return ts.secondsVisible
      ? `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}:${String(p.second).padStart(2, '0')}`
      : `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  }

  /**
   * Draw grid lines
   */
  public drawGrid(ctx: CanvasRenderingContext2D): void {
    if (!this.chart.options.grid.show) return;

    const { w, h, axisWidth, bottomMargin, chartBottom } = this.chart.state;

    const horzOptions = this.chart.options.grid.horzLines || {};

    // Skip if per-axis toggle is off
    if (horzOptions.show === false) return;

    // Apply grid line styles (always solid)
    ctx.strokeStyle = horzOptions.color ?? '#2a2a2a';
    ctx.lineWidth = horzOptions.width ?? 1;
    ctx.setLineDash([]);

    // 1. Calculate horizontal grid lines using the SAME virtual logic as the axis labels
    const topPrice = yToPrice(0, this.chart.state);
    const bottomPrice = yToPrice(h - bottomMargin, this.chart.state);

    // Match tick count from drawPriceAxis for alignment
    const fontSize = this.chart.options.layout.fontSize ?? 12;
    const chartHeight = this.chart.state.chartBottom || (h - bottomMargin);
    const maxTicks = Math.max(5, Math.min(10, Math.round(chartHeight / (fontSize * 3))));
    const ticks = niceTicks(
      Math.min(topPrice, bottomPrice),
      Math.max(topPrice, bottomPrice),
      maxTicks
    );

    const clipBottom = this.chart.state.chartBottom || (h - bottomMargin);
    ticks.forEach(price => {
      const y = priceToY(price, this.chart.state);

      if (y < 0 || y > clipBottom) return;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w - axisWidth, y);
      ctx.stroke();
    });
  }
}