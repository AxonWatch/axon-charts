import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { obv as computeObv } from '../utils/indicators.js';

/**
 * OBV (On-Balance Volume) sub-pane.
 *
 * Renders the cumulative volume line: volume is added when close >
 * prevClose, subtracted when close < prevClose. OBV trends upward
 * during accumulation (buying pressure) and downward during
 * distribution (selling pressure).
 *
 * Auto-scaled Y-axis (OBV is cumulative and unbounded). No reference
 * lines (OBV has no fixed levels).
 *
 * Options (chart.options.obv):
 *   show:          boolean  (default false)
 *   heightPercent: number   (default 0.15)
 *   color:         string   (default '#eab308' gold)
 */
export class OBVSubPane extends ScalePane {
  readonly id = 'obv';
  readonly label = 'OBV';

  getOptions() { return this.chart.options.obv || {}; }

  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    return computeObv(data);
  }

  renderContent(ctx: CanvasRenderingContext2D, chart: IChart, _subPaneTop: number, _subPaneHeight: number,
    firstVisibleIdx: number, endIdx: number, visibleMin: number, visibleRange: number, areaHeight: number, areaTop: number): void {
    const values = this.paneState.computedValues;
    if (!values) return;
    ctx.strokeStyle = this.getOptions().color ?? '#eab308';
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

  private getVisibleRange(chart: IChart): { min: number; max: number } {
    const values = this.paneState.computedValues;
    if (!values) return { min: -1, max: 1 };
    const firstVisible = Math.max(0, Math.ceil((-chart.state.offsetX) / chart.state.barWidth));
    const barsVisible = Math.ceil((chart.state.w - chart.state.axisWidth) / chart.state.barWidth) + 2;
    const end = Math.min(firstVisible + barsVisible, values.length);
    let minVal = Infinity, maxVal = -Infinity;
    for (let i = firstVisible; i < end; i++) {
      const v = values[i];
      if (v != null && !isNaN(v)) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    return {
      min: isFinite(minVal) ? minVal : -1,
      max: isFinite(maxVal) ? maxVal : 1
    };
  }

  getMaxVisible(chart: IChart): number {
    return this.getVisibleRange(chart).max / this.paneState.scale;
  }

  getMinVisible(chart: IChart): number {
    return this.getVisibleRange(chart).min / this.paneState.scale;
  }

  getTooltipColor(_bar: Bar): string { return this.getOptions().color ?? '#eab308'; }
  getTooltipLabel(): string { return 'OBV:'; }
  getTooltipValue(bar: Bar, barIndex?: number): number | null {
    const values = this.paneState.computedValues;
    if (!values) return null;
    const idx = barIndex ?? this.chart.state.data.indexOf(bar);
    if (idx < 0) return null;
    const v = values[idx];
    return (v != null && !isNaN(v)) ? v : null;
  }

  protected formatValue(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (value / 1e3).toFixed(2) + 'K';
    return value.toFixed(0);
  }
}
