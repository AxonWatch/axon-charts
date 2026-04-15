/**
 * Centralized layout constants
 * Single source of truth for all positioning calculations
 */
export const LAYOUT = {
  // === Structural Margins ===
  TOP_MARGIN: 40,
  BOTTOM_MARGIN: 35,
  RIGHT_GAP: 60,
  
  // === Label Styling ===
  LABEL_WIDTH: 50,
  LABEL_HEIGHT: 20,
  CURRENT_PRICE_LABEL_HEIGHT: 30,
  LABEL_OFFSET: 15, // Distance of labels from axis edge
  TIME_LABEL_Y: 23, // Vertical offset for time labels
  
  // === Interaction ===
  COLLISION_THRESHOLD: 25,
  AUTO_SCROLL_BUFFER: 8,
  DEFAULT_RIGHT_PADDING_BARS: 2,
  
  // === Behavior & Scaling ===
  ZOOM_FACTOR_IN: 1.15,
  ZOOM_FACTOR_OUT: 0.87,
  PRICE_SCROLL_FACTOR_IN: 1.1,
  PRICE_SCROLL_FACTOR_OUT: 0.9,
  MAX_ZOOM_DIVISOR: 2.9,   
  DRAG_SCALE_DIVISOR: 200, 
  ZOOM_SENSITIVITY: 20,
  
  // === Candle Rendering ===
  CANDLE_GAP_RATIO: 0.8,
  MIN_BAR_WIDTH: 4,
  MAX_BUFFER_WIDTH: 4000,
  BUFFER_RECREATION_THRESHOLD: 10,
  
  // === Axis & UI Styling ===
  NICE_THRESHOLD_LOW: 1.5,
  NICE_THRESHOLD_MID: 3,
  NICE_THRESHOLD_HIGH: 7,
  TIME_LABEL_TARGET_PIXELS: 80,
  DEFAULT_TIME_INTERVAL: 60000,
  DEFAULT_MAX_BARS: 5000,
  DEFAULT_PRICE_RANGE: { min: 0, max: 100 },
  PRICE_PADDING_RATIO: 0.07,
  CURRENT_PRICE_LABEL_ALPHA: 0.2,
  TOOLTIP_MARGIN_X: 10,
  TOOLTIP_MARGIN_Y: 15,
  TOOLTIP_LABEL_SPACING: 15,
  OFFSCREEN_PRICE_FALLBACK: -1000
} as const;

/**
 * Calculate usable chart height
 */
export function getUsableHeight(height: number): number {
  return height - LAYOUT.TOP_MARGIN - LAYOUT.BOTTOM_MARGIN;
}

/**
 * Calculate usable chart width
 */
export function getUsableWidth(width: number): number {
  return width - LAYOUT.RIGHT_GAP;
}
