import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';
import { resolveAnchor } from './anchor.js';
import { hexToRgba } from '../utils/style.js';
import { priceToY } from '../utils/projection.js';
import type { DrawingRenderer, DrawingHandle } from './DrawingRenderer.js';

/**
 * Default Fibonacci retracement levels (as ratios of the swing range).
 * 0.0 = the second anchor (swing end), 1.0 = the first anchor (swing start).
 * Levels are drawn as horizontal lines spanning the chart width between
 * the two anchor X positions; each line gets a right-axis price label
 * colored by its tier.
 */
const DEFAULT_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * Color tiers for fib levels. Index 0 = uptrend bias (green-ish),
 * index 1 = neutral, index 2 = downtrend bias (red-ish). The renderer
 * picks the tier based on whether the retracement level is below 0.382
 * (shallow, uptrend-friendly), 0.382–0.618 (mid zone), or above 0.618
 * (deep, downtrend-friendly). All levels use semi-transparent fills so
 * the chart stays readable.
 */
const FIB_COLORS = {
  shallow: '#10B981',   // 0, 0.236
  mid:     '#f59e0b',   // 0.382, 0.5
  deep:    '#E11D48',   // 0.618, 0.786, 1
};

function tierColor(level: number): string {
  if (level <= 0.236) return FIB_COLORS.shallow;
  if (level <= 0.5)   return FIB_COLORS.mid;
  return FIB_COLORS.deep;
}

/**
 * Renders Fibonacci retracement levels between two anchor points.
 *
 * The two anchors define a swing: anchor 1 is the swing start, anchor 2
 * is the swing end. The renderer draws horizontal lines at the standard
 * retracement levels (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%) of
 * the price swing, spanning the chart width between the two anchor X
 * positions. Each level gets a right-axis price label.
 *
 * Direction-agnostic: works for both uptrend retracements (anchor 1
 * low, anchor 2 high) and downtrend retracements (anchor 1 high,
 * anchor 2 low). The renderer computes priceAtLevel as:
 *   priceAtLevel = price2 + (price1 - price2) * level
 * so level=0 is at price2 (the swing end), level=1 is at price1 (the
 * swing start).
 *
 * Anchors: {barIndex|time, price} and {barIndex2|time2, price2}.
 *
 * Optional data fields (in DrawingData):
 *   fill:      CSS color override for all level labels (if set, overrides
 *              the tier coloring). Rarely used — the tier coloring is
 *              the default and conveys information.
 *   lineWidth: stroke width in pixels (default 1)
 *
 * If `text` is set, it's drawn as a header label above the first
 * fib level (e.g. "Fib Retracement").
 *
 * Future extension (not implemented in this commit): allow callers to
 * pass data.levels as a custom array of ratios to override the defaults.
 */
export class FibRetracementRenderer implements DrawingRenderer {
  render(ctx: CanvasRenderingContext2D, chart: IChart, d: Drawing): void {
    if (d.price == null || d.price2 == null) return;

    const a1 = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!a1) return;
    const a2 = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: d.price2 });
    if (!a2) return;

    const chartW = chart.state.w - chart.state.axisWidth;
    const axisWidth = chart.state.axisWidth;
    const leftX = Math.min(a1.x, a2.x);
    const rightX = Math.max(a1.x, a2.x);
    const price1 = d.price;
    const price2 = d.price2;
    const lw = d.data?.lineWidth ?? 1;
    const layout = chart.options.layout;

    // Optional header text above the first level
    if (d.text) {
      ctx.font = `${layout.fontSize}px ${layout.fontFamily}`;
      const text = d.text;
      const tw = ctx.measureText(text).width;
      const headerY = Math.min(a1.y, a2.y) - 18;
      const boxX = Math.max(2, leftX);

      ctx.fillStyle = hexToRgba(d.color, 0.15, layout.textColor);
      ctx.fillRect(boxX, headerY, tw + 8, 16);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, headerY, tw + 8, 16);
      ctx.fillStyle = d.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, boxX + 4, headerY + 2);
      ctx.textBaseline = 'alphabetic';
    }

    // Each fib level: horizontal line from leftX to rightX + right-axis label
    ctx.font = `${layout.fontSize}px ${layout.fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const level of DEFAULT_FIB_LEVELS) {
      const priceAtLevel = price2 + (price1 - price2) * level;
      // Y position via the single source of truth (handles log/percentage/reverse)
      const y = this.priceToYSafe(chart, priceAtLevel);
      if (y == null) continue;

      const color = d.data?.fill ?? tierColor(level);

      // Horizontal line between the two anchor X positions
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(leftX, y);
      ctx.lineTo(rightX, y);
      ctx.stroke();

      // Right-axis label: "level%  price"
      const label = `${(level * 100).toFixed(1)}%  ${chart.priceFormatter.formatPrice(priceAtLevel)}`;
      const labelH = 16;
      ctx.fillStyle = hexToRgba(color, 0.18, layout.textColor);
      ctx.fillRect(chartW, y - labelH / 2, axisWidth, labelH);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(chartW, y - labelH / 2, axisWidth, labelH);
      ctx.fillStyle = color;
      ctx.fillText(label, chart.state.w - 15, y);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.setLineDash([]);
  }

  /**
   * Wrapper around priceToY that returns null for non-finite prices
   * (e.g. negative prices in log mode). Lets the renderer skip levels
   * that can't be mapped to a Y coordinate instead of drawing at NaN.
   */
  private priceToYSafe(chart: IChart, price: number): number | null {
    if (!isFinite(price)) return null;
    // In log mode, negative/zero prices can't be mapped — priceToY
    // clamps to 0.01 internally, but the resulting Y may be off-chart.
    // We let priceToY handle it and rely on the caller's label clamping.
    return priceToY(price, chart.state);
  }

  hitTest(x: number, y: number, chart: IChart, d: Drawing): boolean {
    if (d.price == null || d.price2 == null) return false;
    const a1 = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!a1) return false;
    const a2 = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: d.price2 });
    if (!a2) return false;
    const left = Math.min(a1.x, a2.x);
    const right = Math.max(a1.x, a2.x);
    const price1 = d.price;
    const price2 = d.price2;
    const minY = Math.min(priceToY(price1, chart.state), priceToY(price2, chart.state));
    const maxY = Math.max(priceToY(price1, chart.state), priceToY(price2, chart.state));
    return x >= left && x <= right && y >= minY && y <= maxY;
  }

  getHandles(chart: IChart, d: Drawing): DrawingHandle[] {
    if (d.price == null || d.price2 == null) return [];
    const a1 = resolveAnchor(chart, { barIndex: d.barIndex, time: d.time, price: d.price });
    if (!a1) return [];
    const a2 = resolveAnchor(chart, { barIndex: d.barIndex2, time: d.time2, price: d.price2 });
    if (!a2) return [];
    return [
      { id: 'p1', x: a1.x, y: a1.y, cursor: 'move' },
      { id: 'p2', x: a2.x, y: a2.y, cursor: 'move' },
    ];
  }
}
