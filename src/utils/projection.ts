import { LAYOUT } from '../core/layout.js';

/**
 * Chart state interface for projection calculations
 */
export interface ChartState {
  h: number;
  w: number;
  priceMin: number;
  priceMax: number;
  offsetX: number;
  barWidth: number;
  baseBarWidth: number;
  rightGap: number;
  topMargin: number;
  bottomMargin: number;
  devicePixelRatio: number;
  priceScale: number;   // Vertical zoom factor
  priceOffset: number;  // Manual vertical pan offset
  priceScaleMode: 'linear' | 'logarithmic' | 'percentage';
  /** Reference price for percentage mode (first visible bar open) */
  referencePrice: number;
  chartBottom: number;
  subPaneHeight: number;
  axisWidth: number;
  /** Reverse price axis: false = normal (high at top), true = inverted (high at bottom) */
  reverse: boolean;
}

/**
 * Convert price to Y coordinate (screen space)
 * SINGLE SOURCE OF TRUTH for all vertical positioning
 * Sub-pixel precision (no rounding) for smooth rendering
 */
export function priceToY(price: number, state: ChartState): number {
  const chartBottom = state.chartBottom ?? (state.h - state.bottomMargin);
  const usableH = chartBottom - state.topMargin;
  let ratio: number;

  if (state.priceScaleMode === 'logarithmic') {
    const minLog = Math.log10(Math.max(state.priceMin, 0.01));
    const maxLog = Math.log10(Math.max(state.priceMax, 0.01));
    const priceLog = Math.log10(Math.max(price, 0.01));
    ratio = (priceLog - minLog) / (maxLog - minLog || 1);
  } else if (state.priceScaleMode === 'percentage' && state.referencePrice > 0) {
    const pct = ((price - state.referencePrice) / state.referencePrice) * 100;
    const priceRange = state.priceMax - state.priceMin || 1;
    ratio = (pct - state.priceMin) / priceRange;
  } else {
    const priceRange = state.priceMax - state.priceMin || 1;
    ratio = (price - state.priceMin) / priceRange;
  }

  // Reverse: flip ratio so low prices map to top of chart
  if (state.reverse) {
    ratio = 1 - ratio;
  }

  const baseY = chartBottom - (ratio * usableH);
  return baseY + state.priceOffset;
}

/**
 * Convert Y coordinate to price
 */
export function yToPrice(y: number, state: ChartState): number {
  const chartBottom = state.chartBottom ?? (state.h - state.bottomMargin);
  const usableH = chartBottom - state.topMargin;
  const adjustedY = y - state.priceOffset;
  let ratio = (chartBottom - adjustedY) / usableH;

  // Reverse: flip ratio back so user sees correct price at cursor
  if (state.reverse) {
    ratio = 1 - ratio;
  }

  if (state.priceScaleMode === 'logarithmic') {
    const minLog = Math.log10(Math.max(state.priceMin, 0.01));
    const maxLog = Math.log10(Math.max(state.priceMax, 0.01));
    const priceLog = minLog + ratio * (maxLog - minLog || 1);
    return Math.pow(10, priceLog);
  } else if (state.priceScaleMode === 'percentage' && state.referencePrice > 0) {
    const priceRange = state.priceMax - state.priceMin || 1;
    const pct = state.priceMin + (ratio * priceRange);
    return state.referencePrice * (1 + pct / 100);
  } else {
    const priceRange = state.priceMax - state.priceMin || 1;
    return state.priceMin + (ratio * priceRange);
  }
}

/**
 * Convert bar index to X coordinate (screen space) - CENTER ALIGNED
 * SINGLE SOURCE OF TRUTH for all horizontal positioning
 * Returns the CENTER of the bar (not left edge)
 * Uses sub-pixel precision (no Math.round) for smooth rendering
 */
export function indexToX(index: number, state: ChartState): number {
  // Guard against invalid inputs
  if (!isFinite(index) || state.barWidth <= 0 || !isFinite(state.offsetX)) {
    return 0;
  }

  const x = (index * state.barWidth) + state.offsetX + (state.barWidth / 2);
  return isNaN(x) || !isFinite(x) ? 0 : x;
}

/**
 * Convert X coordinate to bar index (for hit testing)
 * Magnetic Snap: Rounds to the nearest bar center
 */
export function xToIndex(x: number, state: ChartState): number {
  // Guard against invalid inputs that could produce NaN
  if (state.barWidth <= 0 || !isFinite(x) || !isFinite(state.offsetX)) {
    return 0;
  }

  const index = Math.round((x - state.offsetX - (state.barWidth / 2)) / state.barWidth);

  // Ensure we return a valid number
  return isNaN(index) || !isFinite(index) ? 0 : index;
}

/**
 * Derive visibleStartIdx from offsetX and barWidth
 * This should be used instead of storing visibleStartIdx as state
 */
export function deriveVisibleStartIdx(state: ChartState, totalBars: number): number {
  const firstVisible = Math.floor(-state.offsetX / state.barWidth);
  return Math.max(0, Math.min(firstVisible, totalBars - 1));
}

/**
 * Clamp offsetX to prevent "stuck" behavior and over-panning
 */
export function clampOffsetX(
  offsetX: number,
  barWidth: number,
  totalBars: number,
  screenWidth: number,
  rightGap: number,
  axisWidth: number
): number {
  const chartAreaWidth = screenWidth - axisWidth;

  // Max offsetX: First bar at left edge (0)
  const maxOffsetX = chartAreaWidth - (barWidth * 2);

  // Min offsetX: Last bar at right edge (prevents scrolling too far left)
  const minOffsetX = calculateRightEdgeOffset(totalBars, barWidth, screenWidth, rightGap, axisWidth);

  return Math.max(minOffsetX, Math.min(maxOffsetX, offsetX));
}

/**
 * Calculate the target offsetX to position the last candle at the right edge
 * with the user-defined margin (rightGap).
 */
export function calculateRightEdgeOffset(
  totalBars: number,
  barWidth: number,
  screenWidth: number,
  rightGap: number,
  axisWidth: number
): number {
  const chartAreaWidth = screenWidth - axisWidth;

  // target: Place the right edge of the last bar exactly at (chartAreaWidth - rightGap)
  // We add a 1px safety buffer to ensure the border/wick isn't clipped by the sidebar
  const targetRightEdge = chartAreaWidth - rightGap - 1;
  
  // RightEdge(i) = (i + 1) * barWidth + offsetX
  // offsetX = targetRightEdge - (totalBars * barWidth)
  
  return targetRightEdge - (totalBars * barWidth);
}
