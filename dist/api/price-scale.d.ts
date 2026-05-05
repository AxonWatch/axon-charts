import { Chart } from '../core/chart.js';
import { ChartOptions } from '../types/index.js';
/**
 * Price Scale API
 *
 * Provides methods to control the price scale (Y-axis) behavior,
 * including scale mode (linear/logarithmic) and scale margins.
 */
export declare class PriceScaleAPI {
    private chart;
    constructor(chart: Chart);
    /**
     * Set the price scale mode
     * @param mode - 'linear' for standard linear scale, 'logarithmic' for log scale
     */
    setMode(mode: 'linear' | 'logarithmic'): void;
    /**
     * Get the current price scale mode
     * @returns Current mode: 'linear' or 'logarithmic'
     */
    getMode(): 'linear' | 'logarithmic';
    /**
     * Set scale margins (padding at top/bottom as percentage 0-1)
     * @param margins - Object with top and bottom margins (0-1 range)
     * @throws Error if margins are out of range
     *
     * Note: Currently this option is accepted but not implemented in the price range calculation.
     * The DataManager uses a hardcoded LAYOUT.PRICE_PADDING_RATIO (0.07) instead.
     * This API is provided for future implementation and type compatibility.
     */
    setMargins(margins: {
        top: number;
        bottom: number;
    }): void;
    /**
     * Get the current scale margins
     * @returns Current margins object with top and bottom values
     */
    getMargins(): {
        top: number;
        bottom: number;
    };
    /**
     * Apply price scale options
     * @param options - Partial price scale options to apply
     */
    setOptions(options: Partial<ChartOptions['priceScale']>): void;
    /**
     * Get current price scale options
     * @returns Copy of current price scale options
     */
    getOptions(): ChartOptions['priceScale'];
}
//# sourceMappingURL=price-scale.d.ts.map