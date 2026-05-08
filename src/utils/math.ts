import { LAYOUT } from '../core/layout.js';

/**
 * Calculate a nice step size for axis labels
 * @param range - The total range to display
 * @param targetTicks - Target number of ticks (default: 7)
 * @returns A nice step size
 */
export function niceStep(range: number, targetTicks: number = 7): number {
  if (range === 0) return 1;

  const rough = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;

  let nice: number;
  if (normalized < LAYOUT.NICE_THRESHOLD_LOW) {
    nice = 1;
  } else if (normalized < LAYOUT.NICE_THRESHOLD_MID) {
    nice = 2;
  } else if (normalized < LAYOUT.NICE_THRESHOLD_HIGH) {
    nice = 5;
  } else {
    nice = 10;
  }

  return nice * magnitude;
}

/**
 * Calculate appropriate time step based on bar width
 * @param barWidth - Current pixel width per bar
 * @returns Number of bars per label
 */
export function calculateTimeStep(barWidth: number): number {
  if (!barWidth || barWidth <= 0) return 10; // Safe fallback

  const targetPixels = LAYOUT.TIME_LABEL_TARGET_PIXELS;
  const roughStep = targetPixels / barWidth;

  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep) || 0));
  const normalized = roughStep / magnitude;

  let nice: number;
  if (normalized < LAYOUT.NICE_THRESHOLD_LOW) {
    nice = 1;
  } else if (normalized < LAYOUT.NICE_THRESHOLD_MID) {
    nice = 2;
  } else if (normalized < LAYOUT.NICE_THRESHOLD_HIGH) {
    nice = 5;
  } else {
    nice = 10;
  }

  return Math.max(1, nice * magnitude);
}

/**
 * Calculate nice tick positions for an axis
 * @param min - Minimum value
 * @param max - Maximum value
 * @param targetTicks - Target number of ticks (default: 7)
 * @returns Array of tick positions
 */
export function niceTicks(min: number, max: number, targetTicks: number = 7): number[] {
  if (min === max) return [min];

  const range = max - min;
  const step = niceStep(range, targetTicks);

  // Calculate nice min and max
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  // Generate ticks
  const ticks: number[] = [];
  for (let tick = niceMin; tick <= niceMax + step * 0.5; tick += step) {
    if (tick >= min - step * 0.5 && tick <= max + step * 0.5) {
      ticks.push(tick);
    }
  }

  return ticks;
}

/**
 * Round a number to a specified number of decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

