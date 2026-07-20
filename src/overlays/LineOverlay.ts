import type { IChart } from '../types/index.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import type { Overlay } from './Overlay.js';

/**
 * Shared rendering for single-line overlay indicators (SMA, EMA, WMA, VWAP).
 * Draws a polyline connecting the indicator values for the visible bars,
 * using the main chart's price scale (Y-axis).
 *
 * Subclasses only need to implement compute() (the actual math) and
 * getOptions() (which options block + show/color/lineWidth).
 */
export abstract class LineOverlay implements Overlay {
  abstract readonly id: string;

  /** Subclass: compute the indicator values for all bars. */
  abstract compute(chart: IChart): number[] | null;

  /** Subclass: return the options block (must include show, color, lineWidth). */
  abstract getOptions(): { show?: boolean; color?: string; lineWidth?: number; [key: string]: any };

  render(ctx: CanvasRenderingContext2D, chart: IChart, values: number[] | null): void {
    if (!values || values.length === 0) return;
    const opts = this.getOptions();
    const color = opts.color ?? '#3b82f6';
    const lineWidth = opts.lineWidth ?? 1.5;
    const { barWidth, w, axisWidth } = chart.state;
    const chartAreaWidth = w - axisWidth;

    const firstVisible = deriveVisibleStartIdx(chart.state, values.length);
    const barsVisible = Math.ceil(chartAreaWidth / barWidth) + 2;
    const endIdx = Math.min(firstVisible + barsVisible, values.length);

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);
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
}