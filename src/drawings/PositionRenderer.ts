import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { LAYOUT } from '../core/layout.js';
import { hexToRgba, clampYToChartArea } from '../utils/style.js';
import { resolveAnchor } from './anchor.js';
import type { DrawingRenderer } from './DrawingRenderer.js';

/**
 * Renders a trading position on the chart.
 *
 * Visual components (all anchored to the entry bar/price):
 *   (a) Entry marker — small filled circle at (entryX, entryY)
 *   (b) Entry line — dashed line from the entry bar's X to the right
 *       edge of the chart area, drawn at the entry price Y
 *   (c) Stop-loss line — dashed line at the SL price, full chart width
 *       (only drawn when data.sl is set); colored with series.downColor
 *   (d) Take-profit line — dashed line at the TP price, full chart width
 *       (only drawn when data.tp is set); colored with series.upColor
 *   (e) Right-axis label box — two-line label showing:
 *         Line 1: "SIDE qty @ entryPrice"  (e.g. "LONG 0.5 @ 42150.5")
 *         Line 2: signed PnL, color-coded green/red
 *
 * PnL is recomputed every render using the latest bar's close as the
 * current price. Because renderDrawings() runs on every frame (including
 * the high-frequency updateLastBarFast path), the PnL updates live with
 * each tick.
 *
 * Anchoring: prefers `time` (stable across maxBars auto-cleanup) over
 * `barIndex` via resolveAnchor(). Returns without rendering if the
 * anchor can't be resolved (e.g. entry bar was cleaned up and no time
 * was provided).
 *
 * Scale modes: works in linear, logarithmic, and percentage modes
 * (priceToY is the single source of truth for Y mapping) and honors
 * the reverse-axis setting.
 */
export class PositionRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    if (d.price == null) return;
    const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!anchor) return;

    const { data, axisWidth } = chart.state;
    const lastBar = data[data.length - 1];
    if (!lastBar) return;

    const currentPrice = lastBar.close;
    const side = d.data?.side ?? 'long';
    const qty = d.data?.qty ?? 0;
    const entryPrice = d.price;

    // PnL: long profits when price rises, short profits when price falls
    const pnl = side === 'long'
      ? (currentPrice - entryPrice) * qty
      : (entryPrice - currentPrice) * qty;
    const isProfit = pnl >= 0;

    const entryColor = d.color;
    const pnlColor = isProfit
      ? (chart.options.series.upColor ?? '#10B981')
      : (chart.options.series.downColor ?? '#E11D48');

    const chartW = chart.state.w - axisWidth;

    // (a) Entry marker — filled circle at the entry point
    ctx.fillStyle = entryColor;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // (b) Entry line — dashed from entry bar X to right edge at entry price
    ctx.strokeStyle = entryColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(chartW, anchor.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // (c) Stop-loss line (optional)
    if (d.data?.sl != null) {
      const slY = priceToY(d.data.sl, chart.state);
      ctx.strokeStyle = chart.options.series.downColor ?? '#E11D48';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, slY);
      ctx.lineTo(chartW, slY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // (d) Take-profit line (optional)
    if (d.data?.tp != null) {
      const tpY = priceToY(d.data.tp, chart.state);
      ctx.strokeStyle = chart.options.series.upColor ?? '#10B981';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, tpY);
      ctx.lineTo(chartW, tpY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // (e) Right-axis label box — two lines: "SIDE qty @ entry" / signed PnL
    const labelH = 36;
    const labelY = clampYToChartArea(anchor.y, chart, labelH);

    ctx.fillStyle = hexToRgba(entryColor, 0.18, chart.options.layout.textColor);
    ctx.fillRect(chartW, labelY - labelH / 2, axisWidth, labelH);
    ctx.strokeStyle = entryColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(chartW, labelY - labelH / 2, axisWidth, labelH);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `${chart.options.layout.fontSize}px ${chart.options.layout.fontFamily}`;
    const fmt = (p: number) => chart.priceFormatter.formatPrice(p);

    // Line 1: side, qty, entry price (entry color)
    ctx.fillStyle = entryColor;
    ctx.fillText(
      `${side.toUpperCase()} ${qty} @ ${fmt(entryPrice)}`,
      chart.state.w - LAYOUT.LABEL_OFFSET,
      labelY - 8
    );

    // Line 2: signed PnL (green/red)
    ctx.fillStyle = pnlColor;
    const pnlSign = pnl >= 0 ? '+' : '';
    ctx.fillText(
      `${pnlSign}${fmt(pnl)}`,
      chart.state.w - LAYOUT.LABEL_OFFSET,
      labelY + 8
    );

    // Reset text alignment (matches Renderer's pattern)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}