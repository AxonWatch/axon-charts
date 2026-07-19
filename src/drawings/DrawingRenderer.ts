import type { Drawing } from '../types/index.js';
import type { IChart } from '../types/index.js';

/**
 * A draggable handle on a drawing. Returned by DrawingRenderer.getHandles()
 * and used by the drawing interaction layer to show resize cursors and
 * route drag operations.
 *
 * Convention for handle ids:
 *   'p1'     — primary anchor (single-point drawings: the anchor itself)
 *   'p2'     — secondary anchor (two-point drawings: the second endpoint)
 *   'body'   — the drawing body (dragging it moves the whole drawing
 *              without changing its shape)
 *
 * For drawings with more than 2 anchors (future: pitchfork with 3),
 * use 'p3', 'p4', etc.
 */
export interface DrawingHandle {
  id: string;
  x: number;
  y: number;
  cursor: 'move' | 'ew-resize' | 'ns-resize' | 'nesw-resize' | 'nwse-resize' | 'crosshair';
}

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
 *
 * Optional methods make a drawing interactive:
 *   hitTest  — is the cursor over this drawing?
 *   getHandles — what draggable handles does it expose?
 *
 * Renderers without those methods are display-only (the legacy 5 types
 * get default implementations via BaseDrawingRenderer so they're
 * draggable for free).
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

  /**
   * Return true if the given screen point is "on" this drawing (on the
   * line, inside the box, near the endpoint handle, etc.). Used for
   * hover highlighting and drag-start detection.
   *
   * Optional — renderers without hitTest are not interactive. The
   * interaction layer treats them as pass-through (cursor goes "through"
   * them to the chart below).
   */
  hitTest?(x: number, y: number, chart: IChart, drawing: T): boolean;

  /**
   * Return the draggable handles for this drawing. Each handle has an
   * id, a screen position, and a cursor style. Used by the interaction
   * layer to show resize cursors and route drags to the right anchor.
   *
   * Convention: 'p1' (primary anchor), 'p2' (secondary anchor), 'body'
   * (drag to move the whole drawing). See DrawingHandle for details.
   *
   * Optional — renderers without getHandles can be hit-tested (so
   * the user can grab the body to move it) but can't be resized.
   */
  getHandles?(chart: IChart, drawing: T): DrawingHandle[];
}