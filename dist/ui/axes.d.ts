import { IChart } from '../types/index.js';
/**
 * Handles price and time axis rendering
 */
export declare class Axes {
    private chart;
    constructor(chart: IChart);
    /**
     * Draw price axis with nice-tick algorithm
     * VIRTUAL: Derives prices from the current viewport boundaries
     */
    drawPriceAxis(ctx: CanvasRenderingContext2D): void;
    /**
     * Draw time axis with interval snapping
     * VIRTUAL & SNAPPED: Anchors to clean time boundaries (e.g. 13:00, 14:00)
     */
    drawTimeAxis(ctx: CanvasRenderingContext2D): void;
    /**
     * Format time label with date rollover
     */
    private formatTimeLabel;
    /**
     * Draw grid lines
     */
    drawGrid(ctx: CanvasRenderingContext2D): void;
}
//# sourceMappingURL=axes.d.ts.map