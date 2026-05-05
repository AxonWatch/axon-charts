import { Chart } from '../core/chart.js';
import { Bar } from '../types/index.js';
/**
 * Time Scale API
 *
 * Provides methods to control the time scale (X-axis) behavior,
 * including visible range, zooming, and scrolling to specific times.
 */
export declare class TimeScaleAPI {
    private chart;
    constructor(chart: Chart);
    /**
     * Set the visible time range
     * @param from - Start timestamp (milliseconds since epoch)
     * @param to - End timestamp (milliseconds since epoch)
     * @throws Error if from >= to or if timestamps are not found
     *
     * Adjusts barWidth and offsetX to fit the specified time range in view.
     */
    setVisibleRange(from: number, to: number): void;
    /**
     * Get the current visible time range
     * @returns Object with 'from' and 'to' timestamps
     *
     * Returns the actual timestamps visible on screen.
     */
    getVisibleRange(): {
        from: number;
        to: number;
    };
    /**
     * Scroll to a specific timestamp
     * @param timestamp - Target timestamp to scroll to
     * @param position - Where to position the bar: 'left', 'center', 'right' (default: 'right')
     * @throws Error if timestamp is not found
     *
     * Positions the bar with the given timestamp at the specified location.
     * Default is 'right' which aligns with the standard behavior (latest bar at right edge).
     */
    scrollToTime(timestamp: number, position?: 'left' | 'center' | 'right'): void;
    /**
     * Fit all data in view
     *
     * Adjusts zoom level to show all bars in the dataset.
     */
    fitContent(): void;
    /**
     * Get the screen x-coordinate for a given timestamp
     * @param timestamp - Target timestamp
     * @returns X-coordinate in pixels, or null if timestamp not found
     *
     * Returns the horizontal screen position for a bar with the given timestamp.
     * Useful for positioning drawings or annotations at specific times.
     */
    getCoordinate(timestamp: number): number | null;
    /**
     * Get the bar index closest to a given x-coordinate
     * @param x - Screen x-coordinate in pixels
     * @returns Bar index, or null if x is outside visible area
     *
     * Inverse of getCoordinate - finds which bar is at a screen position.
     */
    getBarIndex(x: number): number | null;
    /**
     * Get the bar closest to a given timestamp
     * @param timestamp - Target timestamp
     * @returns Bar object, or null if not found
     *
     * Useful for retrieving OHLC data for a specific time.
     */
    getBarAtTime(timestamp: number): Bar | null;
    /**
     * Zoom in by a factor
     * @param factor - Zoom multiplier (e.g., 1.5 for 50% zoom)
     * @param x - Optional x-coordinate to zoom toward (default: center of screen)
     *
     * Zooms in on the time scale, making bars wider.
     */
    zoomIn(factor?: number, x?: number): void;
    /**
     * Zoom out by a factor
     * @param factor - Zoom multiplier (e.g., 1.5 for 50% zoom out)
     * @param x - Optional x-coordinate to zoom from (default: center of screen)
     *
     * Zooms out on the time scale, making bars narrower.
     */
    zoomOut(factor?: number, x?: number): void;
    /**
     * Set the bar spacing (zoom level)
     * @param barSpacing - Width of each bar in pixels
     *
     * Directly controls the zoom level by setting bar width.
     */
    setBarSpacing(barSpacing: number): void;
    /**
     * Get the current bar spacing
     * @returns Current bar width in pixels
     */
    getBarSpacing(): number;
    /**
     * Apply time scale options
     * @param options - Partial time scale options to apply
     */
    setOptions(options: Partial<ChartOptions['timeScale']>): void;
    /**
     * Get current time scale options
     * @returns Copy of current time scale options
     */
    getOptions(): ChartOptions['timeScale'];
}
//# sourceMappingURL=time-scale.d.ts.map