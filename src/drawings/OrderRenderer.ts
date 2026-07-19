import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { priceToY } from '../utils/projection.js';
import { resolveAnchor } from './anchor.js';
import { hexToRgba, clampYToChartArea } from '../utils/style.js';
import { LAYOUT } from '../core/layout.js';
import type { DrawingRenderer } from './DrawingRenderer.js';

/**
 * Order type codes → human-readable label prefixes.
 * 'limit' / 'stop' / 'stop_limit' / 'market' — the data.kind field.
 * Market orders are rarely drawn (they fill immediately) but supported.
 */
const ORDER_KIND_LABELS: Record<string, string> = {
  limit:      'LIMIT',
  stop:       'STOP',
  stop_limit: 'STOP-LIMIT',
  market:     'MARKET',
};

/**
 * Renders a pending order on the chart.
 *
 * Visualizes a resting limit/stop order that hasn't filled yet. Draws
 * a dashed horizontal line at the order price spanning the chart width,
 * with a right-axis label showing the order side, kind, qty, and price.
 *
 * Complements the 'position' drawing type:
 *   - position = filled trade with entry marker + live PnL
 *   - order    = resting order with no entry marker, no PnL (not filled yet)
 *
 * Anchors: {barIndex|time, price} — the bar/time the order was placed
 * and the order price. The line extends from the anchor X to the right
 * edge of the chart area (orders project forward in time).
 *
 * Required data fields (in DrawingData):
 *   side: 'long' | 'short'  ('long' = buy order, 'short' = sell order)
 *   qty:  positive number
 *   kind: 'limit' | 'stop' | 'stop_limit' | 'market'
 *
 * Optional data fields:
 *   status: 'working' (default) | 'cancelled' | 'filled' | 'rejected'
 *           Renderers may style non-working orders differently in the
 *           future; currently all statuses render the same.
 *
 * Color logic:
 *   - Buy/long orders use chart.options.series.upColor (green)
 *   - Sell/short orders use chart.options.series.downColor (red)
 *   - Override with drawing.color if set
 *
 * Works in all scale modes (priceToY is the single source of truth).
 */
export class OrderRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    if (d.price == null) return;
    const { data, axisWidth } = chart.state;
    if (data.length === 0) return;

    // Resolve anchor to get the X where the order line starts.
    // Unlike position, an order doesn't have an entry marker at the
    // anchor — the line just starts at the anchor's X. If the anchor
    // can't be resolved (bar cleaned up + no time), start from x=0
    // so the order line is still visible.
    let startX = 0;
    if (d.time != null || d.barIndex != null) {
      const anchor = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
      if (anchor) startX = anchor.x;
    }

    const side = d.data?.side ?? 'long';
    const qty = d.data?.qty ?? 0;
    const kind = d.data?.kind ?? 'limit';
    const kindLabel = ORDER_KIND_LABELS[kind] ?? kind.toUpperCase();

    // Color: default to side-based (green for buy/long, red for sell/short),
    // overridable by drawing.color
    const sideColor = side === 'long'
      ? (chart.options.series.upColor ?? '#10B981')
      : (chart.options.series.downColor ?? '#E11D48');
    const lineColor = d.color ?? sideColor;

    const chartW = chart.state.w - axisWidth;
    const y = priceToY(d.price, chart.state);

    // (a) Dashed horizontal line from anchor X to the right edge
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(chartW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // (b) Right-axis label box: "SIDE KIND qty @ price"
    const labelH = 20;
    const labelY = clampYToChartArea(y, chart, labelH);
    const layout = chart.options.layout;

    const fmt = (p: number) => chart.priceFormatter.formatPrice(p);
    const sideStr = side === 'long' ? 'BUY' : 'SELL';
    const labelText = `${sideStr} ${kindLabel} ${qty} @ ${fmt(d.price)}`;

    ctx.font = `${layout.fontSize}px ${layout.fontFamily}`;
    const textW = ctx.measureText(labelText).width;
    const paddedW = Math.min(axisWidth, textW + 12);

    ctx.fillStyle = hexToRgba(lineColor, 0.18, layout.textColor);
    ctx.fillRect(chartW, labelY - labelH / 2, axisWidth, labelH);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(chartW, labelY - labelH / 2, axisWidth, labelH);

    ctx.fillStyle = lineColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, chart.state.w - LAYOUT.LABEL_OFFSET, labelY);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}