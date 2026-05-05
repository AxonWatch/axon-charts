import { Bar } from '../types/index.js';
/**
 * Manages chart data with automatic memory limits
 */
export declare class DataManager {
    private _data;
    private _maxBars;
    private _autoCleanup;
    constructor(maxBars?: number);
    /**
     * Set auto cleanup preference
     */
    setAutoCleanup(enabled: boolean): void;
    /**
     * Set maximum bars limit and enforce it
     */
    setMaxBars(max: number): void;
    /**
     * Get all data
     */
    get data(): Bar[];
    /**
     * Get number of bars
     */
    get length(): number;
    /**
     * Check if data is empty
     */
    get isEmpty(): boolean;
    /**
     * Replace all data with new data
     */
    setData(bars: Bar[], autoCleanup?: boolean): void;
    /**
     * Append a new bar to the end
     */
    appendBar(bar: Bar): void;
    /**
     * Update the last bar (for live updates)
     */
    updateLastBar(bar: Bar): void;
    /**
     * Get a bar by index
     */
    getBar(index: number): Bar | undefined;
    /**
     * Get bar at a specific timestamp
     */
    getBarAtTime(timestamp: number): Bar | undefined;
    /**
     * Get visible range of data
     */
    getVisibleRange(startIdx: number, count: number): {
        from: number;
        to: number;
    };
    /**
     * Calculate price range for visible bars
     */
    getPriceRange(startIdx: number, count: number, scaleMargins?: {
        top?: number;
        bottom?: number;
    }): {
        min: number;
        max: number;
    };
    /**
     * Enforce maximum bar limit by removing oldest bars
     */
    enforceMaxLimit(shouldEnforce?: boolean): void;
    /**
     * Get all data (read-only copy)
     */
    getData(): Bar[];
    /**
     * Clear all data
     */
    clear(): void;
}
//# sourceMappingURL=data.d.ts.map