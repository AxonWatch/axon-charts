import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { resolveAnchor } from './anchor.js';
import { chartBottomEdge, clampYToChartArea } from '../utils/style.js';
import { hexToRgba } from '../utils/style.js';
import { LAYOUT } from '../core/layout.js';
import type { DrawingRenderer } from './DrawingRenderer.js';

/**
 * Sets the canvas line dash pattern from a DrawingData.lineStyle value.
 * Shared by TrendlineRenderer and future two-point renderers.
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
 * Compute the extended endpoints of a 2-point line.
 *
 * Given two anchor points (x1,y1) and (x2,y2), extend the line to the
 * chart boundaries based on the `extend` mode:
 *   'none'  — draw exactly between the two anchors
 *   'left'  — extend backward from (x1,y1) to x=0
 *   'right' — extend forward from (x2,y2) to x=chartW
 *   'both'  — extend in both directions
 *
 * Vertical lines (x1 === x2) cannot be extended horizontally and are
 * returned as-is (use vline for vertical reference lines).
 */
function extendLine(
  x1: number, y1: number,
  x2: number, y2: number,
  extend: string | undefined,
  chartW: number
): { startX: number; startY: number; endX: number; endY: number } {
  let startX = x1, startY = y1, endX = x2, endY = y2;
  const dx = x2 - x1;

  if (dx === 0) {
    return { startX, startY, endX, endY };
  }

  const slope = (y2 - y1) / dx;

  if (extend === 'left' || extend === 'both') {
    startX = 0;
    startY = y1 + (0 - x1) * slope;
  }
  if (extend === 'right' || extend === 'both') {
    endX = chartW;
    endY = y2 + (chartW - x2) * slope;
  }

  return { startX, startY, endX, endY };
}

/**
 * Renders a trendline between two anchor points.
 *
 * The most-used drawing in technical analysis. Connects two
 * user-chosen points on the chart with a straight line, optionally
 * extending beyond either or both anchors.
 *
 * Anchors: two points — {barIndex|time, price} and {barIndex2|time2, price2}.
 * Both anchors are resolved via resolveAnchor() (prefers time over
 * barIndex for stability across maxBars cleanup).
 *
 * Data fields (all optional, in DrawingData):
 *   extend:     'none' | 'left' | 'right' | 'both'  (default 'none')
 *   lineStyle:  'solid' | 'dashed' | 'dotted'        (default 'solid')
 *   lineWidth:  number                                (default 1)
 *
 * If `text` is set on the drawing, a small label is drawn at the
 * second anchor (end point) showing the text. The label is clamped
 * to the visible chart area.
 */
export class TrendlineRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    if (d.price == null || d.price2 == null) return;

    const a1 = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!a1) return;
    const a2 = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: d.price2 });
    if (!a2) return;

    const chartW = chart.state.w - chart.state.axisWidth;
    const extend = d.data?.extend ?? 'none';
    const line = extendLine(a1.x, a1.y, a2.x, a2.y, extend, chartW);

    // Draw the line
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.data?.lineWidth ?? 1;
    applyLineStyle(ctx, d.data?.lineStyle);

    ctx.beginPath();
    ctx.moveTo(line.startX, line.startY);
    ctx.lineTo(line.endX, line.endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Optional text label at the end point (second anchor or extended end)
    if (d.text) {
      const labelX = line.endX;
      const labelY = clampYToChartArea(line.endY, chart, 16);
      const text = d.text;

      ctx.font = `${chart.options.layout.fontSize}px ${chart.options.layout.fontFamily}`;
      const tw = ctx.measureText(text).width;

      // Position the label just inside the chart area near the end point
      const boxX = Math.min(labelX, chartW - tw - 8);
      const boxY = labelY - 8;

      ctx.fillStyle = hexToRgba(d.color, 0.15, chart.options.layout.textColor);
      ctx.fillRect(boxX, boxY, tw + 8, 16);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, tw + 8, 16);

      ctx.fillStyle = d.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, boxX + 4, labelY);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }
}