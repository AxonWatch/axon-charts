import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { resolveAnchor } from './anchor.js';
import { chartBottomEdge } from '../utils/style.js';
import { hexToRgba } from '../utils/style.js';
import type { DrawingRenderer, DrawingHandle } from './DrawingRenderer.js';

/**
 * Renders a vertical highlight band across the full chart height,
 * spanning between two time anchors.
 *
 * Common uses:
 *   - Marking an earnings window / news event period
 *   - Highlighting a session range (e.g. London open)
 *   - Drawing attention to a specific bar range
 *
 * Unlike 'box', highlighter spans the FULL chart height (top margin
 * to chart bottom edge) — only the X range is user-controlled. The
 * Y anchors (price, price2) are ignored.
 *
 * Anchors: {barIndex|time} and {barIndex2|time2} — the two time
 * boundaries. price/price2 are not required and ignored if set.
 *
 * Optional data fields (in DrawingData):
 *   fill:     CSS color for the band fill (semi-transparent recommended;
 *             defaults to 20%-alpha of drawing.color)
 *   lineStyle: 'solid' (default) | 'dashed' | 'dotted'  (border style)
 *   lineWidth: border width in pixels (default 1)
 *
 * If `text` is set, a small label is drawn at the top-left of the band
 * (just below the top margin).
 *
 * The band is drawn behind the candles visually (it's filled first,
 * then the candles draw on top via the buffer copy) — actually, since
 * renderDrawings runs AFTER the buffer copy in drawViewport, the band
 * draws on top of candles. Use a low fill alpha (0.05-0.15) to keep
 * candles readable.
 */
export class HighlighterRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    // Highlighter is time-only: price is not required. Use a dummy
    // price of 0 so resolveAnchor can resolve the bar index from time.
    // The Y of the anchor is irrelevant — we use the full chart height.
    const a1 = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: 0 });
    if (!a1) return;
    const a2 = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: 0 });
    if (!a2) return;

    const chartW = chart.state.w - chart.state.axisWidth;
    const top = chart.state.topMargin;
    const bottom = chartBottomEdge(chart);
    const bandHeight = bottom - top;
    if (bandHeight <= 0) return;

    // Normalize X boundaries
    const left = Math.min(a1.x, a2.x);
    const right = Math.max(a1.x, a2.x);
    const width = right - left;
    if (width <= 0) return;

    // Fill (semi-transparent). Default to 20%-alpha of color.
    const fillColor = d.data?.fill ?? hexToRgba(d.color, 0.20, chart.options.layout.textColor);
    ctx.fillStyle = fillColor;
    ctx.fillRect(left, top, width, bandHeight);

    // Border (optional dashed/dotted)
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.data?.lineWidth ?? 1;
    switch (d.data?.lineStyle) {
      case 'dashed': ctx.setLineDash([4, 4]); break;
      case 'dotted': ctx.setLineDash([2, 3]); break;
      case 'solid':
      default:       ctx.setLineDash([]); break;
    }
    ctx.strokeRect(left, top, width, bandHeight);
    ctx.setLineDash([]);

    // Optional text label at the top-left of the band
    if (d.text) {
      const layout = chart.options.layout;
      ctx.font = `${layout.fontSize ?? 12}px ${layout.fontFamily}`;
      const text = d.text;
      const tw = ctx.measureText(text).width;
      const boxX = left + 4;
      const boxY = top + 4;

      ctx.fillStyle = hexToRgba(d.color, 0.20, layout.textColor);
      ctx.fillRect(boxX, boxY, tw + 8, 16);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, tw + 8, 16);

      ctx.fillStyle = d.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, boxX + 4, boxY + 2);
      ctx.textBaseline = 'alphabetic';
    }
  }

  hitTest(x: number, y: number, chart: IChart, d: Drawing): boolean {
    const a1 = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: 0 });
    if (!a1) return false;
    const a2 = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: 0 });
    if (!a2) return false;
    const left = Math.min(a1.x, a2.x);
    const right = Math.max(a1.x, a2.x);
    const top = chart.state.topMargin;
    const bottom = chartBottomEdge(chart);
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  getHandles(chart: IChart, d: Drawing): DrawingHandle[] {
    const a1 = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: 0 });
    if (!a1) return [];
    const a2 = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: 0 });
    if (!a2) return [];
    const left = Math.min(a1.x, a2.x);
    const right = Math.max(a1.x, a2.x);
    const midY = (chart.state.topMargin + chartBottomEdge(chart)) / 2;
    return [
      { id: 'p1', x: left, y: midY, cursor: 'ew-resize' },
      { id: 'p2', x: right, y: midY, cursor: 'ew-resize' },
    ];
  }
}
