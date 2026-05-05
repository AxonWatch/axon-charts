/**
 * Centralized layout constants
 * Single source of truth for all positioning calculations
 */
export declare const LAYOUT: {
    readonly TOP_MARGIN: 40;
    readonly BOTTOM_MARGIN: 35;
    readonly RIGHT_GAP: 60;
    readonly LABEL_WIDTH: 50;
    readonly LABEL_HEIGHT: 20;
    readonly CURRENT_PRICE_LABEL_HEIGHT: 30;
    readonly LABEL_OFFSET: 15;
    readonly TIME_LABEL_Y: 23;
    readonly COLLISION_THRESHOLD: 25;
    readonly AUTO_SCROLL_BUFFER: 8;
    readonly DEFAULT_RIGHT_PADDING_BARS: 2;
    readonly ZOOM_FACTOR_IN: 1.15;
    readonly ZOOM_FACTOR_OUT: 0.87;
    readonly PRICE_SCROLL_FACTOR_IN: 1.1;
    readonly PRICE_SCROLL_FACTOR_OUT: 0.9;
    readonly MAX_ZOOM_DIVISOR: 2.9;
    readonly DRAG_SCALE_DIVISOR: 200;
    readonly ZOOM_SENSITIVITY: 20;
    readonly CANDLE_GAP_RATIO: 0.8;
    readonly MIN_BAR_WIDTH: 4;
    readonly MAX_BUFFER_WIDTH: 4000;
    readonly BUFFER_RECREATION_THRESHOLD: 10;
    readonly NICE_THRESHOLD_LOW: 1.5;
    readonly NICE_THRESHOLD_MID: 3;
    readonly NICE_THRESHOLD_HIGH: 7;
    readonly TIME_LABEL_TARGET_PIXELS: 80;
    readonly DEFAULT_TIME_INTERVAL: 60000;
    readonly DEFAULT_MAX_BARS: 5000;
    readonly DEFAULT_PRICE_RANGE: {
        readonly min: 0;
        readonly max: 100;
    };
    readonly PRICE_PADDING_RATIO: 0.07;
    readonly CURRENT_PRICE_LABEL_ALPHA: 0.2;
    readonly TOOLTIP_MARGIN_X: 10;
    readonly TOOLTIP_MARGIN_Y: 15;
    readonly TOOLTIP_LABEL_SPACING: 15;
    readonly OFFSCREEN_PRICE_FALLBACK: -1000;
};
/**
 * Calculate usable chart height
 */
export declare function getUsableHeight(height: number): number;
/**
 * Calculate usable chart width
 */
export declare function getUsableWidth(width: number): number;
//# sourceMappingURL=layout.d.ts.map