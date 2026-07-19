import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';

/**
 * Plugin interface for rendering a single drawing type.
 *
 * Each built-in drawing type (arrow, label, hline, vline, position, etc.)
 * has its own implementation. External code can register additional types
 * via Chart.registerDrawingType().
 *
 * This mirrors the SeriesRenderer plugin pattern used for series types
 * (candlestick, line, area, bar, heiken-ashi, hollow): one interface,
 * one file per implementation, registered in a central map.
 *
 * Renderer.renderDrawings() looks up the renderer for each drawing's
 * type and calls render(). Renderers receive the chart (for state,
 * options, and the price formatter) and the drawing object.
 *
 * Renderers are called every frame from drawViewport(), including the
 * high-frequency updateLastBarFast() path, so any value that should
 * update live (e.g. position PnL) is recomputed automatically.
 */
export interface DrawingRenderer<T extends Drawing = Drawing> {
  /**
   * Render a single drawing on the main canvas context.
   *
   * @param ctx  Main canvas 2D context (already clipped to the chart area)
   * @param chart  Chart instance (read-only access to state, options, formatter)
   * @param drawing  The drawing to render
   */
  render(ctx: CanvasRenderingContext2D, chart: IChart, drawing: T): void;
}