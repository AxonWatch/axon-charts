import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { atr as computeAtr } from '../utils/indicators.js';

/**
 * ATR (Average True Range) sub-pane. Absolute values (not bounded),
 * auto-scaled. No reference lines (ATR has no fixed levels).
 */
export class ATRSubPane extends ScalePane {
  readonly id = 'atr';
  readonly label = 'ATR';

  getOptions() { return this.chart.options.atr || {}; }

  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    return computeAtr(data, this.getOptions().period ?? 14);
  }

  renderContent(ctx: CanvasRenderingContext2D, chart: IChart, _subPaneTop: number, _subPaneHeight: number,
    firstVisibleIdx: number, endIdx: number, visibleMin: number, visibleRange: number, areaHeight: number, areaTop: number): void {
    const values = this.paneState.computedValues;
    if (!values) return;
    ctx.strokeStyle = this.getOptions().color ?? '#9ca3af';
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
    let maxVal = 0;
    for (let i = firstVisible; i < end; i++) {
      const v = values[i];
      if (v != null && !isNaN(v) && v > maxVal) maxVal = v;
    }
    return (maxVal > 0 ? maxVal : 1) / this.paneState.scale;
  }
  getMinVisible(_chart: IChart): number { return 0; }
  getTooltipColor(_bar: Bar): string { return this.getOptions().color ?? '#9ca3af'; }
  getTooltipLabel(): string { return `ATR(${this.getOptions().period ?? 14}):`; }
  getTooltipValue(bar: Bar): number | null {
    const values = this.paneState.computedValues;
    if (!values) return null;
    const idx = this.chart.state.data.indexOf(bar);
    if (idx < 0) return null;
    const v = values[idx];
    return (v != null && !isNaN(v)) ? v : null;
  }
  protected formatValue(value: number): string {
    return value.toFixed(2);
  }
}