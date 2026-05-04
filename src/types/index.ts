/**
 * OHLC Candlestick data structure
 */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Main configuration object for the chart
 */
export interface ChartOptions {
  // === Layout ===
  layout?: {
    width?: number | 'auto';
    height?: number | 'auto';
    background?: string;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
  };

  // === Grid ===
  grid?: {
    show?: boolean;
    vertLines?: { show?: boolean; color?: string; width?: number };
    horzLines?: { show?: boolean; color?: string; width?: number };
  };

  // === Series (Candle Colors) ===
  series?: {
    upColor?: string;
    downColor?: string;
  };

  // === Price Scale ===
  priceScale?: {
    mode?: 'linear' | 'logarithmic';
    scaleMargins?: { top?: number; bottom?: number };
    priceFormat?: PriceFormat;
    /** Current price line options */
    currentPrice?: {
      showCountdown?: boolean;
      countdownColor?: string;
    };
  };

  // === Time Scale ===
  timeScale?: {
    visible?: boolean;
    timeVisible?: boolean;
    secondsVisible?: boolean;
    showFullDate?: boolean;
    rightOffset?: number;
    barSpacing?: number;
    minBarSpacing?: number;
    maxBarSpacing?: number;
  };

  // === Crosshair ===
  crosshair?: {
    mode?: 'normal' | 'magnet' | 'none';
    showLabels?: boolean;
    showTooltip?: boolean;
    vertLine?: { color?: string; width?: number; style?: 'solid' | 'dashed' };
    horzLine?: { color?: string; width?: number; style?: 'solid' | 'dashed' };
    rightClickMenu?: boolean;
  };

  // === Behavior ===
  behavior?: {
    dragToZoom?: boolean;
    scrollToZoom?: boolean;
    pinchToZoom?: boolean;
    panOnMouseDrag?: boolean;
    dragPriceScale?: boolean;
    autoScroll?: boolean;
  };

  // === Data Limits ===
  data?: {
    maxBars?: number;
    autoCleanup?: boolean;
  };

  // === Market Info ===
  market?: {
    baseAsset?: string;
    quoteAsset?: string;
    timeframe?: string;
    source?: string;
    show?: boolean;
  };

  // === Watermark ===
  watermark?: {
    text?: string;
    color?: string;
    /** If null, auto-scales to ~30% of chart width. Set a number to override. */
    fontSize?: number | null;
    opacity?: number;
    show?: boolean;
    /** If true, renders diagonally at -45°. Default false (horizontal, centered). */
    rotate?: boolean;
  };

  // === Init-Only ===
  /** Custom device pixel ratio (defaults to window.devicePixelRatio) — only read at init */
  devicePixelRatio?: number;
}

/**
 * Price formatting options
 */
export interface PriceFormat {
  type: 'price' | 'volume' | 'percent' | 'custom';
  precision?: number;
  minMove?: number;
  formatter?: (price: number) => string;
}

export type ScrollLockChangeCallback = (locked: boolean) => void;

/**
 * Callback invoked when crosshair position changes
 */
export type CrosshairMoveCallback = (param: {
  time: number;
  price: number;
  bar?: Bar;
}) => void;

/**
 * Callback invoked when a bar is clicked
 */
export type BarClickCallback = (bar: Bar, index: number) => void;

/**
 * Callback invoked when the visible range changes
 */
export type VisibleRangeChangeCallback = (range: {
  fromIndex: number;
  toIndex: number;
  fromTime: number;
  toTime: number;
}) => void;

/**
 * Command type for LLM-driven chart control
 */
export type ChartCommand =
  | { type: 'setVisibleRange'; from: number; to: number }
  | { type: 'scrollToTime'; time: number }
  | { type: 'zoomIn'; factor?: number }
  | { type: 'zoomOut'; factor?: number }
  | { type: 'fitContent' }
  | { type: 'setPriceScale'; mode: 'linear' | 'logarithmic' }
  | { type: 'setCrosshair'; mode: 'normal' | 'magnet' | 'none' };

/**
 * Chart state for serialization
 */
export interface ChartState {
  version: string;
  options: Required<ChartOptions>;
  data: Bar[];
  viewport: {
    offsetX: number;
    barWidth: number;
    priceScale: number;
    priceOffset: number;
  };
}

/**
 * Interface for the main Chart component to enable circular type safety in sub-modules
 */
export interface IChart {
  readonly container: HTMLElement;
  readonly mainCanvas: HTMLCanvasElement;
  options: Required<ChartOptions>;
  state: {
    w: number;
    h: number;
    devicePixelRatio: number;
    barWidth: number;
    baseBarWidth: number;
    offsetX: number;
    priceMin: number;
    priceMax: number;
    data: Bar[];
    rightGap: number;
    topMargin: number;
    bottomMargin: number;
    priceScale: number;
    priceOffset: number;
    priceScaleMode: 'linear' | 'logarithmic';
    axisWidth: number;
  };
  dataManager: {
    readonly data: Bar[];
    readonly length: number;
    readonly isEmpty: boolean;
    getPriceRange(start: number, count: number, scaleMargins?: { top?: number; bottom?: number }): { min: number; max: number };
  };
  renderer: {
    createBuffer(): void;
    /** Lightweight: re-draw only the last candle in the buffer */
    updateLastCandleInBuffer(): void;
  };
  priceFormatter: {
    formatPrice(price: number): string;
  };
  onScrollLockChange?: ScrollLockChangeCallback;
  onCrosshairMove?: CrosshairMoveCallback;
  onBarClick?: BarClickCallback;
  onVisibleRangeChange?: VisibleRangeChangeCallback;
  render(): void;
  isAutoScrolling(): boolean;
  scrollToLatest(): void;
}
