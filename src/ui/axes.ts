import { niceTicks, getPriceDecimals, calculateTimeStep } from '../utils/math.js';
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
    const ticks = niceTicks(
      Math.min(topPrice, bottomPrice),
      Math.max(topPrice, bottomPrice),
      10
    );

    // Get live price to avoid overlapping labels (only if price line is visible)
    const data = this.chart.dataManager.data;
    const showPriceLine = this.chart.options.priceScale.currentPrice?.show !== false;
    const currentPrice = showPriceLine && data.length > 0 ? data[data.length - 1].close : null;
    const currentPriceY = currentPrice !== null ? priceToY(currentPrice, this.chart.state) : LAYOUT.OFFSCREEN_PRICE_FALLBACK;

    // Draw price labels
    ctx.fillStyle = this.chart.options.layout.textColor;
    ctx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
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
      const label = this.chart.priceFormatter.formatPrice(price);
      ctx.fillText(label, w - LAYOUT.LABEL_OFFSET, y);
    });

    ctx.textAlign = 'left';
  }

  /**
   * Draw time axis with interval snapping
   * VIRTUAL & SNAPPED: Anchors to clean time boundaries (e.g. 13:00, 14:00)
   */
  public drawTimeAxis(ctx: CanvasRenderingContext2D): void {
    const { w, h, barWidth, data, axisWidth, bottomMargin } = this.chart.state;
    if (data.length === 0) return;

    // 1. Calculate time interval and step
    const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
    const step = calculateTimeStep(barWidth);
    const stepTime = step * interval;

    // 2. Reference point for "Time Space" vs "Index Space" mapping
    const refBar = data[data.length - 1];
    const refIdx = data.length - 1;
    const refTime = refBar.time;

    // 3. Find the 'Time' at the left edge of the screen (x=0)
    const leftIndex = xToIndex(0, this.chart.state);
    const leftTime = refTime + (leftIndex - refIdx) * interval;

    // 4. SNAP the leftTime to the nearest 'nice' boundary (Epoch-based)
    const startSnappedTime = Math.floor(leftTime / stepTime) * stepTime;

    // SIDEBAR: Must use dynamic axisWidth for visual boundary
    const chartWidth = w - axisWidth;

    // 5. Draw!
    const vertOptions = this.chart.options.grid.vertLines || {};
    ctx.fillStyle = this.chart.options.layout.textColor;
    ctx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Skip if time scale is hidden (this hides both labels and grid)
    if (!this.chart.options.timeScale.visible) return;

    // Check if we should draw vertical grid lines
    const drawVertLines = this.chart.options.grid.show && vertOptions.show !== false;

    // Apply grid line styles (always solid) - only if we're going to draw them
    if (drawVertLines) {
      ctx.strokeStyle = vertOptions.color ?? '#2a2a2a';
      ctx.lineWidth = vertOptions.width ?? 1;
      ctx.setLineDash([]);
    }

    // SAFETY: Prevent infinite loops if stepTime is 0 or NaN
    const safeStepTime = Math.max(1, stepTime || 1);
    let iterations = 0;
    const MAX_ITERATIONS = 1000;

    // Loop across the screen time-by-time
    for (let currentT = startSnappedTime; ; currentT += safeStepTime) {
      if (++iterations > MAX_ITERATIONS) break;
      // Calculate index for this nice time
      const virtualIdx = refIdx + (currentT - refTime) / interval;
      const x = indexToX(virtualIdx, this.chart.state);

      if (x > chartWidth) break;
      if (x < -100) continue; // Skip if far to the left

      // Draw vertical grid line through full height (including sub-pane)
      if (drawVertLines) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - bottomMargin);
        ctx.stroke();
      }

      // Draw time label (always, unless timeScale.hidden)
      if (x >= 0 && x <= chartWidth) {
        const label = this.formatTimeLabel(currentT, virtualIdx, step, interval);
        // Center label vertically in the time axis area
        const labelY = h - bottomMargin / 2;
        ctx.fillText(label, x, labelY);
      }
    }

    ctx.textAlign = 'left';
  }

  /**
   * Format time label with date rollover
   */
  private formatTimeLabel(time: number, index: number, step: number, interval: number): string {
    const ts = this.chart.options.timeScale;
    const tz = PriceFormatter.isValidTimezone(ts.timezone) ? ts.timezone : undefined;

    const prevTime = time - (step * interval);

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
