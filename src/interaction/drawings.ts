import type { IChart, Drawing } from '../types/index.js';
import type { DrawingRenderer, DrawingHandle } from '../drawings/DrawingRenderer.js';
import { getDrawingRenderer } from '../drawings/registry.js';
import { screenToAnchor, resolveAnchor, magnetToOHLC } from '../drawings/anchor.js';

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
  /** Anchor position at drag start (for body-drag delta computation). */
  private dragStartAnchor: { time: number; price: number; barIndex: number } | null = null;
  /** Original drawing snapshot at drag start (for two-point body drag). */
  private dragStartDrawing: Drawing | null = null;
  /** Drawing id + handle id under the cursor (for cursor styling), or null. */
  private hoverDrawingId: string | null = null;
  private hoverHandleId: string | null = null;
  /** True when a drawing/handle is currently hovered (cursor is over it).
   *  Set by onMouseMove; read by EventManager to decide whether to
   *  override the cursor. Cleared when the cursor leaves the drawing. */
  private hoverActive: boolean = false;
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
      this.dragStartAnchor = screenToAnchor(this.chart, x, y);
      this.dragStartDrawing = this.chart.getDrawings().find(d => d.id === hit.drawingId) ?? null;
      this.chart.selectDrawing(hit.drawingId);
      return true;
    }

    // Then check drawing bodies (for body-drag without a specific handle)
    const bodyHit = this.hitTestBodies(x, y);
    if (bodyHit) {
      this.dragDrawingId = bodyHit;
      this.dragHandleId = 'body';
      this.dragStartAnchor = screenToAnchor(this.chart, x, y);
      this.dragStartDrawing = this.chart.getDrawings().find(d => d.id === bodyHit) ?? null;
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
   * was consumed (a drawing is being dragged OR a drawing is hovered
   * — in both cases the chart's cursor logic should NOT fire, since
   * the dispatcher sets the cursor to match the handle).
   */
  onMouseMove(x: number, y: number): boolean {
    // If we're mid-drag, update the drawing position
    if (this.dragDrawingId != null && this.dragHandleId != null) {
      this.applyDrag(x, y);
      return true;
    }

    // Otherwise just update hover state for cursor styling
    if (!this.isInChartArea(x, y)) {
      if (this.hoverActive) {
        this.hoverDrawingId = null;
        this.hoverHandleId = null;
        this.hoverActive = false;
      }
      return false;
    }

    const handleHit = this.hitTestHandles(x, y);
    if (handleHit) {
      this.hoverDrawingId = handleHit.drawingId;
      this.hoverHandleId = handleHit.handleId;
      this.hoverActive = true;
      const handle = this.cachedHandles.find(h => h.id === handleHit.handleId);
      if (handle) {
        this.chart.mainCanvas.style.cursor = handle.cursor;
      }
      return true;  // consume so EventManager doesn't overwrite the cursor
    }

    const bodyHit = this.hitTestBodies(x, y);
    if (bodyHit) {
      this.hoverDrawingId = bodyHit;
      this.hoverHandleId = 'body';
      this.hoverActive = true;
      this.chart.mainCanvas.style.cursor = 'move';
      return true;  // consume so EventManager doesn't overwrite the cursor
    }

    // Not over any drawing — clear hover, let chart set the cursor
    if (this.hoverActive) {
      this.hoverDrawingId = null;
      this.hoverHandleId = null;
      this.hoverActive = false;
    }
    return false;
  }

  /** True when a drawing handle/body is currently hovered (EventManager checks this). */
  isHovering(): boolean {
    return this.hoverActive;
  }

  /** Clear hover state (called by EventManager on mouseleave). */
  clearHover(): void {
    this.hoverDrawingId = null;
    this.hoverHandleId = null;
    this.hoverActive = false;
  }

  /**
   * Called by EventManager on mouseup. Always called, regardless of
   * whether mousedown consumed the event.
   */
  onMouseUp(): void {
    this.dragDrawingId = null;
    this.dragHandleId = null;
    this.dragStartAnchor = null;
    this.dragStartDrawing = null;
  }

  /**
   * Cancel any in-progress drag (called on Escape or chart destroy).
   */
  cancel(): void {
    this.dragDrawingId = null;
    this.dragHandleId = null;
    this.dragStartAnchor = null;
    this.dragStartDrawing = null;
    this.hoverDrawingId = null;
    this.hoverHandleId = null;
    this.hoverActive = false;
  }

  // ── Drag application ──────────────────────────────────────────

  /**
   * Convert the current cursor position to chart coordinates and
   * update the dragged drawing's anchor(s) in place. Applies magnet
   * snapping if drawing.magnet is enabled.
   */
  private applyDrag(x: number, y: number): void {
    const drawing = this.chart.getDrawings().find(d => d.id === this.dragDrawingId);
    if (!drawing) return;

    const renderer = getDrawingRenderer(drawing.type);
    if (!renderer) return;

    // Convert screen to chart coordinates (with magnet snapping if enabled)
    const magnet = (this.chart.options as any).drawing?.magnet === true;
    let anchor: { time: number; price: number; barIndex: number } | null;
    if (magnet) {
      anchor = magnetToOHLC(this.chart, x, y);
      if (!anchor) anchor = screenToAnchor(this.chart, x, y);
    } else {
      anchor = screenToAnchor(this.chart, x, y);
    }
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
      // Uses the drag-start anchor + original drawing snapshot to
      // compute the delta and apply it to both anchors (for two-point
      // drawings) or just p1 (for single-point drawings).
      if (this.dragStartAnchor && this.dragStartDrawing) {
        const dTime = anchor.time - this.dragStartAnchor.time;
        const dPrice = anchor.price - this.dragStartAnchor.price;
        const orig = this.dragStartDrawing;

        if (orig.time2 != null && orig.price2 != null) {
          // Two-point drawing: move both anchors by the delta
          updates.time = (orig.time ?? anchor.time) + dTime;
          updates.price = (orig.price ?? anchor.price) + dPrice;
          updates.time2 = orig.time2 + dTime;
          updates.price2 = orig.price2 + dPrice;
        } else {
          // Single-point drawing: move p1 to the cursor
          updates.time = anchor.time;
          updates.price = anchor.price;
        }
      } else {
        // No start state (shouldn't happen) — fall back to p1 move
        updates.time = anchor.time;
        updates.price = anchor.price;
      }
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