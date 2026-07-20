import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { stochastic as computeStochastic } from '../utils/indicators.js';

/**
 * Stochastic Oscillator sub-pane.
 *
 * Renders two lines in a separate sub-pane below the main chart:
 *   - %K line (fast or slow, depending on smoothK) — blue by default
 *   - %D line (SMA of %K) — amber by default
 *
 * The sub-pane's Y-axis is fixed to [0, 100] (like RSI). Overbought
 * (80) and oversold (20) reference lines are drawn by default.
 *
 * Options (chart.options.stochastic):
 *   show:          boolean  (default false)
 *   kPeriod:       number   (default 14)
 *   dPeriod:       number   (default 3)
 *   smoothK:       number   (default 3 — slow stochastic; 1 for fast)
 *   heightPercent: number   (default 0.15)
 *   kColor:        string   (default '#3b82f6')
 *   dColor:        string   (default '#f59e0b')
 *   overbought:    number   (default 80)
 *   oversold:      number   (default 20)
 *   showLevels:    boolean  (default true)
 */
export class StochasticSubPane extends ScalePane {
  readonly id = 'stochastic';
  readonly label = 'Stochastic';

  /** Cached %K and %D values. */
  private kValues: number[] | null = null;
  private dValues: number[] | null = null;

  constructor(chart: IChart) {
    super(chart);
  }

  getOptions() {
    return this.chart.options.stochastic || {};
  }

  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    const opts = this.getOptions();
    const result = computeStochastic(
      data,
      opts.kPeriod ?? 14,
      opts.dPeriod ?? 3,
      opts.smoothK ?? 3
    );
    this.kValues = result.k;
    this.dValues = result.d;
    return result.k;
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
    if (!this.kValues || !this.dValues) return;
    const opts = this.getOptions();
    const overbought = opts.overbought ?? 80;
    const oversold = opts.oversold ?? 20;
    const showLevels = opts.showLevels !== false;
    const chartAreaWidth = chart.state.w - chart.state.axisWidth;

    // Overbought / oversold reference lines
    if (showLevels) {
      ctx.strokeStyle = chart.options.layout.textColor ?? '#aaa';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.globalAlpha = 0.5;
      for (const level of [overbought, oversold]) {
        const ratio = (level - visibleMin) / visibleRange;
        const y = areaTop + (areaHeight * (1 - ratio));
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartAreaWidth, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    // %K line
    this.drawLine(ctx, chart, this.kValues, firstVisibleIdx, endIdx, visibleMin, visibleRange, areaHeight, areaTop, opts.kColor ?? '#3b82f6');
    // %D line
    this.drawLine(ctx, chart, this.dValues, firstVisibleIdx, endIdx, visibleMin, visibleRange, areaHeight, areaTop, opts.dColor ?? '#f59e0b');
  }

  private drawLine(
    ctx: CanvasRenderingContext2D,
    chart: IChart,
    values: number[],
    firstVisibleIdx: number,
    endIdx: number,
    visibleMin: number,
    visibleRange: number,
    areaHeight: number,
    areaTop: number,
    color: string
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const v = values[i];
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

  getMaxVisible(chart: IChart): number { return 100; }
  getMinVisible(chart: IChart): number { return 0; }

  getTooltipColor(bar: Bar): string {
    return this.getOptions().kColor ?? '#3b82f6';
  }

  getTooltipLabel(): string {
    const opts = this.getOptions();
    return `Stoch(${opts.kPeriod ?? 14},${opts.dPeriod ?? 3},${opts.smoothK ?? 3}):`;
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
    return value.toFixed(1);
  }
}