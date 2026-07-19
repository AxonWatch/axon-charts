import type { IChart } from '../types/index.js';
import { indexToX, priceToY, xToIndex, yToPrice } from '../utils/projection.js';

/**
 * A resolved drawing anchor — screen coordinates + the bar index that
 * was used to derive them. Returned by resolveAnchor().
 */
export interface AnchorPoint {
  x: number;
  y: number;
  /** Resolved bar index (may differ from drawing.barIndex when time-based) */
  barIndex: number;
}

/**
 * Anchor spec — the fields a drawing uses to pin itself to the chart.
 * Both single-point and two-point drawings use this; two-point drawings
 * call resolveAnchor twice with {barIndex, time, price} and {barIndex2, time2, price2}.
 */
export interface AnchorSpec {
  barIndex?: number;
  time?: number;
  price: number;
}

/**
 * The inverse of resolveAnchor: given a screen point, resolve it back
 * to chart-data coordinates (time + price + barIndex). Used by the
 * drawing interaction layer to convert drag movements back into
 * anchor updates.
 *
 * X is snapped to the nearest bar center via xToIndex (the chart's
 * standard hit-testing function). Y is mapped to price via yToPrice
 * (handles linear/log/percentage/reverse modes).
 *
 * Returns null when the cursor is outside the data range (no bar to
 * snap to). Drag handlers should treat null as "skip the update" so
 * the drawing stays at its last valid position instead of jumping.
 *
 * The returned `time` is the snapped bar's actual timestamp — this is
 * what gets stored back on the drawing so the anchor survives
 * maxBars auto-cleanup.
 */
export function screenToAnchor(chart: IChart, x: number, y: number): { time: number; price: number; barIndex: number } | null {
  const { data } = chart.state;
  if (data.length === 0) return null;

  const barIndex = xToIndex(x, chart.state);
  if (barIndex < 0 || barIndex >= data.length) return null;

  const bar = data[barIndex];
  if (!bar) return null;

  const price = yToPrice(y, chart.state);
  if (!isFinite(price)) return null;

  return {
    time: bar.time,
    price,
    barIndex
  };
}

/**
 * Resolve a drawing anchor to a screen position.
 *
 * Prefers `time` (stable across bar cleanup via maxBars auto-cleanup)
 * over `barIndex` (which shifts when oldest bars are spliced out).
 * If `time` is provided, uses DataManager.getBarAtTime() (binary search)
 * to re-resolve the bar index. If only `barIndex` is provided, uses it
 * directly (legacy behavior).
 *
 * Returns null when the anchor cannot be resolved — e.g. the bar was
 * cleaned up and no time was provided. Callers should treat null as
 * "skip rendering this drawing" (do not throw).
 *
 * Uses indexToX and priceToY from the projection module (single source
 * of truth for coordinate mapping) so all drawing renderers produce
 * pixel-identical positions to the rest of the chart.
 */
export function resolveAnchor(chart: IChart, spec: AnchorSpec): AnchorPoint | null {
  const { data } = chart.state;
  if (data.length === 0) return null;

  let barIndex = spec.barIndex ?? -1;
  if (spec.time != null) {
    const found = chart.dataManager.getBarAtTime(spec.time);
    if (found) {
      barIndex = data.indexOf(found);
    }
  }
  if (barIndex < 0 || barIndex >= data.length) return null;

  return {
    x: indexToX(barIndex, chart.state),
    y: priceToY(spec.price, chart.state),
    barIndex
  };
}