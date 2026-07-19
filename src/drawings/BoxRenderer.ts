import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { resolveAnchor } from './anchor.js';
import { hexToRgba } from '../utils/style.js';
import type { DrawingRenderer } from './DrawingRenderer.js';

/**
 * Sets the canvas line dash pattern from a DrawingData.lineStyle value.
 * Shared by two-point renderers (trendline, box, measure, fib).
 */
function applyLineStyle(ctx: CanvasRenderingContext2D, style: string | undefined): void {
  switch (style) {
    case 'dashed': ctx.setLineDash([4, 4]); break;
    case 'dotted': ctx.setLineDash([2, 3]); break;
    case 'solid':
    default:       ctx.setLineDash([]); break;
  }
}

/**
 * Renders a rectangle between two anchor points (opposite corners).
 *
 * Common uses: trading ranges, supply/demand zones, pattern
 * completion zones, highlight regions.
 *
 * Anchors: two opposite corners — {barIndex|time, price} and
 * {barIndex2|time2, price2}. The box spans between them regardless
 * of which corner is "first" (the renderer normalizes the rectangle).
 *
 * Data fields (all optional, in DrawingData):
 *   fill:       CSS color for the rectangle fill (semi-transparent
 *               recommended; if omitted, defaults to a 15%-alpha
 *               version of the drawing color)
 *   lineStyle:  'solid' | 'dashed' | 'dotted'  (default 'solid')
 *   lineWidth:  number                        (default 1)
 *
 * If `text` is set, a small label is drawn at the top-left corner of
 * the box.
 *
 * The box is clipped to the chart area horizontally (x >= 0 and
 * x <= chartW) so anchors outside the visible range produce a
 * partially-visible box rather than overflow.
 */
export class BoxRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    if (d.price == null || d.price2 == null) return;

    const a1 = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!a1) return;
    const a2 = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: d.price2 });
    if (!a2) return;

    // Normalize to (left, top, right, bottom) regardless of which
    // corner was specified first
    const left = Math.min(a1.x, a2.x);
    const right = Math.max(a1.x, a2.x);
    const top = Math.min(a1.y, a2.y);
    const bottom = Math.max(a1.y, a2.y);
    const width = right - left;
    const height = bottom - top;

    if (width <= 0 || height <= 0) return;

    const chartW = chart.state.w - chart.state.axisWidth;

    // Fill (semi-transparent). Use data.fill if provided, otherwise
    // derive a 15%-alpha version of the drawing color.
    const fillColor = d.data?.fill ?? hexToRgba(d.color, 0.15, chart.options.layout.textColor);
    ctx.fillStyle = fillColor;
    ctx.fillRect(left, top, width, height);

    // Border
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.data?.lineWidth ?? 1;
    applyLineStyle(ctx, d.data?.lineStyle);
    ctx.strokeRect(left, top, width, height);
    ctx.setLineDash([]);

    // Optional text label at the top-left corner of the box
    if (d.text) {
      ctx.font = `${chart.options.layout.fontSize}px ${chart.options.layout.fontFamily}`;
      const text = d.text;
      const tw = ctx.measureText(text).width;
      const boxX = Math.max(2, left + 4);
      const boxY = top + 4;

      ctx.fillStyle = hexToRgba(d.color, 0.15, chart.options.layout.textColor);
      ctx.fillRect(boxX, boxY, tw + 8, 16);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, tw + 8, 16);

      ctx.fillStyle = d.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, boxX + 4, boxY + 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }
}