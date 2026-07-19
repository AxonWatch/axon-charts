import type { IChart } from '../types/index.js';

/**
 * Named CSS color → hex lookup.
 * Shared by Renderer (current-price label, HA label, drawings) and
 * future drawing renderers. Kept as a single source of truth so new
 * drawing types don't reimplement color parsing.
 */
export const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080',
  pink: '#ffc0cb', brown: '#a52a2a', transparent: '#000000'
};

/**
 * Resolve a CSS color string (#RGB, #RRGGBB, or named) into an rgba() string
 * with the requested alpha.
 *
 * Falls back to the chart's layout.textColor, then to #aaaaaa when the input
 * cannot be parsed. This matches the historical behavior of Renderer.hexToRgba.
 */
export function hexToRgba(hex: string, alpha: number, chartFallbackTextColor?: string): string {
  const h = NAMED_COLORS[hex.toLowerCase()] || hex;
  let r: number, g: number, b: number;

  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    r = parseInt(h[1] + h[1], 16);
    g = parseInt(h[2] + h[2], 16);
    b = parseInt(h[3] + h[3], 16);
  } else if (/^#[0-9a-fA-F]{6}$/.test(h)) {
    r = parseInt(h.slice(1, 3), 16);
    g = parseInt(h.slice(3, 5), 16);
    b = parseInt(h.slice(5, 7), 16);
  } else {
    const fallback = chartFallbackTextColor || '#aaa';
    const fb = NAMED_COLORS[fallback.toLowerCase()] || fallback;
    if (/^#[0-9a-fA-F]{6}$/.test(fb)) {
      r = parseInt(fb.slice(1, 3), 16);
      g = parseInt(fb.slice(3, 5), 16);
      b = parseInt(fb.slice(5, 7), 16);
    } else {
      r = 170; g = 170; b = 170;
    }
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Return the bottom edge (Y) of the main chart area.
 * Honors sub-pane height when present; otherwise falls back to h - bottomMargin.
 *
 * This encapsulates the `chartBottom || (h - bottomMargin)` pattern that was
 * inlined 6+ times in Renderer. Drawings need the same calculation, so it
 * lives here as a shared utility.
 */
export function chartBottomEdge(chart: IChart): number {
  const { chartBottom, h, bottomMargin } = chart.state;
  return chartBottom || (h - bottomMargin);
}

/**
 * Clamp a Y coordinate to the visible main chart area
 * [topMargin, chartBottomEdge]. Optionally reserve half of `labelHeight`
 * on each side so a label box stays fully visible.
 */
export function clampYToChartArea(y: number, chart: IChart, labelHeight?: number): number {
  const top = chart.state.topMargin;
  const bottom = chartBottomEdge(chart);
  if (labelHeight != null && labelHeight > 0) {
    const half = labelHeight / 2;
    return Math.max(top + half, Math.min(y, bottom - half));
  }
  return Math.max(top, Math.min(y, bottom));
}