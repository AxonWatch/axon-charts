import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { indexToX, priceToY } from '../utils/projection.js';
import type { DrawingRenderer } from './DrawingRenderer.js';

/**
 * Renders arrow_up and arrow_down drawings.
 *
 * Behavior is a verbatim port of the original switch cases in
 * Renderer.renderDrawings(). A single class handles both directions
 * (configured via the 'direction' constructor argument) to keep the
 * registry small and share the fill triangle logic.
 */
export class ArrowRenderer implements DrawingRenderer {
  constructor(private readonly direction: 'up' | 'down') {}

  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    const { data } = chart.state;
    if (d.barIndex == null || d.barIndex < 0 || d.barIndex >= data.length) return;
    if (d.price == null) return;

    const x = indexToX(d.barIndex, chart.state);
    const y = priceToY(d.price, chart.state);

    ctx.fillStyle = d.color;
    ctx.beginPath();
    if (this.direction === 'up') {
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x - 5, y);
      ctx.lineTo(x + 5, y);
    } else {
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x - 5, y);
      ctx.lineTo(x + 5, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}