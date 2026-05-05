import { Chart } from '../core/chart.js';
import { Crosshair } from '../ui/crosshair.js';
/**
 * Crosshair API
 *
 * Provides methods to control the crosshair overlay behavior and appearance,
 * including mode, labels, tooltip, and line styles.
 */
export declare class CrosshairAPI {
    private chart;
    private crosshair;
    constructor(chart: Chart, crosshair: Crosshair);
    /**
     * Set the crosshair mode
     * @param mode - Crosshair behavior mode
     *
     * Modes:
     * - 'normal': Crosshair follows mouse freely (currently same as magnet)
     * - 'magnet': Crosshair snaps to the nearest bar (xToIndex uses Math.round)
     * - 'none': Crosshair is completely hidden
     */
    setMode(mode: 'normal' | 'magnet' | 'none'): void;
    /**
     * Get the current crosshair mode
     * @returns Current mode: 'normal', 'magnet', or 'none'
     */
    getMode(): 'normal' | 'magnet' | 'none';
    /**
     * Show or hide the crosshair
     * @param visible - true to show, false to hide
     *
     * This is a convenience method that internally uses setMode()
     */
    setVisible(visible: boolean): void;
    /**
     * Check if crosshair is visible
     * @returns true if mode is not 'none'
     */
    isVisible(): boolean;
    /**
     * Enable or disable axis labels (price/time highlights)
     * @param show - true to show labels, false to hide
     *
     * Labels appear on the price axis (Y) and time axis (X) when crosshair is active.
     */
    setShowLabels(show: boolean): void;
    /**
     * Check if axis labels are enabled
     * @returns true if labels are shown
     */
    getShowLabels(): boolean;
    /**
     * Enable or disable the OHLC tooltip
     * @param show - true to show tooltip, false to hide
     *
     * The tooltip appears in the top-left corner showing O/H/L/C values.
     */
    setShowTooltip(show: boolean): void;
    /**
     * Check if tooltip is enabled
     * @returns true if tooltip is shown
     */
    getShowTooltip(): boolean;
    /**
     * Apply crosshair options
     * @param options - Partial crosshair options to apply
     *
     * Can update mode, labels, tooltip, and line styles.
     */
    setOptions(options: Partial<ChartOptions['crosshair']>): void;
    /**
     * Get current crosshair options
     * @returns Copy of current crosshair options
     */
    getOptions(): ChartOptions['crosshair'];
    /**
     * Set vertical crosshair line style
     * @param options - Vertical line options (color, width, style)
     */
    setVerticalLine(options: {
        color?: string;
        width?: number;
        style?: 'solid' | 'dashed';
    }): void;
    /**
     * Set horizontal crosshair line style
     * @param options - Horizontal line options (color, width, style)
     */
    setHorizontalLine(options: {
        color?: string;
        width?: number;
        style?: 'solid' | 'dashed';
    }): void;
}
//# sourceMappingURL=crosshair.d.ts.map