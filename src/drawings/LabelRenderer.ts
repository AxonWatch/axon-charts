import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { resolveAnchor } from './anchor.js';
import { hexToRgba } from '../utils/style.js';
import type { DrawingRenderer, DrawingHandle } from './DrawingRenderer.js';

/**
 * Renders a text label drawing — a small boxed text annotation centered
 * on the anchor point.
 *
 * Verbatim port of the original 'label' case in Renderer.renderDrawings().
 * Interactive: one body handle (drag to move the anchor).
 */
export class LabelRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price ?? 0 });
    if (!anchor || d.price == null) return;
    const x = anchor.x;
    const y = anchor.y;

    ctx.font = '11px system-ui';
    let text = d.text || '';

    // Optionally prepend the formatted price at the anchor
    if (d.data?.showPrice === true) {
      const priceStr = chart.priceFormatter.formatPrice(d.price);
      text = text ? `${priceStr} — ${text}` : priceStr;
    }

    const tw = ctx.measureText(text).width;
    ctx.fillStyle = hexToRgba(d.color, 0.15, chart.options.layout.textColor);
    ctx.fillRect(x - tw / 2 - 4, y - 8, tw + 8, 16);
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - tw / 2 - 4, y - 8, tw + 8, 16);
    ctx.fillStyle = d.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  hitTest(x: number, y: number, chart: IChart, d: Drawing): boolean {
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price ?? 0 });
    if (!anchor) return false;
    // 16px box around the anchor (label is 16px tall)
    return Math.abs(x - anchor.x) <= 12 && Math.abs(y - anchor.y) <= 10;
  }

  getHandles(chart: IChart, d: Drawing): DrawingHandle[] {
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price ?? 0 });
    if (!anchor) return [];
    return [{ id: 'body', x: anchor.x, y: anchor.y, cursor: 'move' }];
  }
}