import type { IChart } from '../types/index.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import { parabolicSAR as computePSAR } from '../utils/indicators.js';
import type { Overlay } from './Overlay.js';

/**
 * Parabolic SAR (Stop and Reverse) overlay.
 *
 * Renders dots below price during an uptrend (green) and above price
 * during a downtrend (red). The dots converge on price as a trend
 * matures, then flip to the other side when the trend reverses.
 *
 * One of the most iconic overlay indicators for trailing stop
 * placement and trend reversal signaling.
 *
 * Options (constructor):
 *   show:       boolean  (default true)
 *   step:       number   (default 0.02 — acceleration factor increment)
 *   maxStep:    number   (default 0.2 — acceleration factor cap)
 *   upColor:    string   (default '#10B981' green — uptrend dots)
 *   downColor:  string   (default '#E11D48' red — downtrend dots)
 *   dotRadius:  number   (default 1.5 — radius of each SAR dot in pixels)
 *
 * Usage:
 *   chart.addOverlay(new ParabolicSAROverlay({ step: 0.02, maxStep: 0.2 }));
 */
export class ParabolicSAROverlay implements Overlay {
  readonly id: string;
  private opts: {
    show?: boolean;
    step?: number;
    maxStep?: number;
    upColor?: string;
    downColor?: string;
    dotRadius?: number;
  };

  private values: number[] = [];
  private direction: number[] = [];

  constructor(opts: { show?: boolean; step?: number; maxStep?: number; upColor?: string; downColor?: string; dotRadius?: number; id?: string } = {}) {
    this.opts = opts;
    this.id = opts.id ?? 'psar';
  }

  getOptions() { return this.opts; }

  getComponents(): Record<string, number[]> {
    return { direction: this.direction };
  }

  compute(chart: IChart): number[] | null {
    const { data } = chart.state;
    if (data.length === 0) return null;
    const result = computePSAR(data, this.opts.step ?? 0.02, this.opts.maxStep ?? 0.2);
    this.values = result.values;
    this.direction = result.direction;
    return this.values;
  }

  render(ctx: CanvasRenderingContext2D, chart: IChart, _values: number[] | null): void {
    if (this.values.length === 0) return;
    const opts = this.opts;
    const upColor = opts.upColor ?? '#10B981';
    const downColor = opts.downColor ?? '#E11D48';
    const radius = opts.dotRadius ?? 1.5;
    const { barWidth, w, axisWidth } = chart.state;
    const chartAreaWidth = w - axisWidth;
    const firstVisible = deriveVisibleStartIdx(chart.state, this.values.length);
    const barsVisible = Math.ceil(chartAreaWidth / barWidth) + 2;
    const endIdx = Math.min(firstVisible + barsVisible, this.values.length);

    ctx.setLineDash([]);

    for (let i = firstVisible; i < endIdx; i++) {
      const v = this.values[i];
      if (v == null || isNaN(v)) continue;
      const dir = this.direction[i];
      ctx.fillStyle = dir >= 1 ? upColor : downColor;
      const x = indexToX(i, chart.state);
      const y = priceToY(v, chart.state);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
