import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { resolveAnchor } from './anchor.js';
import { hexToRgba, clampYToChartArea } from '../utils/style.js';
import type { DrawingRenderer, DrawingHandle } from './DrawingRenderer.js';

/**
 * Renders a multi-line freeform text annotation on the chart.
 *
 * Distinct from the 'label' drawing type:
 *   - label = single-line, small fixed box, centered on the anchor
 *   - text  = multi-line, sized to content, anchored at the top-left
 *
 * The text box is positioned with its top-left corner at the anchor
 * point, offset slightly (4px) so the anchor dot is visible. The box
 * grows downward and rightward from the anchor. If the box would
 * overflow the right edge of the chart area, it flips to the left
 * side of the anchor; if it would overflow the bottom, the Y is
 * clamped via clampYToChartArea.
 *
 * Anchors: {barIndex|time, price} — the point the annotation marks.
 *
 * Required:
 *   data.lines: string[] — array of lines (each entry is one line)
 *
 * Optional:
 *   data.textFill: CSS color for the box background (semi-transparent
 *                  recommended; defaults to 10%-alpha of drawing.color)
 *   text:         single-line convenience — if set and data.lines is
 *                 not, treated as a one-element lines array
 *
 * The drawing.color is used for the border and the text itself.
 */
export class TextRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    // Resolve lines: prefer data.lines, fall back to single-line text
    const lines = d.data?.lines ?? (d.text ? [d.text] : null);
    if (!lines || lines.length === 0) return;
    if (d.price == null) return;

    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!anchor) return;

    const layout = chart.options.layout;
    const chartW = chart.state.w - chart.state.axisWidth;
    const padX = 6;
    const padY = 4;
    const fontSize = layout.fontSize ?? 12;
    const lineHeight = fontSize + 2;

    ctx.font = `${fontSize}px ${layout.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Measure the widest line to size the box
    let maxTextW = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxTextW) maxTextW = w;
    }
    const boxW = maxTextW + padX * 2;
    const boxH = lines.length * lineHeight + padY * 2;

    // Position: top-left at anchor, offset by 4px so the anchor dot shows.
    // Flip horizontally if the box would overflow the right edge.
    let boxX = anchor.x + 4;
    if (boxX + boxW > chartW) boxX = Math.max(0, anchor.x - 4 - boxW);

    // Clamp Y to the visible chart area (with the full box height)
    const boxY = clampYToChartArea(anchor.y + 4, chart, boxH) - boxH / 2;

    // Box background (semi-transparent)
    const fillColor = d.data?.textFill ?? hexToRgba(d.color, 0.10, layout.textColor);
    ctx.fillStyle = fillColor;
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Border
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Text lines
    ctx.fillStyle = d.color;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], boxX + padX, boxY + padY + i * lineHeight);
    }

    // Small dot at the anchor point so the user can see what the text marks
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  hitTest(x: number, y: number, chart: IChart, d: Drawing): boolean {
    if (d.price == null) return false;
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!anchor) return false;
    return Math.abs(x - anchor.x) <= 12 && Math.abs(y - anchor.y) <= 12;
  }

  getHandles(chart: IChart, d: Drawing): DrawingHandle[] {
    if (d.price == null) return [];
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!anchor) return [];
    return [{ id: 'body', x: anchor.x, y: anchor.y, cursor: 'move' }];
  }
}
