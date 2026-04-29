import { Chart } from '../core/chart.js';
import { Crosshair } from '../ui/crosshair.js';

/**
 * Crosshair API
 *
 * Provides methods to control the crosshair overlay behavior and appearance,
 * including mode, labels, tooltip, and line styles.
 */
export class CrosshairAPI {
  constructor(private chart: Chart, private crosshair: Crosshair) {}

  /**
   * Set the crosshair mode
   * @param mode - Crosshair behavior mode
   *
   * Modes:
   * - 'normal': Crosshair follows mouse freely (currently same as magnet)
   * - 'magnet': Crosshair snaps to the nearest bar (xToIndex uses Math.round)
   * - 'none': Crosshair is completely hidden
   */
  setMode(mode: 'normal' | 'magnet' | 'none'): void {
    // Validate
    if (mode !== 'normal' && mode !== 'magnet' && mode !== 'none') {
      throw new Error(`CrosshairAPI.setMode: invalid mode "${mode}". Must be 'normal', 'magnet', or 'none'.`);
    }

    // Update options
    this.chart.options.crosshair.mode = mode;

    // Re-render (hides/shows crosshair immediately)
    this.crosshair.draw();
  }

  /**
   * Get the current crosshair mode
   * @returns Current mode: 'normal', 'magnet', or 'none'
   */
  getMode(): 'normal' | 'magnet' | 'none' {
    return this.chart.options.crosshair.mode ?? 'magnet';
  }

  /**
   * Show or hide the crosshair
   * @param visible - true to show, false to hide
   *
   * This is a convenience method that internally uses setMode()
   */
  setVisible(visible: boolean): void {
    this.setMode(visible ? this.getMode() : 'none');
  }

  /**
   * Check if crosshair is visible
   * @returns true if mode is not 'none'
   */
  isVisible(): boolean {
    return this.chart.options.crosshair.mode !== 'none';
  }

  /**
   * Enable or disable axis labels (price/time highlights)
   * @param show - true to show labels, false to hide
   *
   * Labels appear on the price axis (Y) and time axis (X) when crosshair is active.
   */
  setShowLabels(show: boolean): void {
    this.chart.options.crosshair.showLabels = show;
    this.crosshair.draw();
  }

  /**
   * Check if axis labels are enabled
   * @returns true if labels are shown
   */
  getShowLabels(): boolean {
    return this.chart.options.crosshair.showLabels ?? true;
  }

  /**
   * Enable or disable the OHLC tooltip
   * @param show - true to show tooltip, false to hide
   *
   * The tooltip appears in the top-left corner showing O/H/L/C values.
   */
  setShowTooltip(show: boolean): void {
    this.chart.options.crosshair.showTooltip = show;
    this.crosshair.draw();
  }

  /**
   * Check if tooltip is enabled
   * @returns true if tooltip is shown
   */
  getShowTooltip(): boolean {
    return this.chart.options.crosshair.showTooltip ?? true;
  }

  /**
   * Apply crosshair options
   * @param options - Partial crosshair options to apply
   *
   * Can update mode, labels, tooltip, and line styles.
   */
  setOptions(options: Partial<ChartOptions['crosshair']>): void {
    // Merge with existing options
    const currentOptions = this.chart.options.crosshair;
    const newOptions = { ...currentOptions, ...options };

    // Apply mode if specified
    if (options.mode) {
      this.setMode(options.mode);
    }

    // Apply showLabels if specified
    if (options.showLabels !== undefined) {
      this.setShowLabels(options.showLabels);
    }

    // Apply showTooltip if specified
    if (options.showTooltip !== undefined) {
      this.setShowTooltip(options.showTooltip);
    }

    // Apply vertical line options if specified
    if (options.vertLine) {
      this.chart.options.crosshair.vertLine = {
        ...this.chart.options.crosshair.vertLine,
        ...options.vertLine
      };
      this.crosshair.draw();
    }

    // Apply horizontal line options if specified
    if (options.horzLine) {
      this.chart.options.crosshair.horzLine = {
        ...this.chart.options.crosshair.horzLine,
        ...options.horzLine
      };
      this.crosshair.draw();
    }
  }

  /**
   * Get current crosshair options
   * @returns Copy of current crosshair options
   */
  getOptions(): ChartOptions['crosshair'] {
    return { ...this.chart.options.crosshair };
  }

  /**
   * Set vertical crosshair line style
   * @param options - Vertical line options (color, width, style)
   */
  setVerticalLine(options: { color?: string; width?: number; style?: 'solid' | 'dashed' }): void {
    this.setOptions({ vertLine: options });
  }

  /**
   * Set horizontal crosshair line style
   * @param options - Horizontal line options (color, width, style)
   */
  setHorizontalLine(options: { color?: string; width?: number; style?: 'solid' | 'dashed' }): void {
    this.setOptions({ horzLine: options });
  }
}
