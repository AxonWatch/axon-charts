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
    let ticks = niceTicks(
      Math.min(topPrice, bottomPrice),
      Math.max(topPrice, bottomPrice),
      10
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

      // Collision detection with live price label
      if (Math.abs(y - currentPriceY) < LAYOUT.COLLISION_THRESHOLD) return;

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

    // Calculate visible bar range early so both passes can use it
    const firstVisibleIdx = Math.max(0, Math.ceil((-offsetX - 50) / barWidth));
    const lastVisibleIdx = Math.min(data.length - 1, Math.floor((chartWidth - offsetX + 50) / barWidth));

    // 5. PASS 1: Vertical grid lines — only at actual bar positions (no virtual time)
    //    Uses the same indices as PASS 2 labels to stay consistent
    if (drawVertLines) {
      for (let i = firstVisibleIdx; i <= lastVisibleIdx; i += stepIndices) {
        const bar = data[i];
        if (!bar) continue;
        const x = indexToX(i, this.chart.state);
        if (x < -100 || x > chartWidth + 100) continue;
        if (x >= 0 && x <= chartWidth) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h - bottomMargin);
          ctx.stroke();
        }
      }
    }

    // 6. PASS 2: Time labels — bar-index-based using actual bar timestamps
    //    Labels at stepIndices intervals, plus forced labels at day boundaries
    //    Day-boundary labels ensure weekend transitions are clearly visible
    const labelY = h - bottomMargin / 2;
    const tz = PriceFormatter.isValidTimezone(this.chart.options.timeScale.timezone)
      ? this.chart.options.timeScale.timezone : undefined;
    let lastLabelX = -Infinity;
    const MIN_LABEL_SPACING = 40; // Minimum pixels between labels to prevent overlap

    // Pre-compute day boundaries in a single O(n) pass (avoids O(n²) inner scanning)
    const dayBoundaryIndices: number[] = [];
    for (let i = firstVisibleIdx + 1; i <= lastVisibleIdx; i++) {
      const prevBar = data[i - 1];
      const curBar = data[i];
      if (prevBar && curBar && PriceFormatter.isDifferentDay(curBar.time, prevBar.time, tz)) {
        dayBoundaryIndices.push(i);
      }
    }

    for (let i = firstVisibleIdx; i <= lastVisibleIdx; i += stepIndices) {
      const bar = data[i];
      if (!bar) continue;

      // Binary search: find first day boundary within [i, i + stepIndices)
      let drawIdx = i;
      const upperBound = i + stepIndices;
      let left = 0;
      let right = dayBoundaryIndices.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const bIdx = dayBoundaryIndices[mid];
        if (bIdx >= i && bIdx < upperBound) {
          drawIdx = bIdx;
          break;
        } else if (bIdx < i) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      const drawBar = data[drawIdx];
      if (!drawBar) continue;

      const x = indexToX(drawIdx, this.chart.state);
      if (x < -100 || x > chartWidth + 100) continue;
      if (x >= 0 && x <= chartWidth && (x - lastLabelX >= MIN_LABEL_SPACING)) {
        const label = this.formatTimeLabel(drawBar.time, drawIdx, stepIndices, interval);
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

    // Use actual previous bar's timestamp for date-rollover detection
    const prevTime = index > 0 ? data[index - 1]?.time : time - (step * interval);

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

    const ticks = niceTicks(
      Math.min(topPrice, bottomPrice),
      Math.max(topPrice, bottomPrice),
      10
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
