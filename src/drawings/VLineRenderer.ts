import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { indexToX } from '../utils/projection.js';
import { chartBottomEdge } from '../utils/style.js';
import { resolveAnchor } from './anchor.js';
import type { DrawingRenderer, DrawingHandle } from './DrawingRenderer.js';

/**
 * Renders a vertical reference line spanning the chart height at a
 * given bar index.
 *
 * Verbatim port of the original 'vline' case in Renderer.renderDrawings().
 * Uses chartBottomEdge() from utils/style.ts for the bottom boundary.
 * Interactive: one body handle (drag to change the bar/time).
 */
export class VLineRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: 0 });
    if (!anchor) return;
    const cb = chartBottomEdge(chart);
    const x = anchor.x;

    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, cb);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  hitTest(x: number, y: number, chart: IChart, d: Drawing): boolean {
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: 0 });
    if (!anchor) return false;
    const cb = chartBottomEdge(chart);
    return Math.abs(x - anchor.x) <= 6 && y >= 0 && y <= cb;
  }

  getHandles(chart: IChart, d: Drawing): DrawingHandle[] {
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: 0 });
    if (!anchor) return [];
    const cb = chartBottomEdge(chart);
    // Body handle in the middle of the line
    return [{ id: 'body', x: anchor.x, y: cb / 2, cursor: 'ew-resize' }];
  }
}