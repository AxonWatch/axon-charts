import { DataManager } from './data.js';
import { Renderer } from './renderer.js';
import { Crosshair } from '../ui/crosshair.js';
import { EventManager } from '../interaction/events.js';
import { ChartOptions, Bar, ScrollLockChangeCallback, ChartCommand, ChartState } from '../types/index.js';
import { PriceScaleAPI } from '../api/price-scale.js';
import { TimeScaleAPI } from '../api/time-scale.js';
import { CrosshairAPI } from '../api/crosshair.js';
/**
 * Main Chart class - Core candlestick chart implementation
 */
export declare class Chart {
    readonly container: HTMLElement;
    options: Required<ChartOptions>;
    private bgCanvas;
    private mainCanvas;
    private bgCtx;
    private mainCtx;
    crosshair: Crosshair;
    state: {
        w: number;
        h: number;
        devicePixelRatio: number;
        barWidth: number;
        baseBarWidth: number;
        offsetX: number;
        priceMin: number;
        priceMax: number;
        data: Bar[];
        rightGap: number;
        topMargin: number;
        bottomMargin: number;
        chartBottom: number;
        subPaneHeight: number;
        volumeScale: number;
        volumeOffset: number;
        priceScale: number;
        priceOffset: number;
        priceScaleMode: 'linear' | 'logarithmic';
        axisWidth: number;
    };
    dataManager: DataManager;
    renderer: Renderer;
    eventManager: EventManager;
    private priceFormatter;
    private priceScaleAPI;
    private timeScaleAPI;
    private crosshairAPI;
    private countdownRafId;
    private lastCountdownUpdate;
    onScrollLockChange?: ScrollLockChangeCallback;
    onCrosshairMove?: CrosshairMoveCallback;
    onBarClick?: BarClickCallback;
    onVisibleRangeChange?: VisibleRangeChangeCallback;
    private readonly handleResizeBound;
    private resizeObserver;
    private isResizing;
    constructor(container: HTMLElement | string, options?: ChartOptions);
    private initCanvases;
    resize(width?: number, height?: number): void;
    private updatePriceScale;
    private ensureRightGapAndRoll;
    render(): void;
    /**
     * Trigger onVisibleRangeChange callback with current visible range
     */
    triggerVisibleRangeChange(): void;
    setData(bars: Bar[]): void;
    appendBar(bar: Bar): void;
    updateLastBar(bar: Bar): void;
    /**
     * Lightweight live update for high-frequency tick streams.
     * Skips full buffer re-render, grid/axis redraw, and axis width re-measurement.
     * Only re-draws the last candle in the buffer and copies to screen.
     * ~10-20x faster than updateLastBar() for rapid stream updates.
     *
     * Use this when receiving 10+ ticks/second.
     * Fall back to updateLastBar() occasionally when the candle closes
     * so axes/grid catch up with any price range changes.
     */
    updateLastBarFast(bar: Bar): void;
    /**
     * Internal validation for Bar structure
     */
    private validateBar;
    getContext(): {
        viewport: {
            width: number;
            height: number;
            rightGap: number;
            visibleRange: {
                fromIndex: number;
                toIndex: number;
                fromTime: number;
                toTime: number;
            };
            priceRange: {
                min: number;
                max: number;
            };
            scales: {
                pricePerPixel: number;
                timePerBar: number;
                barWidth: number;
            };
        };
        state: {
            totalBars: number;
            isAutoScrolling: boolean;
        };
        visibleBars: Bar[];
        latestBar: Bar;
    };
    setOptions(partialOptions: Partial<ChartOptions>): void;
    private normalizePartialOptions;
    private normalizeOptions;
    getOptions(): Readonly<ChartOptions>;
    resetOptions(): void;
    /**
     * Start the real-time countdown timer loop
     */
    private startCountdownTimer;
    /**
     * Stop the countdown timer
     */
    private stopCountdownTimer;
    private restartCountdownTimer;
    destroy(): void;
    isAutoScrolling(): boolean;
    scrollToLatest(): void;
    /**
     * Get all chart data (returns a copy)
     */
    getData(): Bar[];
    /**
     * Get bar by index
     */
    getBar(index: number): Bar | undefined;
    /**
     * Get bar at specific timestamp
     */
    getBarAtTime(time: number): Bar | undefined;
    /**
     * Get range of bars
     */
    getBars(startIndex: number, count: number): Bar[];
    /**
     * Get bars in time range
     */
    getBarsInRange(startTime: number, endTime: number): Bar[];
    /**
     * Execute a command for LLM-driven chart control
     */
    execute(command: ChartCommand): void;
    /**
     * Export chart as PNG data URL
     */
    toDataURL(): string;
    /**
     * Export chart as Blob
     */
    toBlob(): Promise<Blob>;
    /**
     * Create export canvas with all chart layers merged
     */
    private createExportCanvas;
    /**
     * Save complete chart state
     */
    saveState(): ChartState;
    /**
     * Load chart state
     */
    loadState(state: ChartState): void;
    /**
     * Get the Price Scale API
     * Provides methods to control the Y-axis (price scale) behavior
     */
    priceScale(): PriceScaleAPI;
    /**
     * Get the Time Scale API
     * Provides methods to control the X-axis (time scale) behavior
     */
    timeScale(): TimeScaleAPI;
    /**
     * Get the Crosshair API
     * Provides methods to control the crosshair overlay behavior and appearance
     */
    crosshairAPI(): CrosshairAPI;
}
//# sourceMappingURL=chart.d.ts.map