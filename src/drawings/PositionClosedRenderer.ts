import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { resolveAnchor } from './anchor.js';
import { hexToRgba, clampYToChartArea } from '../utils/style.js';
import { LAYOUT } from '../core/layout.js';
import type { DrawingRenderer, DrawingHandle } from './DrawingRenderer.js';

/**
 * Renders a closed trading position — a trade that has been opened
 * AND exited. Complements the 'position' drawing type:
 *   - position        = open trade with live unrealized PnL
 *   - position_closed = closed trade with entry+exit markers and
 *                       fixed realized PnL
 *
 * Visual components:
 *   (a) Entry marker — filled circle at (entryX, entryY)
 *   (b) Exit marker  — small hollow square at (exitX, exitY)
 *   (c) Connector line — solid line from entry to exit (the trade's
 *       "lifespan" on the chart)
 *   (d) Entry dashed line — from entry X to exit X at entry price
 *       (shows the entry level during the trade's lifetime)
 *   (e) Exit dashed line — from exit X to right edge at exit price
 *       (shows where the trade closed)
 *   (f) Right-axis label box — two lines:
 *         Line 1: 'SIDE qty  in:entryPrice  out:exitPrice'
 *         Line 2: realized PnL (green for profit, red for loss)
 *
 * PnL is computed at render time from the entry and exit prices
 * (both fixed — this is a closed trade, so PnL doesn't change):
 *   long:  pnl = (exitPrice - entryPrice) * qty
 *   short: pnl = (entryPrice - exitPrice) * qty
 *
 * Anchors: two points — entry and exit:
 *   entry: {barIndex|time, price}        — entry bar/time + entry price
 *   exit:  {barIndex2|time2, price2}     — exit bar/time + exit price
 *
 * Required data fields (in DrawingData):
 *   side: 'long' | 'short'
 *   qty:  positive number
 *
 * Optional data fields:
 *   status: 'closed' (default) | 'cancelled'  (rare; cancelled
 *           orders that were briefly open could use this)
 *
 * Works in all scale modes (priceToY is the single source of truth).
 */
export class PositionClosedRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    if (d.price == null || d.price2 == null) return;

    const entry = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!entry) return;
    const exit = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: d.price2 });
    if (!exit) return;

    const { axisWidth } = chart.state;
    const side = d.data?.side ?? 'long';
    const qty = d.data?.qty ?? 0;
    const entryPrice = d.price;
    const exitPrice = d.price2;

    // Realized PnL (fixed — trade is closed)
    const pnl = side === 'long'
      ? (exitPrice - entryPrice) * qty
      : (entryPrice - exitPrice) * qty;
    const isProfit = pnl >= 0;

    const entryColor = d.color;
    const pnlColor = isProfit
      ? (chart.options.series.upColor ?? '#10B981')
      : (chart.options.series.downColor ?? '#E11D48');
    const exitColor = pnlColor; // exit marker color reflects win/loss

    const chartW = chart.state.w - axisWidth;

    // (a) Entry marker — filled circle
    ctx.fillStyle = entryColor;
    ctx.beginPath();
    ctx.arc(entry.x, entry.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // (b) Exit marker — hollow square (4x4 outline)
    ctx.strokeStyle = exitColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(exit.x - 3, exit.y - 3, 6, 6);

    // (c) Connector line — entry to exit (trade lifespan)
    ctx.strokeStyle = hexToRgba(entryColor, 0.6, chart.options.layout.textColor);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(entry.x, entry.y);
    ctx.lineTo(exit.x, exit.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // (d) Entry dashed line — entry X to exit X at entry price
    ctx.strokeStyle = entryColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(entry.x, entry.y);
    ctx.lineTo(exit.x, entry.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // (e) Exit dashed line — exit X to right edge at exit price
    ctx.strokeStyle = exitColor;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(exit.x, exit.y);
    ctx.lineTo(chartW, exit.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // (f) Right-axis label box at the exit price Y
    const labelH = 36;
    const labelY = clampYToChartArea(exit.y, chart, labelH);
    const layout = chart.options.layout;
    const fmt = (p: number) => chart.priceFormatter.formatPrice(p);

    ctx.fillStyle = hexToRgba(exitColor, 0.18, layout.textColor);
    ctx.fillRect(chartW, labelY - labelH / 2, axisWidth, labelH);
    ctx.strokeStyle = exitColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(chartW, labelY - labelH / 2, axisWidth, labelH);

    ctx.font = `${layout.fontSize ?? 12}px ${layout.fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Line 1: SIDE qty  in:entry  out:exit
    ctx.fillStyle = entryColor;
    const sideStr = side === 'long' ? 'LONG' : 'SHORT';
    ctx.fillText(
      `${sideStr} ${qty}  in:${fmt(entryPrice)}  out:${fmt(exitPrice)}`,
      chart.state.w - LAYOUT.LABEL_OFFSET,
      labelY - 8
    );

    // Line 2: realized PnL (green/red)
    ctx.fillStyle = pnlColor;
    const pnlSign = pnl >= 0 ? '+' : '';
    ctx.fillText(
      `${pnlSign}${fmt(pnl)}`,
      chart.state.w - LAYOUT.LABEL_OFFSET,
      labelY + 8
    );

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  hitTest(x: number, y: number, chart: IChart, d: Drawing): boolean {
    if (d.price == null || d.price2 == null) return false;
    const entry = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!entry) return false;
    const exit = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: d.price2 });
    if (!exit) return false;
    return pointToSegmentDistance(x, y, entry.x, entry.y, exit.x, exit.y) <= 6;
  }

  getHandles(chart: IChart, d: Drawing): DrawingHandle[] {
    if (d.price == null || d.price2 == null) return [];
    const entry = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!entry) return [];
    const exit = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: d.price2 });
    if (!exit) return [];
    return [
      { id: 'p1', x: entry.x, y: entry.y, cursor: 'move' },
      { id: 'p2', x: exit.x, y: exit.y, cursor: 'move' },
    ];
  }
}

function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
