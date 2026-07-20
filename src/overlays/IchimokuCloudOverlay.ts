import type { IChart } from '../types/index.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import type { Overlay } from './Overlay.js';

/**
 * Ichimoku Cloud (Ichimoku Kinko Hyo) overlay.
 *
 * Renders five components on the main chart:
 *   - Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
 *   - Kijun-sen (Base Line): (26-period high + 26-period low) / 2
 *   - Senkou Span A (Leading Span A): (Tenkan + Kijun) / 2, shifted 26 bars forward
 *   - Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2, shifted 26 bars forward
 *   - Chikou Span (Lagging Span): close shifted 26 bars backward
 *
 * The "cloud" (Kumo) is the filled region between Senkou Span A and B.
 * When Span A > Span B, the cloud is green (bullish); when Span A < Span B,
 * the cloud is red (bearish).
 *
 * Options (constructor):
 *   show:           boolean  (default true)
 *   tenkanPeriod:   number   (default 9)
 *   kijunPeriod:    number   (default 26)
 *   senkouBPeriod:  number   (default 52)
 *   displacement:   number   (default 26 — forward/backward shift)
 *   tenkanColor:    string   (default '#3b82f6' blue)
 *   kijunColor:     string   (default '#ef4444' red)
 *   spanAColor:     string   (default '#10B981' green)
 *   spanBColor:     string   (default '#E11D48' dark red)
 *   chikouColor:    string   (default '#9ca3af' gray)
 *   showChikou:     boolean  (default true)
 *   showCloud:      boolean  (default true)
 *   cloudOpacity:   number   (default 0.15)
 *
 * Usage:
 *   chart.addOverlay(new IchimokuCloudOverlay());
 */
export class IchimokuCloudOverlay implements Overlay {
  readonly id: string;
  private opts: any;

  constructor(opts: any = {}) {
    this.opts = opts;
    this.id = opts.id ?? 'ichimoku';
  }

  getOptions() { return this.opts; }

  // Private fields for the 5 components, populated in compute()
  private tenkan: number[] = [];
  private kijun: number[] = [];
  private senkouA: number[] = [];  // Already shifted forward
  private senkouB: number[] = [];  // Already shifted forward
  private chikou: number[] = [];   // Already shifted backward

  compute(chart: IChart): number[] | null {
    const { data } = chart.state;
    if (data.length === 0) return null;

    const tenkanPeriod = this.opts.tenkanPeriod ?? 9;
    const kijunPeriod = this.opts.kijunPeriod ?? 26;
    const senkouBPeriod = this.opts.senkouBPeriod ?? 52;
    const displacement = this.opts.displacement ?? 26;

    const len = data.length;
    this.tenkan = new Array(len).fill(NaN);
    this.kijun = new Array(len).fill(NaN);
    this.senkouA = new Array(len).fill(NaN);
    this.senkouB = new Array(len).fill(NaN);
    this.chikou = new Array(len).fill(NaN);

    // Tenkan-sen and Kijun-sen (midpoint of highest high + lowest low)
    for (let i = 0; i < len; i++) {
      this.tenkan[i] = this.midpoint(data, i, tenkanPeriod);
      this.kijun[i] = this.midpoint(data, i, kijunPeriod);
    }

    // Senkou Span A = (Tenkan + Kijun) / 2, shifted forward by displacement
    // Senkou Span B = midpoint over senkouBPeriod, shifted forward by displacement
    for (let i = 0; i < len; i++) {
      const tenkanVal = this.tenkan[i];
      const kijunVal = this.kijun[i];
      const spanARaw = (!isNaN(tenkanVal) && !isNaN(kijunVal)) ? (tenkanVal + kijunVal) / 2 : NaN;
      const spanBRaw = this.midpoint(data, i, senkouBPeriod);

      // Shift forward: the value at bar i is drawn at bar i + displacement
      const shiftedIdx = i + displacement;
      if (shiftedIdx < len) {
        this.senkouA[shiftedIdx] = spanARaw;
        this.senkouB[shiftedIdx] = spanBRaw;
      }
    }

    // Chikou Span = close shifted backward by displacement
    for (let i = 0; i < len; i++) {
      const shiftedIdx = i - displacement;
      if (shiftedIdx >= 0) {
        this.chikou[shiftedIdx] = data[i].close;
      }
    }

    return this.tenkan;  // Primary value (used by the base contract)
  }

  /**
   * Compute (highest high + lowest low) / 2 over the last `period` bars
   * ending at index i (inclusive).
   */
  private midpoint(data: any[], i: number, period: number): number {
    if (i < period - 1) return NaN;
    let highest = -Infinity, lowest = Infinity;
    for (let j = 0; j < period; j++) {
      const b = data[i - j];
      if (b.high > highest) highest = b.high;
      if (b.low < lowest) lowest = b.low;
    }
    return (highest + lowest) / 2;
  }

  render(ctx: CanvasRenderingContext2D, chart: IChart, _values: number[] | null): void {
    if (this.tenkan.length === 0) return;
    const opts = this.opts;
    const { barWidth, w, axisWidth } = chart.state;
    const chartAreaWidth = w - axisWidth;
    const firstVisible = deriveVisibleStartIdx(chart.state, this.tenkan.length);
    const barsVisible = Math.ceil(chartAreaWidth / barWidth) + 2;
    const endIdx = Math.min(firstVisible + barsVisible, this.tenkan.length);

    // Draw the cloud (Kumo) — filled region between Senkou A and B
    if (opts.showCloud !== false) {
      const opacity = opts.cloudOpacity ?? 0.15;
      ctx.beginPath();
      let started = false;
      // Span A forward
      for (let i = firstVisible; i < endIdx; i++) {
        const v = this.senkouA[i];
        if (v == null || isNaN(v)) continue;
        const x = indexToX(i, chart.state);
        const y = priceToY(v, chart.state);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      }
      // Span B backward
      for (let i = endIdx - 1; i >= firstVisible; i--) {
        const v = this.senkouB[i];
        if (v == null || isNaN(v)) continue;
        const x = indexToX(i, chart.state);
        const y = priceToY(v, chart.state);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      // Cloud color: green when A > B, red when A < B
      // We use a simple heuristic: check the midpoint of the visible range
      const midIdx = Math.floor((firstVisible + endIdx) / 2);
      const aMid = this.senkouA[midIdx];
      const bMid = this.senkouB[midIdx];
      const cloudBullish = !isNaN(aMid) && !isNaN(bMid) && aMid >= bMid;
      ctx.fillStyle = this.hexToRgba(
        cloudBullish ? (opts.spanAColor ?? '#10B981') : (opts.spanBColor ?? '#E11D48'),
        opacity
      );
      ctx.fill();
    }

    // Draw the lines
    ctx.setLineDash([]);
    // Senkou Span A (green)
    this.drawLine(ctx, chart, this.senkouA, firstVisible, endIdx, opts.spanAColor ?? '#10B981', 1);
    // Senkou Span B (red)
    this.drawLine(ctx, chart, this.senkouB, firstVisible, endIdx, opts.spanBColor ?? '#E11D48', 1);
    // Tenkan-sen (blue)
    this.drawLine(ctx, chart, this.tenkan, firstVisible, endIdx, opts.tenkanColor ?? '#3b82f6', 1.5);
    // Kijun-sen (red)
    this.drawLine(ctx, chart, this.kijun, firstVisible, endIdx, opts.kijunColor ?? '#ef4444', 1.5);
    // Chikou Span (gray)
    if (opts.showChikou !== false) {
      this.drawLine(ctx, chart, this.chikou, firstVisible, endIdx, opts.chikouColor ?? '#9ca3af', 1);
    }
  }

  private drawLine(
    ctx: CanvasRenderingContext2D,
    chart: IChart,
    values: number[],
    firstVisible: number,
    endIdx: number,
    color: string,
    lineWidth: number
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    let started = false;
    for (let i = firstVisible; i < endIdx; i++) {
      const v = values[i];
      if (v == null || isNaN(v)) continue;
      const x = indexToX(i, chart.state);
      const y = priceToY(v, chart.state);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
  }

  private hexToRgba(hex: string, alpha: number): string {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      const r = parseInt(hex[1] + hex[1], 16);
      const g = parseInt(hex[2] + hex[2], 16);
      const b = parseInt(hex[3] + hex[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(59, 130, 246, ${alpha})`;
  }
}