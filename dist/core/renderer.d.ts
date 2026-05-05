import { IChart } from '../types/index.js';
/**
 * Handles all canvas rendering logic for candles, grid, and UI elements
 */
export declare class Renderer {
    private chart;
    private candleBuffer;
    private bufferCtx;
    private lastBufferWidth;
    private axes;
    private bufferRenderStart;
    private bufferRenderEnd;
    constructor(chart: IChart);
    /**
     * Create or resize the offscreen buffer
     */
    createBuffer(): void;
    /**
     * Render candles to the offscreen buffer
     */
    renderCandles(): void;
    /**
     * Lightweight update: re-draw only the last candle in the buffer.
     * Skips clearing the entire buffer. Call this instead of renderCandles()
     * during high-frequency live ticks for ~10-20x faster updates.
     */
    updateLastCandleInBuffer(): void;
    private drawCandleToBuffer;
    drawBackground(ctx: CanvasRenderingContext2D, force?: boolean): void;
    drawViewport(mainCtx: CanvasRenderingContext2D): void;
    private drawCurrentPriceLine;
    private formatCountdown;
    private hexToRgba;
    private drawWatermark;
    private drawVolumeSubPane;
    private formatVolume;
    destroy(): void;
}
//# sourceMappingURL=renderer.d.ts.map