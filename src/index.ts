import { Chart } from './core/chart.js';
import { LIB_VERSION } from './version.js';
export { Chart } from './core/chart.js';
export { DataManager } from './core/data.js';
export { Renderer } from './core/renderer.js';
export { Crosshair } from './ui/crosshair.js';
export { Axes } from './ui/axes.js';
export { Attribution } from './ui/Attribution.js';
export { EventManager } from './interaction/events.js';
export { PriceScaleAPI } from './api/price-scale.js';
export { TimeScaleAPI } from './api/time-scale.js';
export { CrosshairAPI } from './api/crosshair.js';
export * from './types/index.js';
export * from './utils/math.js';
export * as Indicators from './utils/indicators.js';
export * as Projection from './utils/projection.js';
export { LAYOUT } from './core/layout.js';
export { SubPane } from './subpanes/SubPane.js';
export { ScalePane } from './subpanes/ScalePane.js';
export { VolumeSubPane } from './subpanes/VolumeSubPane.js';
export { DrawingRenderer, DrawingHandle } from './drawings/DrawingRenderer.js';
export { registerDrawingType, getDrawingRenderer } from './drawings/registry.js';
export { resolveAnchor, screenToAnchor, magnetToOHLC, AnchorPoint, AnchorSpec } from './drawings/anchor.js';
export { ArrowRenderer } from './drawings/ArrowRenderer.js';
export { LabelRenderer } from './drawings/LabelRenderer.js';
export { HLineRenderer } from './drawings/HLineRenderer.js';
export { VLineRenderer } from './drawings/VLineRenderer.js';
export { PositionRenderer } from './drawings/PositionRenderer.js';
export { TrendlineRenderer } from './drawings/TrendlineRenderer.js';
export { BoxRenderer } from './drawings/BoxRenderer.js';
export { FibRetracementRenderer } from './drawings/FibRetracementRenderer.js';
export { MeasureRenderer } from './drawings/MeasureRenderer.js';
export { OrderRenderer } from './drawings/OrderRenderer.js';
export { TextRenderer } from './drawings/TextRenderer.js';
export { HighlighterRenderer } from './drawings/HighlighterRenderer.js';
export { PositionClosedRenderer } from './drawings/PositionClosedRenderer.js';

/**
 * Global chart registry for AI agent discovery.
 * Agents check window.__AXON_CHARTS__ to find all chart instances on a page.
 */
if (typeof window !== 'undefined') {
  (window as any).__AXON_CHARTS__ = (window as any).__AXON_CHARTS__ || { version: LIB_VERSION, charts: {} };
}

/**
 * Generate a chart ID for the global __AXON_CHARTS__ registry.
 *
 * Priority:
 * 1. User-provided context.id (used verbatim)
 * 2. Opaque random token (ax-xxxxxx) — no pair inference, no stale associations.
 */
export function generateChartId(options?: import('./types/index.js').ChartOptions): string {
  if (options?.context?.id && options.context.id.trim().length > 0) {
    return options.context.id.trim();
  }
  return 'ax-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Create a new chart instance
 */
export function createChart(container: HTMLElement | string, options?: import('./types/index.js').ChartOptions) {
  return new Chart(container, options);
}