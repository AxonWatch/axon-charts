import type { IChart } from '../types/index.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import { superTrend as computeSuperTrend } from '../utils/indicators.js';
import type { Overlay } from './Overlay.js';

/**
 * SuperTrend overlay.
 *
 * Renders a single ATR-based trend line on the main chart. The line
 * sits below price during an uptrend (green) and above price during a
 * downtrend (red), flipping when price closes beyond the band.
 *
 * Extremely popular in crypto and modern trading for trend identification
 * and dynamic stop-loss placement.
 *
 * Options (constructor):
 *   show:           boolean  (default true)
 *   period:         number   (default 10 — ATR lookback)
 *   multiplier:     number   (default 3 — ATR multiplier for band width)
 *   upColor:        string   (default '#10B981' green — uptrend)
 *   downColor:      string   (default '#E11D48' red — downtrend)
 *   lineWidth:      number   (default 1.5)
 *
 * Usage:
 *   chart.addOverlay(new SuperTrendOverlay({ period: 10, multiplier: 3 }));
 */
export class SuperTrendOverlay implements Overlay {
  readonly id: string;
  private opts: {
    show?: boolean;
    period?: number;
    multiplier?: number;
    upColor?: string;
    downColor?: string;
    lineWidth?: number;
  };

  private values: number[] = [];
  private direction: number[] = [];

  constructor(opts: { show?: boolean; period?: number; multiplier?: number; upColor?: string; downColor?: string; lineWidth?: number; id?: string } = {}) {
    this.opts = opts;
    this.id = opts.id ?? `supertrend-${opts.period ?? 10}-${opts.multiplier ?? 3}`;
  }

  getOptions() { return this.opts; }

  getComponents(): Record<string, number[]> {
    return { direction: this.direction };
  }

  compute(chart: IChart): number[] | null {
    const { data } = chart.state;
    if (data.length === 0) return null;
    const result = computeSuperTrend(data, this.opts.period ?? 10, this.opts.multiplier ?? 3);
    this.values = result.values;
    this.direction = result.direction;
    return this.values;
  }

  render(ctx: CanvasRenderingContext2D, chart: IChart, _values: number[] | null): void {
    if (this.values.length === 0) return;
    const opts = this.opts;
    const upColor = opts.upColor ?? '#10B981';
    const downColor = opts.downColor ?? '#E11D48';
    const lineWidth = opts.lineWidth ?? 1.5;
    const { barWidth, w, axisWidth } = chart.state;
    const chartAreaWidth = w - axisWidth;
    const firstVisible = deriveVisibleStartIdx(chart.state, this.values.length);
    const barsVisible = Math.ceil(chartAreaWidth / barWidth) + 2;
    const endIdx = Math.min(firstVisible + barsVisible, this.values.length);

    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);

    // Draw as color-segmented polylines: split at every direction change
    let segColor = '';
    let started = false;
    ctx.beginPath();

    for (let i = firstVisible; i < endIdx; i++) {
      const v = this.values[i];
      if (v == null || isNaN(v)) {
        if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
        continue;
      }
      const dir = this.direction[i];
      const color = dir >= 1 ? upColor : downColor;

      if (color !== segColor) {
        // Color change — flush current segment, start new one from the prior point
        if (started) {
          ctx.stroke();
          ctx.beginPath();
          // Re-draw the last point to connect segments seamlessly
          const prevX = indexToX(i - 1, chart.state);
          const prevY = priceToY(this.values[i - 1], chart.state);
          ctx.moveTo(prevX, prevY);
        }
        segColor = color;
        ctx.strokeStyle = color;
      }

      const x = indexToX(i, chart.state);
      const y = priceToY(v, chart.state);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else { ctx.lineTo(x, y); }
    }
    if (started) ctx.stroke();
  }
}
