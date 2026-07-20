import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { mfi as computeMfi } from '../utils/indicators.js';

/**
 * MFI (Money Flow Index) sub-pane. Oscillator 0-100, uses volume.
 * Overbought at 80, oversold at 20 by default.
 */
export class MFISubPane extends ScalePane {
  readonly id = 'mfi';
  readonly label = 'MFI';

  getOptions() { return this.chart.options.mfi || {}; }

  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    return computeMfi(data, this.getOptions().period ?? 14);
  }

  renderContent(ctx: CanvasRenderingContext2D, chart: IChart, _subPaneTop: number, _subPaneHeight: number,
    firstVisibleIdx: number, endIdx: number, visibleMin: number, visibleRange: number, areaHeight: number, areaTop: number): void {
    const values = this.paneState.computedValues;
    if (!values) return;
    const opts = this.getOptions();
    const chartAreaWidth = chart.state.w - chart.state.axisWidth;
    if (opts.showLevels !== false) {
      ctx.strokeStyle = chart.options.layout.textColor ?? '#aaa';
      ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.5;
      for (const level of [opts.overbought ?? 80, opts.oversold ?? 20]) {
        const ratio = (level - visibleMin) / visibleRange;
        const y = areaTop + (areaHeight * (1 - ratio));
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartAreaWidth, y); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    }
    ctx.strokeStyle = opts.color ?? '#9ca3af'; ctx.lineWidth = 1.5; ctx.beginPath();
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
  getMaxVisible(_chart: IChart): number { return 100; }
  getMinVisible(_chart: IChart): number { return 0; }
  getTooltipColor(_bar: Bar): string { return this.getOptions().color ?? '#9ca3af'; }
  getTooltipLabel(): string { return `MFI(${this.getOptions().period ?? 14}):`; }
  getTooltipValue(bar: Bar): number | null {
    const values = this.paneState.computedValues;
    if (!values) return null;
    const idx = this.chart.state.data.indexOf(bar);
    if (idx < 0) return null;
    const v = values[idx];
    return (v != null && !isNaN(v)) ? v : null;
  }
  protected formatValue(value: number): string { return value.toFixed(1); }
}