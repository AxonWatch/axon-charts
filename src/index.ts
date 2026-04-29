import { Chart } from './core/chart.js';
export { Chart } from './core/chart.js';
export { DataManager } from './core/data.js';
export { Renderer } from './core/renderer.js';
export { Crosshair } from './ui/crosshair.js';
export { Axes } from './ui/axes.js';
export { EventManager } from './interaction/events.js';
export { PriceScaleAPI } from './api/price-scale.js';
export * from './types/index.js';
export * from './utils/math.js';
export * as Projection from './utils/projection.js';
export { LAYOUT } from './core/layout.js';

/**
 * Create a new chart instance
 */
export function createChart(container: HTMLElement | string, options?: import('./types/index.js').ChartOptions) {
  return new Chart(container, options);
}
