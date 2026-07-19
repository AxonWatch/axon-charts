import type { IChart, Drawing } from '../types/index.js';
import type { DrawingRenderer, DrawingHandle } from '../drawings/DrawingRenderer.js';
import { getDrawingRenderer } from '../drawings/registry.js';
import { screenToAnchor, resolveAnchor } from '../drawings/anchor.js';

/**
 * Hit-test tolerance in pixels. Cursor within this distance of a
 * handle or line counts as "on it". 6px matches the separator
 * hit-zone used elsewhere in the chart.
 */
const HIT_TOLERANCE = 6;

/**
 * The drawing interaction dispatcher. Owned by EventManager, called
 * on mousedown/mousemove/mouseup before the chart's pan/zoom logic.
 * Returns true if the event was consumed (drawing took priority),
 * false to let the chart handle it normally.
 *
 * Responsibilities:
 *   - On mousemove: find the topmost drawing + handle under the
 *     cursor. Set the canvas cursor accordingly.
 *   - On mousedown on a handle: enter drag mode for that
 *     (drawing, handle). Select the drawing.
 *   - On mousedown on empty space: clear selection.
 *   - On mousemove during drag: convert pixel position to chart
 *     coordinates via screenToAnchor, update the drawing in place
 *     via chart.updateDrawing, trigger a render.
 *   - On mouseup: end drag.
 *
 * Drawings without hitTest/getHandles are display-only — the
 * dispatcher treats them as pass-through (cursor goes through to
 * the chart below).
 *
 * Drawings are hit-tested topmost-first (last drawn = topmost in z
 * order). The first drawing whose hitTest returns true wins.
 */
export class DrawingInteraction {
  private chart: IChart;
  /** Currently dragged drawing id + handle id, or null when not dragging. */
  private dragDrawingId: string | null = null;
  private dragHandleId: string | null = null;
  /** Drawing id + handle id under the cursor (for cursor styling), or null. */
  private hoverDrawingId: string | null = null;
  private hoverHandleId: string | null = null;
  /** Cached handles per drawing (recomputed on each mousemove). */
  private cachedHandles: DrawingHandle[] = [];

  constructor(chart: IChart) {
    this.chart = chart;
  }

  /**
   * Called by EventManager on mousedown. Returns true if the event
   * was consumed (drawing took priority — chart pan should NOT fire).
   */
  onMouseDown(x: number, y: number): boolean {
    // Only consider drawings when the cursor is in the chart area
    // (not over the price axis or time axis).
    if (!this.isInChartArea(x, y)) {
      return false;
    }

    // Check handles first (topmost drawing last in array = first checked)
    const hit = this.hitTestHandles(x, y);
    if (hit) {
      this.dragDrawingId = hit.drawingId;
      this.dragHandleId = hit.handleId;
      this.chart.selectDrawing(hit.drawingId);
      return true;
    }

    // Then check drawing bodies (for body-drag without a specific handle)
    const bodyHit = this.hitTestBodies(x, y);
    if (bodyHit) {
      this.dragDrawingId = bodyHit;
      this.dragHandleId = 'body';
      this.chart.selectDrawing(bodyHit);
      return true;
    }

    // Click on empty space — clear selection
    if (this.chart.getSelectedDrawingId() != null) {
      this.chart.selectDrawing(null);
    }
    return false;
  }

  /**
   * Called by EventManager on mousemove. Returns true if the event
   * was consumed (a drawing is being dragged — chart pan should NOT fire).
   */
  onMouseMove(x: number, y: number): boolean {
    // If we're mid-drag, update the drawing position
    if (this.dragDrawingId != null && this.dragHandleId != null) {
      this.applyDrag(x, y);
      return true;
    }

    // Otherwise just update hover state for cursor styling
    if (!this.isInChartArea(x, y)) {
      this.hoverDrawingId = null;
      this.hoverHandleId = null;
      return false;
    }

    const handleHit = this.hitTestHandles(x, y);
    if (handleHit) {
      this.hoverDrawingId = handleHit.drawingId;
      this.hoverHandleId = handleHit.handleId;
      const handle = this.cachedHandles.find(h => h.id === handleHit.handleId);
      if (handle) {
        this.chart.mainCanvas.style.cursor = handle.cursor;
      }
      return false;  // not a drag, just hover — let chart see the move too
    }

    const bodyHit = this.hitTestBodies(x, y);
    if (bodyHit) {
      this.hoverDrawingId = bodyHit;
      this.hoverHandleId = 'body';
      this.chart.mainCanvas.style.cursor = 'move';
      return false;
    }

    this.hoverDrawingId = null;
    this.hoverHandleId = null;
    return false;
  }

  /**
   * Called by EventManager on mouseup. Always called, regardless of
   * whether mousedown consumed the event.
   */
  onMouseUp(): void {
    this.dragDrawingId = null;
    this.dragHandleId = null;
  }

  /**
   * Cancel any in-progress drag (called on Escape or chart destroy).
   */
  cancel(): void {
    this.dragDrawingId = null;
    this.dragHandleId = null;
    this.hoverDrawingId = null;
    this.hoverHandleId = null;
  }

  // ── Drag application ──────────────────────────────────────────

  /**
   * Convert the current cursor position to chart coordinates and
   * update the dragged drawing's anchor(s) in place.
   */
  private applyDrag(x: number, y: number): void {
    const drawing = this.chart.getDrawings().find(d => d.id === this.dragDrawingId);
    if (!drawing) return;

    const renderer = getDrawingRenderer(drawing.type);
    if (!renderer) return;

    // Convert screen to chart coordinates
    const anchor = screenToAnchor(this.chart, x, y);
    if (!anchor) return;  // outside data range — skip update, drawing stays put

    const updates: Partial<Drawing> = {};

    if (this.dragHandleId === 'p1') {
      // Primary anchor: update time + price (preferred over barIndex)
      updates.time = anchor.time;
      updates.price = anchor.price;
    } else if (this.dragHandleId === 'p2') {
      // Secondary anchor
      updates.time2 = anchor.time;
      updates.price2 = anchor.price;
    } else if (this.dragHandleId === 'body') {
      // Body drag: move the whole drawing by the same delta.
      // We need the original anchor positions to compute the delta,
      // but since we update in place, we move both anchors to the
      // new position. For two-point drawings this collapses them —
      // so body drag is only meaningful when the renderer provides
      // a custom body-drag handler. For now, body drag moves p1
      // (single-point drawings) and is a no-op for two-point drawings
      // unless the renderer extends the behavior.
      if (drawing.time2 == null && drawing.price2 == null) {
        // Single-point drawing: move p1
        updates.time = anchor.time;
        updates.price = anchor.price;
      }
      // For two-point drawings, body drag would need the delta
      // applied to both anchors — but we don't track the drag
      // start position here. Renderers that support body drag for
      // two-point drawings should override getHandles to not expose
      // a 'body' handle, or implement a custom drag handler.
      // (This is documented in the plan; full body-drag for
      // two-point drawings comes with per-type refinements.)
    }

    if (Object.keys(updates).length > 0) {
      this.chart.updateDrawing(drawing.id, updates);
    }
  }

  // ── Hit testing ───────────────────────────────────────────────

  /**
   * Check if (x, y) is in the chart area (not over the price axis
   * or time axis). Drawings only respond inside the chart area.
   */
  private isInChartArea(x: number, y: number): boolean {
    const { w, h, axisWidth, bottomMargin, chartBottom } = this.chart.state;
    const chartBottomY = chartBottom || (h - bottomMargin);
    return x >= 0 && x <= w - axisWidth && y >= 0 && y <= chartBottomY;
  }

  /**
   * Find the topmost handle under the cursor. Returns the drawing id
   * + handle id, or null. Also caches the handles of the hit drawing
   * so the caller can look up the cursor style.
   */
  private hitTestHandles(x: number, y: number): { drawingId: string; handleId: string } | null {
    const drawings = this.chart.getDrawings();
    // Topmost first (last drawn = on top)
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      const renderer = getDrawingRenderer(d.type);
      if (!renderer?.getHandles) continue;

      const handles = renderer.getHandles(this.chart, d);
      // Handle hit: within HIT_TOLERANCE pixels of the handle position
      for (const handle of handles) {
        const dx = x - handle.x;
        const dy = y - handle.y;
        if (Math.abs(dx) <= HIT_TOLERANCE && Math.abs(dy) <= HIT_TOLERANCE) {
          this.cachedHandles = handles;
          return { drawingId: d.id, handleId: handle.id };
        }
      }
    }
    this.cachedHandles = [];
    return null;
  }

  /**
   * Find the topmost drawing body under the cursor (no handle).
   * Returns the drawing id, or null.
   */
  private hitTestBodies(x: number, y: number): string | null {
    const drawings = this.chart.getDrawings();
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      const renderer = getDrawingRenderer(d.type);
      if (!renderer?.hitTest) continue;
      if (renderer.hitTest(x, y, this.chart, d)) {
        return d.id;
      }
    }
    return null;
  }

  // ── Selection rendering hook ──────────────────────────────────

  /**
   * Expose the currently hovered handle's drawing id + handle id.
   * Used by renderers to draw a highlight on the hovered handle.
   * Returns null when nothing is hovered.
   */
  getHoveredHandle(): { drawingId: string; handleId: string } | null {
    if (this.hoverDrawingId == null || this.hoverHandleId == null) return null;
    return { drawingId: this.hoverDrawingId, handleId: this.hoverHandleId };
  }

  isDragging(): boolean {
    return this.dragDrawingId != null;
  }
}