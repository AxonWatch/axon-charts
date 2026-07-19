import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import type { DrawingRenderer } from './DrawingRenderer.js';

/**
 * Renders a horizontal reference line spanning the chart width at a
 * given price level.
 *
 * Verbatim port of the original 'hline' case in Renderer.renderDrawings().
 */
export class HLineRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    if (d.price == null) return;
    const { w, axisWidth } = chart.state;
    const y = priceToY(d.price, chart.state);

    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w - axisWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}