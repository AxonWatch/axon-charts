import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { cci as computeCci } from '../utils/indicators.js';

/**
 * CCI (Commodity Channel Index) sub-pane. Oscillator around 0,
 * unbounded. Reference lines at +/-100 by default.
 */
export class CCISubPane extends ScalePane {
  readonly id = 'cci';
  readonly label = 'CCI';

  getOptions() { return this.chart.options.cci || {}; }

  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    return computeCci(data, this.getOptions().period ?? 20);
  }

  renderContent(ctx: CanvasRenderingContext2D, chart: IChart, _subPaneTop: number, _subPaneHeight: number,
    firstVisibleIdx: number, endIdx: number, visibleMin: number, visibleRange: number, areaHeight: number, areaTop: number): void {
    const values = this.paneState.computedValues;
    if (!values) return;
    const opts = this.getOptions();
    const chartAreaWidth = chart.state.w - chart.state.axisWidth;
    // Zero line
    const zeroY = areaTop + (areaHeight * (1 - (0 - visibleMin) / visibleRange));
    ctx.strokeStyle = chart.options.layout.textColor ?? '#aaa';
    ctx.lineWidth = 1; ctx.globalAlpha = 0.2;
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(chartAreaWidth, zeroY); ctx.stroke();
    ctx.globalAlpha = 1;
    // Level lines
    if (opts.showLevels !== false) {
      ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.5;
      for (const level of [opts.upperLevel ?? 100, opts.lowerLevel ?? -100]) {
        const ratio = (level - visibleMin) / visibleRange;
        const y = areaTop + (areaHeight * (1 - ratio));
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartAreaWidth, y); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    }
    // CCI line
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
  getMaxVisible(chart: IChart): number {
    // Auto-scale to visible range
    const values = this.paneState.computedValues;
    if (!values) return 200;
    const firstVisible = Math.max(0, Math.ceil((-chart.state.offsetX) / chart.state.barWidth));
    const barsVisible = Math.ceil((chart.state.w - chart.state.axisWidth) / chart.state.barWidth) + 2;
    const end = Math.min(firstVisible + barsVisible, values.length);
    let maxAbs = 0;
    for (let i = firstVisible; i < end; i++) {
      const v = values[i];
      if (v != null && !isNaN(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
    }
    return (maxAbs > 0 ? maxAbs : 200) / this.paneState.scale;
  }
  getMinVisible(chart: IChart): number { return -this.getMaxVisible(chart); }
  getTooltipColor(_bar: Bar): string { return this.getOptions().color ?? '#9ca3af'; }
  getTooltipLabel(): string { return `CCI(${this.getOptions().period ?? 20}):`; }
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