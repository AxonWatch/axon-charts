import { PriceFormat } from '../types/index.js';
/**
 * Handles price formatting logic with auto-precision detection
 */
export declare class PriceFormatter {
    private format;
    private lastMeasurement;
    constructor(format?: PriceFormat);
    /**
     * Format a price value to a string
     */
    formatPrice(price: number): string;
    /**
     * Determine decimal precision based on options or auto-detection
     */
    getPrecision(): number;
    /**
     * Auto-detect required width for the price axis
     * Measures a 'worst case' price string using the current font
     */
    measureRequiredWidth(ctx: CanvasRenderingContext2D, minPrice: number, maxPrice: number): number;
    /**
     * Invalidate the measurement cache.
     * Call when data is replaced (symbol switch) so re-measurement uses fresh prices.
     */
    resetMeasurement(): void;
    private getPrecisionFromMinMove;
    private formatVolume;
}
//# sourceMappingURL=formatter.d.ts.map