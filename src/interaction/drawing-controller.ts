import type { IChart, Drawing } from '../types/index.js';
import { screenToAnchor, magnetToOHLC } from '../drawings/anchor.js';

/**
 * Drawing-creation mode state machine.
 *
 * Owns the click-to-create flow for new drawings:
 *   1. chart.beginDrawing('trendline')  → enter create mode
 *   2. User clicks on chart            → place first anchor (p1)
 *   3. User moves mouse                → preview line follows cursor
 *   4. User clicks again               → place second anchor (p2), commit
 *   5. Drawing is added via chart.addDrawing()
 *
 * For single-point drawings (hline, vline, arrow, label, text,
 * position, order), the flow is: click → commit (no second click needed).
 *
 * Escape cancels at any point. Clicking on an empty area without
 * a drawing type active does nothing (normal chart pan).
 *
 * The controller is owned by Chart and called by EventManager on
 * mousedown/mousemove when isDrawing() is true.
 *
 * The preview anchor (first click) is exposed via getDrawingPreview()
 * so the renderer can draw a rubber-band preview line during the
 * second-click phase.
 */

/** Whether a drawing type needs one or two clicks to commit. */
const TWO_POINT_TYPES = new Set([
  'trendline', 'box', 'fib_retracement', 'measure', 'highlighter', 'position_closed'
]);

/** Default colors per drawing type (used when the caller doesn't pass one). */
const DEFAULT_COLORS: Record<string, string> = {
  trendline: '#3b82f6',
  box: '#3b82f6',
  fib_retracement: '#3b82f6',
  measure: '#3b82f6',
  highlighter: '#f59e0b',
  position_closed: '#3b82f6',
  hline: '#888',
  vline: '#888',
  arrow_up: '#10B981',
  arrow_down: '#E11D48',
  label: '#888',
  text: '#f59e0b',
  position: '#3b82f6',
  order: '#3b82f6',
};

export class DrawingController {
  private chart: IChart;
  /** The type being created, or null when not in create mode. */
  private activeType: string | null = null;
  /** First anchor (after first click), or null. */
  private p1: { time: number; price: number; barIndex: number } | null = null;
  /** Live preview second anchor (during mousemove, before second click). */
  private p2Preview: { time: number; price: number; barIndex: number } | null = null;
  /** Counter for generating unique drawing ids. */
  private idCounter: number = 0;

  constructor(chart: IChart) {
    this.chart = chart;
  }

  /**
   * Enter drawing-creation mode for the given type.
   * If already in create mode, cancel the previous one first.
   */
  begin(type: string): void {
    this.activeType = type;
    this.p1 = null;
    this.p2Preview = null;
    // Clear any selection so the user doesn't accidentally modify
    // an existing drawing while in create mode
    this.chart.selectDrawing(null);
    this.chart.render();
  }

  /** Cancel drawing-creation mode (Escape or programmatic). */
  cancel(): void {
    this.activeType = null;
    this.p1 = null;
    this.p2Preview = null;
    this.chart.render();
  }

  isDrawing(): boolean {
    return this.activeType != null;
  }

  getActiveType(): string | null {
    return this.activeType;
  }

  /**
   * Get the in-progress drawing's preview anchors for rubber-band
   * rendering. Returns null when not in create mode or before the
   * first click.
   */
  getPreview(): { time: number; price: number; time2?: number; price2?: number } | null {
    if (!this.activeType || !this.p1) return null;
    if (this.p2Preview) {
      return { time: this.p1.time, price: this.p1.price, time2: this.p2Preview.time, price2: this.p2Preview.price };
    }
    return { time: this.p1.time, price: this.p1.price };
  }

  /**
   * Get the visual shape category for the rubber-band preview, so
   * the renderer can draw the right preview (line vs rectangle vs
   * horizontal line vs vertical line).
   */
  getPreviewShape(): 'line' | 'rect' | 'hline' | 'vline' | 'point' | null {
    if (!this.activeType) return null;
    switch (this.activeType) {
      case 'box':
      case 'highlighter':
        return 'rect';
      case 'hline':
        return 'hline';
      case 'vline':
        return 'vline';
      case 'arrow_up':
      case 'arrow_down':
      case 'label':
      case 'text':
      case 'position':
      case 'order':
        return 'point';
      default:
        return 'line';  // trendline, fib_retracement, measure, position_closed
    }
  }

  /**
   * Resolve a screen point to chart coordinates, applying magnet
   * snapping if drawing.magnet is enabled. Returns null if the
   * cursor is outside the data range.
   */
  private resolveWithMagnet(x: number, y: number): { time: number; price: number; barIndex: number } | null {
    const magnet = (this.chart.options as any).drawing?.magnet === true;
    if (magnet) {
      const snapped = magnetToOHLC(this.chart, x, y);
      if (snapped) return snapped;
    }
    return screenToAnchor(this.chart, x, y);
  }

  /**
   * Called by EventManager on mousedown when isDrawing() is true.
   * Returns true if the event was consumed (chart pan should NOT fire).
   */
  onMouseDown(x: number, y: number): boolean {
    if (!this.activeType) return false;

    const anchor = this.resolveWithMagnet(x, y);
    if (!anchor) return true;  // outside data range — consume but no-op

    if (!this.p1) {
      // First click: place p1
      this.p1 = anchor;
      if (TWO_POINT_TYPES.has(this.activeType)) {
        // Two-point: stay in create mode, wait for second click
        this.p2Preview = anchor;
        this.chart.render();
      } else {
        // Single-point: commit immediately
        this.commit(anchor);
      }
    } else {
      // Second click: commit with p2 = current anchor
      this.commit(anchor);
    }
    return true;
  }

  /**
   * Called by EventManager on mousemove when isDrawing() is true.
   * Updates the preview second anchor.
   */
  onMouseMove(x: number, y: number): void {
    if (!this.activeType || !this.p1) return;
    const anchor = this.resolveWithMagnet(x, y);
    if (anchor) {
      this.p2Preview = anchor;
      this.chart.render();
    }
  }

  /** Commit the drawing with the current anchors. */
  private commit(p2: { time: number; price: number; barIndex: number }): void {
    if (!this.activeType || !this.p1) return;

    const type = this.activeType;
    const color = DEFAULT_COLORS[type] ?? '#3b82f6';
    const id = `draw-${Date.now()}-${this.idCounter++}`;

    const drawing: Drawing = {
      id,
      type,
      color,
      time: this.p1.time,
      price: this.p1.price,
    };

    if (TWO_POINT_TYPES.has(type)) {
      drawing.time2 = p2.time;
      drawing.price2 = p2.price;
    }

    // Type-specific defaults
    if (type === 'position' || type === 'order' || type === 'position_closed') {
      drawing.data = { side: 'long', qty: 1 };
      if (type === 'order') (drawing.data as any).kind = 'limit';
    }

    this.chart.addDrawing(drawing);

    // Exit create mode after commit (one drawing per beginDrawing() call)
    this.activeType = null;
    this.p1 = null;
    this.p2Preview = null;
  }
}