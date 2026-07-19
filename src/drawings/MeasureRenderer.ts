import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { resolveAnchor } from './anchor.js';
import { hexToRgba, clampYToChartArea } from '../utils/style.js';
import type { DrawingRenderer } from './DrawingRenderer.js';

/**
 * Sets the canvas line dash pattern from a DrawingData.lineStyle value.
 * Shared by two-point renderers.
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
 * Renders a measurement annotation between two anchor points.
 *
 * The "drag to measure" tool. Draws a connector line between the two
 * anchors, a small dashed box around the second anchor, and a label
 * showing:
 *   - price delta (signed, with currency-like formatting)
 *   - percentage change
 *   - bar count between the two anchors
 *
 * Common uses: quick distance analysis, risk/reward measurement,
 * "what if I had entered here" checks.
 *
 * Anchors: {barIndex|time, price} and {barIndex2|time2, price2}.
 *
 * Optional data fields (in DrawingData):
 *   lineStyle: 'solid' (default) | 'dashed' | 'dotted'  (connector)
 *   lineWidth: number (default 1, connector width)
 *
 * The label is positioned near the second anchor (clamped to the
 * visible chart area) and color-coded green when the change is
 * positive, red when negative.
 */
export class MeasureRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    if (d.price == null || d.price2 == null) return;

    const a1 = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!a1) return;
    const a2 = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: d.price2 });
    if (!a2) return;

    const layout = chart.options.layout;
    const data = chart.state.data;
    const chartW = chart.state.w - chart.state.axisWidth;
    const price1 = d.price;
    const price2 = d.price2;
    const priceDelta = price2 - price1;
    const pctChange = price1 !== 0 ? (priceDelta / price1) * 100 : 0;
    const isUp = priceDelta >= 0;
    const labelColor = isUp
      ? (chart.options.series.upColor ?? '#10B981')
      : (chart.options.series.downColor ?? '#E11D48');

    // Bar count between anchors: resolve both anchors to bar indices
    // (resolveAnchor already did the work; reuse the returned barIndex)
    let barCount = 0;
    if (data.length > 0) {
      barCount = Math.abs(a2.barIndex - a1.barIndex);
    }

    // (a) Connector line between the two anchors
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.data?.lineWidth ?? 1;
    applyLineStyle(ctx, d.data?.lineStyle);
    ctx.beginPath();
    ctx.moveTo(a1.x, a1.y);
    ctx.lineTo(a2.x, a2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // (b) Small filled circles at both endpoints
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(a1.x, a1.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(a2.x, a2.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // (c) Label box near the second anchor showing price delta, %, bars
    const fmt = (p: number) => chart.priceFormatter.formatPrice(p);
    const sign = priceDelta >= 0 ? '+' : '';
    const line1 = `${sign}${fmt(priceDelta)}  (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`;
    const line2 = `${barCount} bar${barCount === 1 ? '' : 's'}`;

    ctx.font = `${layout.fontSize}px ${layout.fontFamily}`;
    const line1W = ctx.measureText(line1).width;
    const line2W = ctx.measureText(line2).width;
    const textW = Math.max(line1W, line2W);
    const labelH = 34;
    const boxW = textW + 12;

    // Position the label offset from the second anchor, clamped to chart area
    const desiredX = a2.x + 8;
    const desiredY = a2.y;
    const boxX = Math.max(2, Math.min(desiredX, chartW - boxW - 2));
    const boxY = clampYToChartArea(desiredY, chart, labelH) - labelH / 2;

    ctx.fillStyle = hexToRgba(labelColor, 0.15, layout.textColor);
    ctx.fillRect(boxX, boxY, boxW, labelH);
    ctx.strokeStyle = labelColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, labelH);

    ctx.fillStyle = labelColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(line1, boxX + 6, boxY + labelH / 2 - 7);
    ctx.fillStyle = layout.textColor ?? '#aaa';
    ctx.fillText(line2, boxX + 6, boxY + labelH / 2 + 7);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}