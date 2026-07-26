import type { IChart } from '../types/index.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import { donchian as computeDonchian } from '../utils/indicators.js';
import type { Overlay } from './Overlay.js';

/**
 * Donchian Channel overlay.
 *
 * Renders three lines on the main chart:
 *   - Upper band:  highest high over `period` bars
 *   - Lower band:  lowest low over `period` bars
 *   - Middle line: (upper + lower) / 2
 *
 * The channel highlights breakouts — price touching the upper band
 * is at its N-bar high, touching the lower is at its N-bar low.
 *
 * Options (constructor):
 *   show:      boolean  (default true)
 *   period:    number   (default 20)
 *   color:     string   (default '#6366f1' indigo — used for all 3 lines)
 *   lineWidth: number   (default 1)
 *   showMid:   boolean  (default true — draw the middle line)
 *
 * Usage:
 *   chart.addOverlay(new DonchianChannelOverlay({ period: 20 }));
 */
export class DonchianChannelOverlay implements Overlay {
  readonly id: string;
  private opts: {
    show?: boolean;
    period?: number;
    color?: string;
    lineWidth?: number;
    showMid?: boolean;
  };

  private upper: number[] = [];
  private middle: number[] = [];
  private lower: number[] = [];

  constructor(opts: { show?: boolean; period?: number; color?: string; lineWidth?: number; showMid?: boolean; id?: string } = {}) {
    this.opts = opts;
    this.id = opts.id ?? `donchian-${opts.period ?? 20}`;
  }

  getOptions() { return this.opts; }

  compute(chart: IChart): number[] | null {
    const { data } = chart.state;
    if (data.length === 0) return null;
    const period = this.opts.period ?? 20;
    const result = computeDonchian(data, period);
    this.upper = result.upper;
    this.middle = result.middle;
    this.lower = result.lower;
    return this.middle;
  }

  render(ctx: CanvasRenderingContext2D, chart: IChart, _values: number[] | null): void {
    if (this.upper.length === 0) return;
    const opts = this.opts;
    const color = opts.color ?? '#6366f1';
    const lineWidth = opts.lineWidth ?? 1;
    const showMid = opts.showMid !== false;
    const { barWidth, w, axisWidth } = chart.state;
    const chartAreaWidth = w - axisWidth;
    const firstVisible = deriveVisibleStartIdx(chart.state, this.upper.length);
    const barsVisible = Math.ceil(chartAreaWidth / barWidth) + 2;
    const endIdx = Math.min(firstVisible + barsVisible, this.upper.length);

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);

    const bands = showMid
      ? [this.upper, this.middle, this.lower]
      : [this.upper, this.lower];

    for (const band of bands) {
      ctx.beginPath();
      let started = false;
      for (let i = firstVisible; i < endIdx; i++) {
        const v = band[i];
        if (v == null || isNaN(v)) continue;
        const x = indexToX(i, chart.state);
        const y = priceToY(v, chart.state);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
    }
  }
}
