import { IChart, Bar } from '../types/index.js';
import type { ChartState } from '../utils/projection.js';

/**
 * Generic sub-pane interface for indicators, volume, etc.
 * Each sub-pane manages its own rendering and interaction.
 *
 * Implementations include VolumeSubPane, and future: RSISubPane, MACDSubPane, etc.
 */
export interface SubPane {
  /** Unique identifier for this pane (e.g., 'volume', 'rsi') */
  readonly id: string;

  /** Human-readable label (e.g., 'Volume', 'RSI') */
  readonly label: string;

  /** Pixel threshold for separator drag hit-testing (default: 6px) */
  readonly separatorThreshold: number;

  /**
   * Read options from chart (e.g., chart.options.volume)
   * Called each render to get current configuration
   */
  getOptions(): Record<string, any>;

  /**
   * Compute height in pixels. Returns 0 when hidden.
   * @param state - Current chart state
   * @param options - Pane options from getOptions()
   */
  computeHeight(state: ChartState, options: any): number;

  /**
   * Render content on bgCanvas
   * @param ctx - Background canvas context
   * @param chart - Chart instance
   * @param subPaneTop - Y position where this pane starts
   */
  render(ctx: CanvasRenderingContext2D, chart: IChart, subPaneTop: number): void;

  /**
   * Render tooltip on overlayCanvas
   * @param ctx - Overlay canvas context (crosshair layer)
   * @param chart - Chart instance
   * @param bar - Bar data to display
   * @param subPaneTop - Y position where this pane starts
   * @param tooltipY - Y position for tooltip (stacked vertically)
   */
  renderTooltip(
    ctx: CanvasRenderingContext2D,
    chart: IChart,
    bar: Bar,
    subPaneTop: number,
    tooltipY: number
  ): void;

  /**
   * Render Y-axis label at cursor position
   * @param ctx - Overlay canvas context
   * @param chart - Chart instance
   * @param barIndex - Index of bar under cursor
   * @param mouseY - Y position of cursor
   * @param subPaneTop - Y position where this pane starts
   * @param axisX - X position of axis labels
   */
  renderAxisLabel(
    ctx: CanvasRenderingContext2D,
    chart: IChart,
    barIndex: number,
    mouseY: number,
    subPaneTop: number,
    axisX: number
  ): void;

  /**
   * Return structured data for getContext() (LLM integration)
   */
  getContextData(): Record<string, any>;

  /**
   * Handle wheel zoom on this pane's axis column
   * @returns true if handled, false to propagate
   */
  handleWheel(chart: IChart, deltaY: number): boolean;

  /**
   * Handle drag on this pane's axis column
   */
  handleDrag(chart: IChart, deltaY: number): void;

  /**
   * Handle double-click on this pane's axis column (reset)
   */
  handleDblClick(chart: IChart): void;

  /**
   * Handle separator drag (resize pane height)
   * @param deltaY - Mouse movement in pixels
   * @param totalHeight - Total available height (for percent calculation)
   */
  handleSeparatorDrag(chart: IChart, deltaY: number, totalHeight: number): void;
}
