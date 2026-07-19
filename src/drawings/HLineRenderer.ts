import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { chartBottomEdge } from '../utils/style.js';
import type { DrawingRenderer, DrawingHandle } from './DrawingRenderer.js';

/**
 * Renders a horizontal reference line spanning the chart width at a
 * given price level.
 *
 * Verbatim port of the original 'hline' case in Renderer.renderDrawings().
 * Interactive: one body handle (drag to change the price).
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

  hitTest(x: number, y: number, chart: IChart, d: Drawing): boolean {
    if (d.price == null) return false;
    const lineY = priceToY(d.price, chart.state);
    return Math.abs(y - lineY) <= 6 && x >= 0 && x <= chart.state.w - chart.state.axisWidth;
  }

  getHandles(chart: IChart, d: Drawing): DrawingHandle[] {
    if (d.price == null) return [];
    const y = priceToY(d.price, chart.state);
    // Body handle in the middle of the line
    return [{ id: 'body', x: (chart.state.w - chart.state.axisWidth) / 2, y, cursor: 'ns-resize' }];
  }
}