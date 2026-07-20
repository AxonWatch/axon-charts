import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { macd as computeMacd } from '../utils/indicators.js';

/**
 * MACD (Moving Average Convergence Divergence) sub-pane.
 *
 * Renders three components in a separate sub-pane below the main chart:
 *   - MACD line (fast EMA - slow EMA) — blue by default
 *   - Signal line (EMA of MACD) — amber by default
 *   - Histogram (MACD - Signal) — green for positive bars, red for negative
 *
 * A zero reference line is drawn through the sub-pane since the
 * histogram can be positive or negative. The Y-axis auto-scales to
 * the visible range of MACD/signal/histogram values.
 *
 * Options (chart.options.macd):
 *   show:           boolean  (default false)
 *   fastPeriod:     number   (default 12)
 *   slowPeriod:     number   (default 26)
 *   signalPeriod:   number   (default 9)
 *   heightPercent:  number   (default 0.15)
 *   macdColor:      string   (default '#3b82f6')
 *   signalColor:    string   (default '#f59e0b')
 *   histogramUpColor:   string  (default '#10B981')
 *   histogramDownColor: string  (default '#E11D48')
 */
export class MACDSubPane extends ScalePane {
  readonly id = 'macd';
  readonly label = 'MACD';

  /** Cached MACD components (set in computeValues, read by everything else). */
  private macdValues: { macd: number[]; signal: number[]; histogram: number[] } | null = null;

  constructor(chart: IChart) {
    super(chart);
  }

  getOptions() {
    return this.chart.options.macd || {};
  }

  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    const opts = this.getOptions();
    const result = computeMacd(
      data,
      opts.fastPeriod ?? 12,
      opts.slowPeriod ?? 26,
      opts.signalPeriod ?? 9
    );
    this.macdValues = result;
    // Return the MACD line as the 'computedValues' (used by getLatestValue
    // and getTooltipValue); the render method reads the full struct directly.
    return result.macd;
  }

  renderContent(
    ctx: CanvasRenderingContext2D,
    chart: IChart,
    subPaneTop: number,
    subPaneHeight: number,
    firstVisibleIdx: number,
    endIdx: number,
    visibleMin: number,
    visibleRange: number,
    areaHeight: number,
    areaTop: number
  ): void {
    if (!this.macdValues) return;
    const { macd, signal, histogram } = this.macdValues;
    const opts = this.getOptions();
    const chartAreaWidth = chart.state.w - chart.state.axisWidth;
    const zeroY = areaTop + (areaHeight * (1 - (0 - visibleMin) / visibleRange));

    // Draw zero reference line
    ctx.strokeStyle = chart.options.layout.textColor ?? '#aaa';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(chartAreaWidth, zeroY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw histogram bars (behind the lines)
    const barWidth = chart.state.barWidth;
    const candleW = Math.max(1, Math.floor(barWidth * 0.8));
    const upColor = opts.histogramUpColor ?? '#10B981';
    const downColor = opts.histogramDownColor ?? '#E11D48';
    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const h = histogram[i];
      if (h == null || isNaN(h)) continue;
      const x = indexToX(i, chart.state);
      const ratio = (h - visibleMin) / visibleRange;
      const y = areaTop + (areaHeight * (1 - ratio));
      const top = Math.min(y, zeroY);
      const height = Math.abs(y - zeroY);
      ctx.fillStyle = h >= 0 ? upColor : downColor;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x - candleW / 2, top, candleW, Math.max(1, height));
    }
    ctx.globalAlpha = 1;

    // Draw MACD line
    ctx.strokeStyle = opts.macdColor ?? '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const v = macd[i];
      if (v == null || isNaN(v)) continue;
      const x = indexToX(i, chart.state);
      const ratio = (v - visibleMin) / visibleRange;
      const y = areaTop + (areaHeight * (1 - ratio));
      if (!started) { ctx.moveTo(x, y); started = true; }
      else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    // Draw Signal line
    ctx.strokeStyle = opts.signalColor ?? '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    started = false;
    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const v = signal[i];
      if (v == null || isNaN(v)) continue;
      const x = indexToX(i, chart.state);
      const ratio = (v - visibleMin) / visibleRange;
      const y = areaTop + (areaHeight * (1 - ratio));
      if (!started) { ctx.moveTo(x, y); started = true; }
      else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
  }

  getLatestValue(chart: IChart): number | null {
    const values = this.paneState.computedValues;
    if (!values || values.length === 0) return null;
    const v = values[values.length - 1];
    return (v != null && !isNaN(v)) ? v : null;
  }

  /**
   * Auto-scale the Y-axis to the visible range of MACD/signal/histogram.
   * Returns the max absolute value across all three components so the
   * axis is symmetric around zero.
   */
  private getVisibleAbsMax(chart: IChart): number {
    if (!this.macdValues) return 1;
    const { macd, signal, histogram } = this.macdValues;
    const firstVisible = Math.max(0, Math.ceil((-chart.state.offsetX) / chart.state.barWidth));
    const barsVisible = Math.ceil((chart.state.w - chart.state.axisWidth) / chart.state.barWidth) + 2;
    const end = Math.min(firstVisible + barsVisible, macd.length);
    let maxAbs = 0;
    for (let i = firstVisible; i < end; i++) {
      for (const arr of [macd, signal, histogram]) {
        const v = arr[i];
        if (v != null && !isNaN(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
      }
    }
    return maxAbs > 0 ? maxAbs : 1;
  }

  getMaxVisible(chart: IChart): number {
    return this.getVisibleAbsMax(chart) / this.paneState.scale;
  }

  getMinVisible(chart: IChart): number {
    return -this.getMaxVisible(chart);
  }

  getTooltipColor(bar: Bar): string {
    return this.getOptions().macdColor ?? '#3b82f6';
  }

  getTooltipLabel(): string {
    const opts = this.getOptions();
    return `MACD(${opts.fastPeriod ?? 12},${opts.slowPeriod ?? 26},${opts.signalPeriod ?? 9}):`;
  }

  getTooltipValue(bar: Bar): number | null {
    const values = this.paneState.computedValues;
    if (!values) return null;
    const idx = this.chart.state.data.indexOf(bar);
    if (idx < 0) return null;
    const v = values[idx];
    return (v != null && !isNaN(v)) ? v : null;
  }

  protected formatValue(value: number): string {
    return value.toFixed(3);
  }
}