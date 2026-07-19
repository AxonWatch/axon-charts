import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { indexToX, priceToY } from '../utils/projection.js';
import { hexToRgba } from '../utils/style.js';
import type { DrawingRenderer } from './DrawingRenderer.js';

/**
 * Renders a text label drawing — a small boxed text annotation centered
 * on the anchor point.
 *
 * Verbatim port of the original 'label' case in Renderer.renderDrawings().
 */
export class LabelRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    const { data } = chart.state;
    if (d.barIndex == null || d.barIndex < 0 || d.barIndex >= data.length) return;
    if (d.price == null) return;

    const x = indexToX(d.barIndex, chart.state);
    const y = priceToY(d.price, chart.state);

    ctx.font = '11px system-ui';
    const text = d.text || '';
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
  }
}