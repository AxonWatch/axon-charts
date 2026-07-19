import type { Drawing } from '../types/index.js';
import type { DrawingRenderer } from './DrawingRenderer.js';
import { ArrowRenderer } from './ArrowRenderer.js';
import { LabelRenderer } from './LabelRenderer.js';
import { HLineRenderer } from './HLineRenderer.js';
import { VLineRenderer } from './VLineRenderer.js';
import { PositionRenderer } from './PositionRenderer.js';
import { TrendlineRenderer } from './TrendlineRenderer.js';
import { BoxRenderer } from './BoxRenderer.js';
import { FibRetracementRenderer } from './FibRetracementRenderer.js';

/**
 * Central registry of drawing type → renderer.
 *
 * Built-in types are registered here at module load. External code can
 * register additional types via Chart.registerDrawingType() (delegates
 * to registerDrawingType() below).
 *
 * Adding a new drawing type is a pure additive operation:
 *   1. Create a new file in src/drawings/ implementing DrawingRenderer
 *   2. Register it in this map
 *   3. No changes to Renderer, Chart, or IChart
 *
 * This mirrors the SeriesRenderer plugin pattern used for series types.
 */
const registry = new Map<string, DrawingRenderer<any>>([
  ['arrow_up',   new ArrowRenderer('up')],
  ['arrow_down', new ArrowRenderer('down')],
  ['label',      new LabelRenderer()],
  ['hline',      new HLineRenderer()],
  ['vline',      new VLineRenderer()],
  ['position',   new PositionRenderer()],
  ['trendline',  new TrendlineRenderer()],
  ['box',        new BoxRenderer()],
  ['fib_retracement', new FibRetracementRenderer()],
]);

/**
 * Look up the renderer for a drawing type.
 * Returns undefined for unregistered types — Renderer.renderDrawings
 * silently skips drawings whose type has no renderer.
 */
export function getDrawingRenderer(type: string): DrawingRenderer<any> | undefined {
  return registry.get(type);
}

/**
 * Register a new drawing type. External code uses this via
 * Chart.registerDrawingType() to add custom drawing types without
 * forking the library.
 *
 * Overwriting an existing type is allowed (last-writer-wins) — useful
 * for overriding a built-in renderer with a customized one.
 */
export function registerDrawingType(type: string, renderer: DrawingRenderer<any>): void {
  if (!type || typeof type !== 'string') {
    throw new Error('AxonCharts: registerDrawingType requires a non-empty type string');
  }
  if (!renderer || typeof renderer.render !== 'function') {
    throw new Error('AxonCharts: registerDrawingType requires a DrawingRenderer with a render() method');
  }
  registry.set(type, renderer);
}