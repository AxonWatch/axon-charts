import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { indexToX, priceToY } from '../utils/projection.js';
import { resolveAnchor } from './anchor.js';
import type { DrawingRenderer, DrawingHandle } from './DrawingRenderer.js';

/**
 * Renders arrow_up and arrow_down drawings.
 *
 * Behavior is a verbatim port of the original switch cases in
 * Renderer.renderDrawings(). A single class handles both directions
 * (configured via the 'direction' constructor argument) to keep the
 * registry small and share the fill triangle logic.
 *
 * Interactive: one body handle (drag to move the anchor).
 */
export class ArrowRenderer implements DrawingRenderer {
  constructor(private readonly direction: 'up' | 'down') {}

  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price ?? 0 });
    if (!anchor || d.price == null) return;
    const x = anchor.x;
    const y = anchor.y;

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

  hitTest(x: number, y: number, chart: IChart, d: Drawing): boolean {
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price ?? 0 });
    if (!anchor) return false;
    // 10px box around the anchor (the arrow is ~10px tall)
    return Math.abs(x - anchor.x) <= 6 && Math.abs(y - anchor.y) <= 10;
  }

  getHandles(chart: IChart, d: Drawing): DrawingHandle[] {
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price ?? 0 });
    if (!anchor) return [];
    return [{ id: 'body', x: anchor.x, y: anchor.y, cursor: 'move' }];
  }
}