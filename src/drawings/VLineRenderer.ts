import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { chartBottomEdge } from '../utils/style.js';
import type { DrawingRenderer } from './DrawingRenderer.js';

/**
 * Renders a vertical reference line spanning the chart height at a
 * given bar index.
 *
 * Verbatim port of the original 'vline' case in Renderer.renderDrawings().
 * Uses chartBottomEdge() from utils/style.ts for the bottom boundary.
 */
export class VLineRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    const { data } = chart.state;
    if (d.barIndex == null || d.barIndex < 0 || d.barIndex >= data.length) return;
    const cb = chartBottomEdge(chart);
    const x = indexToX(d.barIndex, chart.state);

    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, cb);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}