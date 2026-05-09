import { Chart } from '../core/chart.js';
import { indexToX, xToIndex, deriveVisibleStartIdx, calculateRightEdgeOffset } from '../utils/projection.js';
import { Bar, ChartOptions } from '../types/index.js';

/**
 * Time Scale API
 *
 * Provides methods to control the time scale (X-axis) behavior,
 * including visible range, zooming, and scrolling to specific times.
 */
export class TimeScaleAPI {
  constructor(private chart: Chart) {}

  /**
   * Set the visible time range
   * @param from - Start timestamp (milliseconds since epoch)
   * @param to - End timestamp (milliseconds since epoch)
   * @throws Error if from >= to or if timestamps are not found
   *
   * Adjusts barWidth and offsetX to fit the specified time range in view.
   */
  setVisibleRange(from: number, to: number): void {
    // Validate
    if (from >= to) {
      throw new Error('TimeScaleAPI.setVisibleRange: "from" must be less than "to"');
    }

    const data = this.chart.dataManager.data;
    if (data.length === 0) {
      throw new Error('TimeScaleAPI.setVisibleRange: No data available');
    }

    // Find indices for the timestamps
    const fromIdx = data.findIndex(bar => bar.time >= from);
    const toIdx = data.findIndex(bar => bar.time >= to);

    if (fromIdx === -1) {
      throw new Error(`TimeScaleAPI.setVisibleRange: Start timestamp ${from} not found in data`);
    }
    if (toIdx === -1) {
      throw new Error(`TimeScaleAPI.setVisibleRange: End timestamp ${to} not found in data`);
    }

    // Calculate bar width to fit this range in the visible area
    const barCount = toIdx - fromIdx + 1;
    const { w, axisWidth } = this.chart.state;
    const chartWidth = w - axisWidth;
    const newBarWidth = chartWidth / barCount;

    // Apply bar width (with limits)
    this.chart.state.barWidth = Math.max(
      this.chart.options.timeScale.minBarSpacing || 4,
      Math.min(
        this.chart.options.timeScale.maxBarSpacing || 1000,
        newBarWidth
      )
    );

    // Calculate offset to position the range
    // We want 'fromIdx' to be at the left edge (x=0)
    // indexToX: x = (index - 1 - offsetX) * barWidth
    // When x=0: 0 = (fromIdx - 1 - offsetX) * barWidth
    // => offsetX = fromIdx - 1
    this.chart.state.offsetX = fromIdx - 1;

    // Re-render
    this.chart.render();
  }

  /**
   * Get the current visible time range
   * @returns Object with 'from' and 'to' timestamps
   *
   * Returns the actual timestamps visible on screen.
   */
  getVisibleRange(): { from: number; to: number } {
    const data = this.chart.dataManager.data;
    if (data.length === 0) {
      return { from: 0, to: 0 };
    }

    const { w, barWidth, axisWidth } = this.chart.state;
    const chartWidth = w - axisWidth;

    // Get visible indices
    const startIdx = deriveVisibleStartIdx(this.chart.state, data.length);
    const endIdx = Math.min(
      startIdx + Math.ceil(chartWidth / barWidth) + 1,
      data.length - 1
    );

    return {
      from: data[startIdx]?.time ?? 0,
      to: data[Math.max(0, endIdx)]?.time ?? 0
    };
  }

  /**
   * Scroll to a specific timestamp
   * @param timestamp - Target timestamp to scroll to
   * @param position - Where to position the bar: 'left', 'center', 'right' (default: 'right')
   * @throws Error if timestamp is not found
   *
   * Positions the bar with the given timestamp at the specified location.
   * Default is 'right' which aligns with the standard behavior (latest bar at right edge).
   */
  scrollToTime(timestamp: number, position: 'left' | 'center' | 'right' = 'right'): void {
    const data = this.chart.dataManager.data;
    if (data.length === 0) {
      throw new Error('TimeScaleAPI.scrollToTime: No data available');
    }

    // Find the bar with this timestamp
    const idx = data.findIndex(bar => bar.time === timestamp);
    if (idx === -1) {
      throw new Error(`TimeScaleAPI.scrollToTime: Timestamp ${timestamp} not found in data`);
    }

    const { w, barWidth, axisWidth } = this.chart.state;
    const chartWidth = w - axisWidth;

    // Calculate offsetX based on position
    // indexToX: x = (index - 1 - offsetX) * barWidth
    // => offsetX = index - 1 - (x / barWidth)

    let targetX: number;
    switch (position) {
      case 'left':
        targetX = 0;
        break;
      case 'center':
        targetX = chartWidth / 2;
        break;
      case 'right':
      default:
        targetX = chartWidth - barWidth; // Right edge, minus one bar width
        break;
    }

    this.chart.state.offsetX = idx - 1 - (targetX / barWidth);

    // Re-render
    this.chart.render();
  }

  /**
   * Fit all data in view
   *
   * Adjusts zoom level to show all bars in the dataset.
   */
  fitContent(): void {
    const data = this.chart.dataManager.data;
    if (data.length === 0) {
      return;
    }

    const { w, axisWidth, rightGap } = this.chart.state;
    const chartWidth = w - axisWidth;

    // Calculate bar width to show all bars
    const newBarWidth = chartWidth / data.length;

    // Apply bar width (with minimum limit)
    this.chart.options.timeScale.barSpacing = Math.max(
      this.chart.options.timeScale.minBarSpacing || 4,
      newBarWidth
    );
    this.chart.state.barWidth = this.chart.options.timeScale.barSpacing;

    // Position to show all data starting from left
    this.chart.state.offsetX = calculateRightEdgeOffset(
      data.length,
      this.chart.state.barWidth,
      this.chart.state.w,
      rightGap,
      axisWidth
    );

    // Re-render
    this.chart.render();
  }

  /**
   * Get the screen x-coordinate for a given timestamp
   * @param timestamp - Target timestamp
   * @returns X-coordinate in pixels, or null if timestamp not found
   *
   * Returns the horizontal screen position for a bar with the given timestamp.
   * Useful for positioning drawings or annotations at specific times.
   */
  getCoordinate(timestamp: number): number | null {
    const data = this.chart.dataManager.data;
    if (data.length === 0) {
      return null;
    }

    // Find the bar with this timestamp
    const idx = data.findIndex(bar => bar.time === timestamp);
    if (idx === -1) {
      return null;
    }

    // Convert index to x-coordinate
    return indexToX(idx, this.chart.state);
  }

  /**
   * Get the bar index closest to a given x-coordinate
   * @param x - Screen x-coordinate in pixels
   * @returns Bar index, or null if x is outside visible area
   *
   * Inverse of getCoordinate - finds which bar is at a screen position.
   */
  getBarIndex(x: number): number | null {
    const data = this.chart.dataManager.data;
    if (data.length === 0) {
      return null;
    }

    const idx = xToIndex(x, this.chart.state);
    if (idx < 0 || idx >= data.length) {
      return null;
    }

    return idx;
  }

  /**
   * Get the bar closest to a given timestamp
   * @param timestamp - Target timestamp
   * @returns Bar object, or null if not found
   *
   * Useful for retrieving OHLC data for a specific time.
   */
  getBarAtTime(timestamp: number): Bar | null {
    const data = this.chart.dataManager.data;
    if (data.length === 0) {
      return null;
    }

    // Binary search for the bar
    let left = 0;
    let right = data.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const bar = data[mid];

      if (bar.time === timestamp) {
        return bar;
      } else if (bar.time < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return null;
  }

  /**
   * Zoom in by a factor
   * @param factor - Zoom multiplier (e.g., 1.5 for 50% zoom)
   * @param x - Optional x-coordinate to zoom toward (default: center of screen)
   *
   * Zooms in on the time scale, making bars wider.
   */
  zoomIn(factor: number = 1.5, x?: number): void {
    const { w, barWidth, axisWidth } = this.chart.state;
    const chartWidth = w - axisWidth;

    // Calculate new bar width
    const newBarWidth = barWidth * factor;

    // Apply limits
    const maxBarWidth = this.chart.options.timeScale.maxBarSpacing || 1000;
    const minBarWidth = this.chart.options.timeScale.minBarSpacing || 4;

    if (newBarWidth > maxBarWidth || newBarWidth < minBarWidth) {
      return; // Would exceed limits
    }

    // If x is provided, adjust offset to keep that point stationary
    if (x !== undefined) {
      const idx = xToIndex(x, this.chart.state);
      this.chart.state.barWidth = newBarWidth;
      const newX = indexToX(idx, this.chart.state);
      const deltaX = x - newX;
      this.chart.state.offsetX += deltaX / newBarWidth;
    } else {
      // Zoom toward center
      this.chart.state.barWidth = newBarWidth;
    }

    this.chart.render();
  }

  /**
   * Zoom out by a factor
   * @param factor - Zoom multiplier (e.g., 1.5 for 50% zoom out)
   * @param x - Optional x-coordinate to zoom from (default: center of screen)
   *
   * Zooms out on the time scale, making bars narrower.
   */
  zoomOut(factor: number = 1.5, x?: number): void {
    this.zoomIn(1 / factor, x);
  }

  /**
   * Set the bar spacing (zoom level)
   * @param barSpacing - Width of each bar in pixels
   *
   * Directly controls the zoom level by setting bar width.
   */
  setBarSpacing(barSpacing: number): void {
    const minSpacing = this.chart.options.timeScale.minBarSpacing || 4;
    const maxSpacing = this.chart.options.timeScale.maxBarSpacing || 1000;

    if (barSpacing < minSpacing || barSpacing > maxSpacing) {
      throw new Error(`TimeScaleAPI.setBarSpacing: barSpacing must be between ${minSpacing} and ${maxSpacing}`);
    }

    this.chart.state.barWidth = barSpacing;
    this.chart.options.timeScale.barSpacing = barSpacing;
    this.chart.render();
  }

  /**
   * Get the current bar spacing
   * @returns Current bar width in pixels
   */
  getBarSpacing(): number {
    return this.chart.state.barWidth;
  }

  /**
   * Apply time scale options
   * @param options - Partial time scale options to apply
   */
  setOptions(options: Partial<ChartOptions['timeScale']>): void {
    if (!options) return;

    const currentOptions = this.chart.options.timeScale;
    const newOptions = { ...currentOptions, ...options };

    // Apply bar spacing if specified
    if (options.barSpacing !== undefined) {
      this.setBarSpacing(options.barSpacing);
    }

    // Apply right offset if specified
    if (options.rightOffset !== undefined) {
      this.chart.state.rightGap = options.rightOffset;
      this.chart.options.timeScale.rightOffset = options.rightOffset;
      this.chart.render();
    }

    // Apply visibility if specified
    if (options.visible !== undefined) {
      this.chart.options.timeScale.visible = options.visible;
      this.chart.render();
    }

    // Apply min/max bar spacing if specified
    if (options.minBarSpacing !== undefined) {
      this.chart.options.timeScale.minBarSpacing = options.minBarSpacing;
    }
    if (options.maxBarSpacing !== undefined) {
      this.chart.options.timeScale.maxBarSpacing = options.maxBarSpacing;
    }
  }

  /**
   * Get current time scale options
   * @returns Copy of current time scale options
   */
  getOptions(): ChartOptions['timeScale'] {
    return { ...this.chart.options.timeScale };
  }
}
