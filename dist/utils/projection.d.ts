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
    priceScale: number;
    priceOffset: number;
    priceScaleMode: 'linear' | 'logarithmic';
    chartBottom: number;
}
/**
 * Convert price to Y coordinate (screen space)
 * SINGLE SOURCE OF TRUTH for all vertical positioning
 * Sub-pixel precision (no rounding) for smooth rendering
 */
export declare function priceToY(price: number, state: ChartState): number;
/**
 * Convert Y coordinate to price
 */
export declare function yToPrice(y: number, state: ChartState): number;
/**
 * Convert bar index to X coordinate (screen space) - CENTER ALIGNED
 * SINGLE SOURCE OF TRUTH for all horizontal positioning
 * Returns the CENTER of the bar (not left edge)
 * Uses sub-pixel precision (no Math.round) for smooth rendering
 */
export declare function indexToX(index: number, state: ChartState): number;
/**
 * Convert X coordinate to bar index (for hit testing)
 * Magnetic Snap: Rounds to the nearest bar center
 */
export declare function xToIndex(x: number, state: ChartState): number;
/**
 * Derive visibleStartIdx from offsetX and barWidth
 * This should be used instead of storing visibleStartIdx as state
 */
export declare function deriveVisibleStartIdx(state: ChartState, totalBars: number): number;
/**
 * Clamp offsetX to prevent "stuck" behavior and over-panning
 */
export declare function clampOffsetX(offsetX: number, barWidth: number, totalBars: number, screenWidth: number, rightGap: number, axisWidth: number): number;
/**
 * Calculate the target offsetX to position the last candle at the right edge
 * with the user-defined margin (rightGap).
 */
export declare function calculateRightEdgeOffset(totalBars: number, barWidth: number, screenWidth: number, rightGap: number, axisWidth: number): number;
//# sourceMappingURL=projection.d.ts.map