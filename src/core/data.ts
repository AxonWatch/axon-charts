import { Bar } from '../types/index.js';
import { LAYOUT } from './layout.js';

/**
 * Manages chart data with automatic memory limits
 */
export class DataManager {
  private _data: Bar[] = [];
  private _maxBars: number;
  private _autoCleanup: boolean = true;

  constructor(maxBars: number = LAYOUT.DEFAULT_MAX_BARS) {
    this._maxBars = maxBars;
  }

  /**
   * Set auto cleanup preference
   */
  setAutoCleanup(enabled: boolean): void {
    this._autoCleanup = enabled;
  }

  /**
   * Set maximum bars limit and enforce it
   */
  setMaxBars(max: number): void {
    this._maxBars = max;
    this.enforceMaxLimit(true);
  }

  /**
   * Get all data
   */
  get data(): Bar[] {
    return this._data;
  }

  /**
   * Get number of bars
   */
  get length(): number {
    return this._data.length;
  }

  /**
   * Check if data is empty
   */
  get isEmpty(): boolean {
    return this._data.length === 0;
  }

  /**
   * Replace all data with new data
   */
  setData(bars: Bar[], autoCleanup = true): void {
    this._data = [...bars];
    this.enforceMaxLimit(autoCleanup);
  }

  /**
   * Append a new bar to the end
   */
  appendBar(bar: Bar): void {
    this._data.push(bar);
    this.enforceMaxLimit(this._autoCleanup);
  }

  /**
   * Update the last bar (for live updates)
   */
  updateLastBar(bar: Bar): void {
    if (this._data.length === 0) {
      this._data.push(bar);
      return;
    }

    const lastBar = this._data[this._data.length - 1];

    // If it's a new candle, append it
    if (bar.time !== lastBar.time) {
      this.appendBar(bar);
    } else {
      // Otherwise update the existing bar
      this._data[this._data.length - 1] = bar;
    }
  }

  /**
   * Get a bar by index
   */
  getBar(index: number): Bar | undefined {
    return this._data[index];
  }

  /**
   * Get bar at a specific timestamp
   */
  getBarAtTime(timestamp: number): Bar | undefined {
    // Binary search for efficiency
    let left = 0;
    let right = this._data.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const bar = this._data[mid];

      if (bar.time === timestamp) {
        return bar;
      } else if (bar.time < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return undefined;
  }

  /**
   * Calculate price range for visible bars
   */
  getPriceRange(startIdx: number, count: number, scaleMargins?: { top?: number; bottom?: number }): { min: number; max: number } {
    if (this._data.length === 0) {
      return LAYOUT.DEFAULT_PRICE_RANGE;
    }

    const end = Math.min(this._data.length, startIdx + count);
    let minP = Infinity;
    let maxP = -Infinity;

    for (let i = startIdx; i < end; i++) {
      const bar = this._data[i];
      if (!bar) continue;
      minP = Math.min(minP, bar.low);
      maxP = Math.max(maxP, bar.high);
    }

    // Add padding using scaleMargins if provided, otherwise use LAYOUT constant
    const topPadding = scaleMargins?.top ?? 0.1;
    const bottomPadding = scaleMargins?.bottom ?? 0.1;

    const range = maxP - minP;
    const totalPadding = range * (topPadding + bottomPadding) || 1;

    return {
      min: minP - totalPadding * (topPadding / (topPadding + bottomPadding)),
      max: maxP + totalPadding * (bottomPadding / (topPadding + bottomPadding))
    };
  }

  /**
   * Enforce maximum bar limit by removing oldest bars
   */
  enforceMaxLimit(shouldEnforce: boolean = true): void {
    if (!shouldEnforce) return;

    if (this._data.length > this._maxBars) {
      const excess = this._data.length - this._maxBars;
      this._data.splice(0, excess);
    }
  }

  /**
   * Get all data (read-only copy)
   */
  getData(): Bar[] {
    return [...this._data];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this._data = [];
  }
}
