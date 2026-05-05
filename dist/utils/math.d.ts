/**
 * Calculate a nice step size for axis labels
 * @param range - The total range to display
 * @param targetTicks - Target number of ticks (default: 7)
 * @returns A nice step size
 */
export declare function niceStep(range: number, targetTicks?: number): number;
/**
 * Calculate appropriate time step based on bar width
 * @param barWidth - Current pixel width per bar
 * @returns Number of bars per label
 */
export declare function calculateTimeStep(barWidth: number): number;
/**
 * Calculate nice tick positions for an axis
 * @param min - Minimum value
 * @param max - Maximum value
 * @param targetTicks - Target number of ticks (default: 7)
 * @returns Array of tick positions
 */
export declare function niceTicks(min: number, max: number, targetTicks?: number): number[];
/**
 * Round a number to a specified number of decimal places
 */
export declare function roundTo(value: number, decimals: number): number;
/**
 * Clamp a value between min and max
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Get appropriate number of decimal places for price
 */
export declare function getPriceDecimals(price: number): number;
//# sourceMappingURL=math.d.ts.map