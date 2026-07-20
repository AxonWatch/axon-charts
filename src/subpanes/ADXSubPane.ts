import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { adx as computeAdx } from '../utils/indicators.js';

/**
 * ADX / DMS (Directional Movement System) sub-pane.
 * Renders three lines: ADX, +DI, -DI. Y-axis fixed to 0-100.
 * Threshold reference line at 25 by default (strong trend).
 */
export class ADXSubPane extends ScalePane {
  readonly id = 'adx';
  readonly label = 'ADX';

  private adxValues: number[] | null = null;
  private plusDiValues: number[] | null = null;
  private minusDiValues: number[] | null = null;

  getOptions() { return this.chart.options.adx || {}; }

  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    const result = computeAdx(data, this.getOptions().period ?? 14);
    this.adxValues = result.adx;
    this.plusDiValues = result.plusDI;
    this.minusDiValues = result.minusDI;
    return result.adx;
  }

  renderContent(ctx: CanvasRenderingContext2D, chart: IChart, _subPaneTop: number, _subPaneHeight: number,
    firstVisibleIdx: number, endIdx: number, visibleMin: number, visibleRange: number, areaHeight: number, areaTop: number): void {
    if (!this.adxValues || !this.plusDiValues || !this.minusDiValues) return;
    const opts = this.getOptions();
    const chartAreaWidth = chart.state.w - chart.state.axisWidth;
    // Threshold reference line
    if (opts.showThreshold !== false) {
      const threshold = opts.threshold ?? 25;
      ctx.strokeStyle = chart.options.layout.textColor ?? '#aaa';
      ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.5;
      const ratio = (threshold - visibleMin) / visibleRange;
      const y = areaTop + (areaHeight * (1 - ratio));
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartAreaWidth, y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    }
    // Three lines: +DI (green), -DI (red), ADX (blue)
    this.drawLine(ctx, chart, this.plusDiValues, firstVisibleIdx, endIdx, visibleMin, visibleRange, areaHeight, areaTop, opts.plusDiColor ?? '#10B981');
    this.drawLine(ctx, chart, this.minusDiValues, firstVisibleIdx, endIdx, visibleMin, visibleRange, areaHeight, areaTop, opts.minusDiColor ?? '#E11D48');
    this.drawLine(ctx, chart, this.adxValues, firstVisibleIdx, endIdx, visibleMin, visibleRange, areaHeight, areaTop, opts.adxColor ?? '#3b82f6');
  }

  private drawLine(ctx: CanvasRenderingContext2D, chart: IChart, values: number[],
    firstVisibleIdx: number, endIdx: number, visibleMin: number, visibleRange: number, areaHeight: number, areaTop: number, color: string): void {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
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
  getTooltipColor(_bar: Bar): string { return this.getOptions().adxColor ?? '#3b82f6'; }
  getTooltipLabel(): string { return `ADX(${this.getOptions().period ?? 14}):`; }
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