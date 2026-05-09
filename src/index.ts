import { Chart } from './core/chart.js';
export { Chart } from './core/chart.js';
export { DataManager } from './core/data.js';
export { Renderer } from './core/renderer.js';
export { Crosshair } from './ui/crosshair.js';
export { Axes } from './ui/axes.js';
export { EventManager } from './interaction/events.js';
export { PriceScaleAPI } from './api/price-scale.js';
export { TimeScaleAPI } from './api/time-scale.js';
export { CrosshairAPI } from './api/crosshair.js';
export * from './types/index.js';
export * from './utils/math.js';
export * as Projection from './utils/projection.js';
export { LAYOUT } from './core/layout.js';
export { SubPane } from './subpanes/SubPane.js';
export { ScalePane } from './subpanes/ScalePane.js';
export { VolumeSubPane } from './subpanes/VolumeSubPane.js';

/**
 * Global chart registry for AI agent discovery.
 * Agents check window.__AXON_CHARTS__ to find all chart instances on a page.
 */
if (typeof window !== 'undefined') {
  (window as any).__AXON_CHARTS__ = (window as any).__AXON_CHARTS__ || { version: '1.1.0', charts: {} };
}

let _chartCounters: Record<string, number> = {};

/**
 * Generate a chart ID for the global __AXON_CHARTS__ registry.
 *
 * Priority:
 * 1. User-provided context.id (used verbatim)
 * 2. Market pair prefix + auto-increment counter (e.g. BTC-USDT-1, BTC-USDT-2)
 * 3. Generic chart- prefix + auto-increment counter (e.g. chart-1, chart-2)
 *
 * The per-prefix counter prevents collisions when the same pair appears
 * on multiple charts (different timeframes, different sources).
 */
export function generateChartId(options?: import('./types/index.js').ChartOptions): string {
  // User-provided ID takes priority
  if (options?.context?.id && options.context.id.trim().length > 0) {
    return options.context.id.trim();
  }

  const pair = options?.market?.baseAsset && options?.market?.quoteAsset
    ? `${options.market.baseAsset}-${options.market.quoteAsset}`
    : null;
  const prefix = pair || 'chart';
  _chartCounters[prefix] = (_chartCounters[prefix] || 0) + 1;
  return `${prefix}-${_chartCounters[prefix]}`;
}

/**
 * Create a new chart instance
 */
export function createChart(container: HTMLElement | string, options?: import('./types/index.js').ChartOptions) {
  return new Chart(container, options);
}
