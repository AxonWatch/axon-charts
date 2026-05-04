import { PriceFormat } from '../types/index.js';

/**
 * Handles price formatting logic with auto-precision detection
 */
export class PriceFormatter {
  private format: PriceFormat;
  private lastMeasurement: { min: number; max: number; width: number } | null = null;

  constructor(format?: PriceFormat) {
    this.format = format || { type: 'price' };
  }

  /**
   * Format a price value to a string
   */
  public formatPrice(price: number): string {
    if (isNaN(price) || !isFinite(price)) return '0.00';

    if (this.format.type === 'custom' && this.format.formatter) {
      return this.format.formatter(price);
    }

    if (this.format.type === 'volume') {
      return this.formatVolume(price);
    }

    if (this.format.type === 'percent') {
      return price.toFixed(2) + '%';
    }

    // Default 'price' format
    const precision = this.getPrecision();
    return price.toFixed(precision);
  }

  /**
   * Determine decimal precision based on options or auto-detection
   */
  public getPrecision(): number {
    // 1. Manual precision takes priority
    if (this.format.precision !== undefined) {
      return this.format.precision;
    }

    // 2. Derive from minMove (e.g. 0.001 -> 3)
    if (this.format.minMove !== undefined) {
      return this.getPrecisionFromMinMove(this.format.minMove);
    }

    // 3. Fallback: No settings provided, use dynamic auto-detection
    return 2; // Standard default
  }

  /**
   * Auto-detect required width for the price axis
   * Measures a 'worst case' price string using the current font
   */
  public measureRequiredWidth(ctx: CanvasRenderingContext2D, minPrice: number, maxPrice: number): number {
    if (isNaN(minPrice) || isNaN(maxPrice)) return 60;

    // Check Cache: Only recalculate if price range changed significantly (>5%)
    if (this.lastMeasurement) {
      const rangeChanged = Math.abs(minPrice - this.lastMeasurement.min) > (minPrice * 0.05) ||
                          Math.abs(maxPrice - this.lastMeasurement.max) > (maxPrice * 0.05);
      if (!rangeChanged) {
        return this.lastMeasurement.width;
      }
    }
    
    // Create 'worst case' strings (longest possible)
    const longPrice = Math.max(Math.abs(minPrice), Math.abs(maxPrice));
    const testString = this.formatPrice(longPrice);

    // Measure and add padding
    const metrics = ctx.measureText(testString);
    const padding = 20;

    // Snap to 5px increments to avoid jitter
    const width = Math.ceil((metrics.width + padding) / 5) * 5;

    // Cache result
    this.lastMeasurement = { min: minPrice, max: maxPrice, width };
    return width;
  }

  /**
   * Invalidate the measurement cache.
   * Call when data is replaced (symbol switch) so re-measurement uses fresh prices.
   */
  public resetMeasurement(): void {
    this.lastMeasurement = null;
  }

  private getPrecisionFromMinMove(minMove: number): number {
    const s = minMove.toString();
    if (s.indexOf('.') === -1) return 0;
    return s.split('.')[1].length;
  }

  private formatVolume(price: number): string {
    if (price >= 1000000) return (price / 1000000).toFixed(2) + 'M';
    if (price >= 1000) return (price / 1000).toFixed(2) + 'K';
    return price.toFixed(0);
  }
}
