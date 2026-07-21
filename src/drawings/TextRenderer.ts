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
 * Supports word wrapping when data.maxWidth is set, independent colors
 * for border / text / background, and optional border / background.
 *
 * Anchors: {barIndex|time, price} — the point the annotation marks.
 *
 * Required:
 *   data.lines: string[] — array of lines (each entry is one line
 *                          before wrapping)
 *   OR text: string — single-line convenience
 *
 * Options (in DrawingData):
 *   showBackground: boolean   (default true — draw the fill rect)
 *   showBorder:    boolean   (default true — draw the border)
 *   borderColor:   string    (default: drawing.color)
 *   textColor:     string    (default: drawing.color)
 *   textFill:      string    (default: 10%-alpha of drawing.color)
 *   maxWidth:      number    (optional — wrap long lines at this width)
 *   showAnchorDot: boolean   (default true — always show the dot;
 *                             set false to only show on hover/selection)
 */
export class TextRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    const rawLines = d.data?.lines ?? (d.text ? [d.text] : null);
    if (!rawLines || rawLines.length === 0) return;
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

    // Word-wrap each input line if maxWidth is set
    const maxWidth = d.data?.maxWidth;
    const wrappedLines: string[] = [];
    if (maxWidth != null && maxWidth > 0) {
      for (const line of rawLines) {
        const wrapped = this.wrapLine(ctx, line, maxWidth - padX * 2);
        wrappedLines.push(...wrapped);
      }
    } else {
      wrappedLines.push(...rawLines);
    }

    // Measure the widest wrapped line to size the box
    let maxTextW = 0;
    for (const line of wrappedLines) {
      const w = ctx.measureText(line).width;
      if (w > maxTextW) maxTextW = w;
    }
    let boxW = maxTextW + padX * 2;
    // Constrain to chart width so the box never overflows horizontally
    if (boxW > chartW) boxW = chartW;
    const boxH = wrappedLines.length * lineHeight + padY * 2;

    // Position: top-left at anchor, offset by 4px so the anchor dot shows.
    // Flip horizontally if the box would overflow the right edge.
    let boxX = anchor.x + 4;
    if (boxX + boxW > chartW) boxX = Math.max(0, anchor.x - 4 - boxW);

    // Clamp Y to the visible chart area (with the full box height)
    const boxY = clampYToChartArea(anchor.y + 4, chart, boxH) - boxH / 2;

    // Background (optional)
    const showBg = d.data?.showBackground !== false;
    if (showBg) {
      const fillColor = d.data?.textFill ?? hexToRgba(d.color, 0.10, layout.textColor);
      ctx.fillStyle = fillColor;
      ctx.fillRect(boxX, boxY, boxW, boxH);
    }

    // Border (optional)
    const showBorder = d.data?.showBorder !== false;
    if (showBorder) {
      ctx.strokeStyle = d.data?.borderColor ?? d.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
    }

    // Text lines
    const textColor = d.data?.textColor ?? d.color;
    ctx.fillStyle = textColor;
    for (let i = 0; i < wrappedLines.length; i++) {
      ctx.fillText(wrappedLines[i], boxX + padX, boxY + padY + i * lineHeight);
    }

    // Anchor dot: show when showAnchorDot is not false (default visible),
    // OR when the drawing is selected/hovered (even if showAnchorDot is false)
    const showDot = d.data?.showAnchorDot !== false;
    if (showDot) {
      ctx.fillStyle = textColor;
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * Word-wrap a single line to fit within `maxWidth` pixels.
   * Returns an array of wrapped lines. Uses a greedy word-break algorithm
   * (break at the last space that fits). Long words without spaces are
   * broken at the character level.
   */
  private wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    if (maxWidth <= 0) return [text];
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const testLine = current ? current + ' ' + word : word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth <= maxWidth) {
        current = testLine;
      } else {
        if (current) {
          lines.push(current);
          current = '';
        }
        // Check if the word itself fits; if not, character-break it
        const wordWidth = ctx.measureText(word).width;
        if (wordWidth <= maxWidth) {
          current = word;
        } else {
          // Character-level break for very long words
          let chunk = '';
          for (const ch of word) {
            const testChunk = chunk + ch;
            if (ctx.measureText(testChunk).width <= maxWidth) {
              chunk = testChunk;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        }
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
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