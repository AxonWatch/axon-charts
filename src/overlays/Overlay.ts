import type { IChart } from '../types/index.js';
import type { Bar } from '../types/index.js';

/**
 * Plugin interface for an overlay indicator — an indicator that draws
 * on the main chart (on top of candles) using the main chart's price
 * scale (Y-axis). Examples: SMA, EMA, Bollinger Bands, VWAP, Ichimoku.
 *
 * Distinct from SubPane (which has its own Y-axis in a separate pane
 * below the chart). Overlays share the main chart's price scale.
 *
 * Each overlay has:
 *   - id:     unique identifier (e.g. 'sma-20', 'ema-50', 'bb-20-2')
 *   - compute(chart): calculate the indicator values for all bars,
 *                     return as a number[] aligned with chart.state.data
 *                     (NaN where not yet defined)
 *   - render(ctx, chart, values): draw the overlay on the main canvas
 *   - getOptions(): return the options object (for show/hide + params)
 *
 * Renderers are called every frame from drawViewport(), including the
 * high-frequency updateLastBarFast() path, so overlay values update
 * live with each tick.
 *
 * Register via chart.addOverlay(overlay); remove via
 * chart.removeOverlay(id).
 */
export interface Overlay {
  /** Unique identifier (e.g. 'sma-20', 'ema-50', 'bb-20-2') */
  readonly id: string;

  /**
   * Compute indicator values for all bars. Called once per render.
   * Returns a number[] aligned with chart.state.data — one value per
   * bar, NaN where the indicator is not yet defined (e.g. before the
   * lookback period is reached).
   *
   * For multi-component overlays (Bollinger Bands with upper/mid/lower,
   * Ichimoku with 5 lines), return the primary value here and store
   * the rest in a private field for the render method to read.
   */
  compute(chart: IChart): number[] | null;

  /**
   * Render the overlay on the main canvas context.
   * @param ctx     Main canvas 2D context (already clipped to chart area)
   * @param chart   Chart instance
   * @param values  The values returned by compute()
   */
  render(ctx: CanvasRenderingContext2D, chart: IChart, values: number[] | null): void;

  /**
   * Return the options object (for show/hide + parameters).
   * Called each render to check if the overlay is visible.
   */
  getOptions(): { show?: boolean; [key: string]: any };
}