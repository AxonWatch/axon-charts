import { niceTicks, calculateTimeStep } from '../utils/math.js';
import { LAYOUT } from '../core/layout.js';
import { PriceFormatter } from '../utils/formatter.js';
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

    // 1. Calculate base interval and step
    const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
    const step = calculateTimeStep(barWidth);
    const stepIndices = Math.max(1, step || 1);
    const chartWidth = w - axisWidth;

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

    // 5. Compute virtual time range for full-width time-anchored grid & labels
    //    Uses virtual time extending past/before data bounds so the grid covers the
    //    entire chart width, including empty zones before bar 0 and after the last bar.
    const stepMs = stepIndices * interval;
    const firstGridIdx = Math.ceil((-offsetX - 100) / barWidth);
    const lastGridIdx = Math.floor((chartWidth - offsetX + 100) / barWidth);
    const firstVirtualTime = data[0].time + (firstGridIdx * interval);
    const lastVirtualTime = data[0].time + (lastGridIdx * interval);

    // Round to nearest stepMs boundary (ceil so first line is at or after the left edge)
    const firstBoundary = Math.ceil(firstVirtualTime / stepMs) * stepMs;

    // 6. PASS 1: Vertical grid lines — time-anchored, full chart width
    //    Snaps to rounded time boundaries (e.g. 12:00, 12:15, 12:30) that shift
    //    naturally as the user pans — same behavior as the time axis labels.
    if (drawVertLines) {
      for (let t = firstBoundary; t <= lastVirtualTime; t += stepMs) {
        const virtualIndex = (t - data[0].time) / interval;
        const x = indexToX(virtualIndex, this.chart.state);
        if (x < -100 || x > chartWidth + 100) continue;
        if (x >= 0 && x <= chartWidth) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h - bottomMargin);
          ctx.stroke();
        }
      }
    }

    // 7. PASS 2: Time labels — at the same time-anchored positions as grid lines
    //    Labels stay aligned with grid lines because both use the same time boundaries.
    const labelY = h - bottomMargin / 2;
    const tz = PriceFormatter.isValidTimezone(this.chart.options.timeScale.timezone)
      ? this.chart.options.timeScale.timezone : undefined;
    let lastLabelX = -Infinity;
    const MIN_LABEL_SPACING = 40;

    // Track previous time for day-change detection across data gaps
    for (let t = firstBoundary; t <= lastVirtualTime; t += stepMs) {
      // Find the nearest bar for actual timestamp (for label formatting accuracy)
      // Inside data bounds: uses the bar's time. Past/future: uses virtual time.
      const index = Math.round((t - data[0].time) / interval);
      const bar = data[index];
      const labelTime = bar?.time ?? t;

      // Use t (the time boundary) for X position — guarantees alignment with grid lines
      const x = indexToX((t - data[0].time) / interval, this.chart.state);
      if (x < -100 || x > chartWidth + 100) continue;
      if (x >= 0 && x <= chartWidth && (x - lastLabelX >= MIN_LABEL_SPACING)) {
        const label = this.formatTimeLabel(labelTime, index, stepIndices, interval);
        ctx.fillText(label, x, labelY);
        lastLabelX = x;
      }
    }

    ctx.textAlign = 'left';
  }

  /**
   * Format time label with date rollover
   */
  private formatTimeLabel(time: number, index: number, step: number, interval: number): string {
    const ts = this.chart.options.timeScale;
    const data = this.chart.dataManager.data;
    const tz = PriceFormatter.isValidTimezone(ts.timezone) ? ts.timezone : undefined;

    // Use actual previous bar's timestamp for date-rollover detection.
    // For virtual indices past/future data bounds (from time-anchored grid),
    // data[index-1] is undefined, so ?. produces undefined, and the fallback
    // time - (step * interval) provides a reasonable virtual prevTime.
    const prevTime = index > 0 && index < data.length ? data[index - 1]?.time : time - (step * interval);

    // Check if we should show date (first bar or day change)
    const isNewDay = PriceFormatter.isDifferentDay(time, prevTime, tz);

    // If timeVisible is false, always show date
    if (!ts.timeVisible) {
      return PriceFormatter.formatDate(time, tz, ts.dateFormat, false);
    }

    if (isNewDay) {
      return PriceFormatter.formatDate(time, tz, ts.dateFormat, false);
    } else {
      const date = new Date(time);
      let formatter: Intl.DateTimeFormat;
      const baseOpts: Intl.DateTimeFormatOptions = { hour12: false, timeZone: tz };
      if (ts.secondsVisible) {
        formatter = new Intl.DateTimeFormat([], { ...baseOpts, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } else {
        formatter = new Intl.DateTimeFormat([], { ...baseOpts, hour: '2-digit', minute: '2-digit' });
      }
      return formatter.format(date);
    }
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