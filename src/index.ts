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
 * Create a new chart instance
 */
export function createChart(container: HTMLElement | string, options?: import('./types/index.js').ChartOptions) {
  return new Chart(container, options);
}
