import { IChart } from '../types/index.js';
/**
 * Crosshair overlay with OHLC tooltip
 */
export declare class Crosshair {
    private chart;
    private overlayCanvas;
    private overlayCtx;
    private x;
    private y;
    private visible;
    private handleMouseMove;
    private handleMouseLeave;
    constructor(chart: IChart);
    /**
     * Set up mouse event listeners
     */
    private setupEventListeners;
    /**
     * Find bar under cursor
     */
    private hitTest;
    /**
     * Get bar at index
     */
    private getBarAt;
    /**
     * Get price at Y coordinate
     * Uses unified projection system (same as renderer)
     */
    private getPriceAt;
    /**
     * Draw crosshair and tooltip
     */
    draw(): void;
    /**
     * Draw volume tooltip at top-left of the sub-pane
     */
    private drawVolumeTooltip;
    /**
     * Draw market header as top-left label inside chart area
     */
    private drawMarketHeader;
    /**
     * Draw OHLC legend in the top-left corner
     */
    private drawTooltip;
    /**
     * Format volume to human-readable string (K/M suffixes)
     */
    private formatVolume;
    /**
     * Draw price label on Y axis
     */
    private drawPriceLabel;
    /**
     * Draw time label on X axis
     */
    private drawTimeLabel;
    /**
     * Update crosshair position
     */
    setPosition(x: number, y: number): void;
    /**
     * Hide crosshair
     */
    hide(): void;
    /**
     * Resize overlay canvas
     */
    resize(w: number, h: number, devicePixelRatio: number): void;
    /**
     * Get overlay canvas (for screenshot export)
     */
    getOverlayCanvas(): HTMLCanvasElement | null;
    /**
     * Clean up
     */
    destroy(): void;
}
//# sourceMappingURL=crosshair.d.ts.map