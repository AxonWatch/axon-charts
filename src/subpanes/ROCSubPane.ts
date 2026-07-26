import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { roc as computeRoc } from '../utils/indicators.js';

/**
 * ROC (Rate of Change) sub-pane.
 *
 * Renders the percentage price change vs N bars ago:
 *   ROC = (close[i] - close[i - period]) / close[i - period] * 100
 *
 * Momentum oscillator centered on zero — positive values indicate
 * price is above its historical level, negative below. The Y-axis
 * auto-scales symmetrically around zero.
 *
 * Options (chart.options.roc):
 *   show:          boolean  (default false)
 *   period:        number   (default 12)
 *   heightPercent: number   (default 0.15)
 *   color:         string   (default '#8b5cf6' violet)
 */
export class ROCSubPane extends ScalePane {
  readonly id = 'roc';
  readonly label = 'ROC';

  getOptions() { return this.chart.options.roc || {}; }

  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    return computeRoc(data, this.getOptions().period ?? 12);
  }

  renderContent(ctx: CanvasRenderingContext2D, chart: IChart, _subPaneTop: number, _subPaneHeight: number,
    firstVisibleIdx: number, endIdx: number, visibleMin: number, visibleRange: number, areaHeight: number, areaTop: number): void {
    const values = this.paneState.computedValues;
    if (!values) return;
    const opts = this.getOptions();
    const chartAreaWidth = chart.state.w - chart.state.axisWidth;

    // Zero reference line
    const zeroY = areaTop + (areaHeight * (1 - (0 - visibleMin) / visibleRange));
    ctx.strokeStyle = chart.options.layout.textColor ?? '#aaa';
    ctx.lineWidth = 1; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(chartAreaWidth, zeroY); ctx.stroke();
    ctx.globalAlpha = 1;

    // ROC line
    ctx.strokeStyle = opts.color ?? '#8b5cf6';
    ctx.lineWidth = 1.5; ctx.beginPath();
    let started = false;
    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const v = values[i]; if (v == null || isNaN(v)) continue;
      const x = indexToX(i, chart.state);
      const ratio = (v - visibleMin) / visibleRange;
      const y = areaTop + (areaHeight * (1 - ratio));
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  getLatestValue(chart: IChart): number | null {
    const values = this.paneState.computedValues;
    if (!values || values.length === 0) return null;
    const v = values[values.length - 1];
    return (v != null && !isNaN(v)) ? v : null;
  }

  getMaxVisible(chart: IChart): number {
    const values = this.paneState.computedValues;
    if (!values) return 1;
    const firstVisible = Math.max(0, Math.ceil((-chart.state.offsetX) / chart.state.barWidth));
    const barsVisible = Math.ceil((chart.state.w - chart.state.axisWidth) / chart.state.barWidth) + 2;
    const end = Math.min(firstVisible + barsVisible, values.length);
    let maxAbs = 0;
    for (let i = firstVisible; i < end; i++) {
      const v = values[i];
      if (v != null && !isNaN(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    return (maxAbs > 0 ? maxAbs : 1) / this.paneState.scale;
  }

  getMinVisible(chart: IChart): number { return -this.getMaxVisible(chart); }

  getTooltipColor(_bar: Bar): string { return this.getOptions().color ?? '#8b5cf6'; }
  getTooltipLabel(): string { return `ROC(${this.getOptions().period ?? 12}):`; }
  getTooltipValue(bar: Bar, barIndex?: number): number | null {
    const values = this.paneState.computedValues;
    if (!values) return null;
    const idx = barIndex ?? this.chart.state.data.indexOf(bar);
    if (idx < 0) return null;
    const v = values[idx];
    return (v != null && !isNaN(v)) ? v : null;
  }

  protected formatValue(value: number): string { return value.toFixed(2) + '%'; }
}
