import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { rsi as computeRsi } from '../utils/indicators.js';

/**
 * RSI (Relative Strength Index) sub-pane.
 *
 * Renders the RSI oscillator as a line in a separate sub-pane below
 * the main chart. RSI ranges from 0 to 100; the sub-pane's Y-axis
 * is fixed to [0, 100] regardless of the visible RSI values, so the
 * overbought/oversold levels (70/30 by default) stay at constant
 * positions on the screen.
 *
 * Overbought (70) and oversold (30) reference lines are drawn as
 * dashed horizontal lines across the sub-pane, color-coded with the
 * chart's text color.
 *
 * Options (chart.options.rsi):
 *   show:         boolean  (default false)
 *   period:       number   (default 14)
 *   heightPercent: number  (default 0.15)
 *   color:        string   (default '#a855f7')
 *   overbought:   number   (default 70)
 *   oversold:     number   (default 30)
 *   showLevels:   boolean  (default true)
 */
export class RSISubPane extends ScalePane {
  readonly id = 'rsi';
  readonly label = 'RSI';

  constructor(chart: IChart) {
    super(chart);
  }

  getOptions() {
    return this.chart.options.rsi || {};
  }

  /**
   * Compute RSI values for all bars, cached in paneState.computedValues.
   * The RSI function needs the full bar history (not just visible)
   * because of the Wilder smoothing lookback.
   */
  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    const period = this.getOptions().period ?? 14;
    return computeRsi(data, period);
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
    const values = this.paneState.computedValues;
    if (!values) return;

    const options = this.getOptions();
    const lineColor = options.color ?? '#a855f7';
    const overbought = options.overbought ?? 70;
    const oversold = options.oversold ?? 30;
    const showLevels = options.showLevels !== false;

    // Draw overbought / oversold reference lines
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
        ctx.lineTo(chart.state.w - chart.state.axisWidth, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    // Draw the RSI line
    ctx.strokeStyle = lineColor;
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

  /** RSI is bounded 0-100 — fix the Y-axis to that range. */
  getMaxVisible(chart: IChart): number {
    return 100;
  }

  getMinVisible(chart: IChart): number {
    return 0;
  }

  getTooltipColor(bar: Bar): string {
    return this.getOptions().color ?? '#a855f7';
  }

  getTooltipLabel(): string {
    const period = this.getOptions().period ?? 14;
    return `RSI(${period}):`;
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