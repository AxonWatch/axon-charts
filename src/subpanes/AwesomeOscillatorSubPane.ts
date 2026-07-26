import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { awesomeOscillator as computeAO } from '../utils/indicators.js';

/**
 * Awesome Oscillator (AO) sub-pane.
 *
 * Renders a histogram of SMA(median, 5) - SMA(median, 34) where
 * median = (high + low) / 2. Positive bars (green) indicate
 * short-term momentum is above long-term; negative bars (red)
 * indicate the reverse. A zero reference line is drawn.
 *
 * Options (chart.options.awesomeOscillator):
 *   show:              boolean  (default false)
 *   fastPeriod:        number   (default 5)
 *   slowPeriod:        number   (default 34)
 *   heightPercent:     number   (default 0.15)
 *   histogramUpColor:  string   (default '#10B981')
 *   histogramDownColor: string  (default '#E11D48')
 */
export class AwesomeOscillatorSubPane extends ScalePane {
  readonly id = 'awesomeOscillator';
  readonly label = 'AO';

  getOptions() { return this.chart.options.awesomeOscillator || {}; }

  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    const { data } = chart.state;
    if (data.length === 0) return null;
    const opts = this.getOptions();
    return computeAO(data, opts.fastPeriod ?? 5, opts.slowPeriod ?? 34);
  }

  renderContent(ctx: CanvasRenderingContext2D, chart: IChart, _subPaneTop: number, _subPaneHeight: number,
    firstVisibleIdx: number, endIdx: number, visibleMin: number, visibleRange: number, areaHeight: number, areaTop: number): void {
    const values = this.paneState.computedValues;
    if (!values) return;
    const opts = this.getOptions();
    const chartAreaWidth = chart.state.w - chart.state.axisWidth;
    const zeroY = areaTop + (areaHeight * (1 - (0 - visibleMin) / visibleRange));

    // Zero reference line
    ctx.strokeStyle = chart.options.layout.textColor ?? '#aaa';
    ctx.lineWidth = 1; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(chartAreaWidth, zeroY); ctx.stroke();
    ctx.globalAlpha = 1;

    // Histogram bars
    const barWidth = chart.state.barWidth;
    const candleW = Math.max(1, Math.floor(barWidth * 0.8));
    const upColor = opts.histogramUpColor ?? '#10B981';
    const downColor = opts.histogramDownColor ?? '#E11D48';
    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const h = values[i];
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

  getTooltipColor(_bar: Bar): string { return this.getOptions().histogramUpColor ?? '#10B981'; }
  getTooltipLabel(): string {
    const opts = this.getOptions();
    return `AO(${opts.fastPeriod ?? 5},${opts.slowPeriod ?? 34}):`;
  }
  getTooltipValue(bar: Bar, barIndex?: number): number | null {
    const values = this.paneState.computedValues;
    if (!values) return null;
    const idx = barIndex ?? this.chart.state.data.indexOf(bar);
    if (idx < 0) return null;
    const v = values[idx];
    return (v != null && !isNaN(v)) ? v : null;
  }

  protected formatValue(value: number): string { return value.toFixed(3); }
}
