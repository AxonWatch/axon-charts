import { Chart } from '../core/chart.js';
import { ChartOptions } from '../types/index.js';

/**
 * Price Scale API
 *
 * Provides methods to control the price scale (Y-axis) behavior,
 * including scale mode (linear/logarithmic) and scale margins.
 */
export class PriceScaleAPI {
  constructor(private chart: Chart) {}

  /**
   * Set the price scale mode
   * @param mode - 'linear' for standard linear scale, 'logarithmic' for log scale
   */
  setMode(mode: 'linear' | 'logarithmic'): void {
    // Validate
    if (mode !== 'linear' && mode !== 'logarithmic') {
      throw new Error(`PriceScaleAPI.setMode: invalid mode "${mode}". Must be 'linear' or 'logarithmic'.`);
    }

    // Update state
    this.chart.state.priceScaleMode = mode;
    this.chart.state.priceOffset = 0; // Reset offset when switching modes

    // Re-render
    this.chart.render();
  }

  /**
   * Get the current price scale mode
   * @returns Current mode: 'linear' or 'logarithmic'
   */
  getMode(): 'linear' | 'logarithmic' {
    return this.chart.state.priceScaleMode ?? 'linear';
  }

  /**
   * Set scale margins (padding at top/bottom as percentage 0-1)
   * @param margins - Object with top and bottom margins (0-1 range)
   * @throws Error if margins are out of range
   *
   * Note: Currently this option is accepted but not implemented in the price range calculation.
   * The DataManager uses a hardcoded LAYOUT.PRICE_PADDING_RATIO (0.07) instead.
   * This API is provided for future implementation and type compatibility.
   */
  setMargins(margins: { top: number; bottom: number }): void {
    // Validate
    if (typeof margins.top !== 'number' || margins.top < 0 || margins.top > 1) {
      throw new Error('PriceScaleAPI.setMargins: top margin must be a number between 0 and 1');
    }
    if (typeof margins.bottom !== 'number' || margins.bottom < 0 || margins.bottom > 1) {
      throw new Error('PriceScaleAPI.setMargins: bottom margin must be a number between 0 and 1');
    }

    // Store in options (will be used when DataManager is updated)
    if (!this.chart.options.priceScale.scaleMargins) {
      this.chart.options.priceScale.scaleMargins = { top: 0.1, bottom: 0.1 };
    }
    this.chart.options.priceScale.scaleMargins.top = margins.top;
    this.chart.options.priceScale.scaleMargins.bottom = margins.bottom;

    // Re-render (note: won't affect layout until DataManager uses this option)
    this.chart.render();
  }

  /**
   * Get the current scale margins
   * @returns Current margins object with top and bottom values
   */
  getMargins(): { top: number; bottom: number } {
    return this.chart.options.priceScale.scaleMargins || { top: 0.1, bottom: 0.1 };
  }

  /**
   * Reverse the price axis: high prices appear at bottom, low at top.
   * Common in crypto markets (reverse chart).
   * @param reverse - true for inverted axis, false for normal
   */
  setReverse(reverse: boolean): void {
    this.chart.state.reverse = reverse;
    this.chart.options.priceScale.reverse = reverse;
    this.chart.render();
  }

  /**
   * Get current reverse state
   */
  getReverse(): boolean {
    return this.chart.state.reverse ?? false;
  }

  /**
   * Apply price scale options
   * @param options - Partial price scale options to apply
   */
  setOptions(options: Partial<ChartOptions['priceScale']>): void {
    // Merge with existing options
    const currentOptions = this.chart.options.priceScale;
    const newOptions = { ...currentOptions, ...options };

    // Apply mode if specified
    if (options.mode) {
      this.setMode(options.mode);
    }

    // Apply margins if specified
    if (options.scaleMargins) {
      this.setMargins(options.scaleMargins);
    }

    // Apply price format if specified
    if (options.priceFormat) {
      this.chart.options.priceScale.priceFormat = options.priceFormat;
      // Recreate price formatter
      const { PriceFormatter } = require('../utils/formatter.js');
      this.chart['priceFormatter'] = new PriceFormatter(options.priceFormat);
      this.chart.render();
    }

    // Apply current price options if specified
    if (options.currentPrice) {
      this.chart.options.priceScale.currentPrice = {
        ...this.chart.options.priceScale.currentPrice,
        ...options.currentPrice
      };

      // Restart countdown timer if showCountdown changed
      if (options.currentPrice.showCountdown !== undefined) {
        this.chart['restartCountdownTimer']();
      }

      this.chart.render();
    }
  }

  /**
   * Get current price scale options
   * @returns Copy of current price scale options
   */
  getOptions(): ChartOptions['priceScale'] {
    return { ...this.chart.options.priceScale };
  }
}
