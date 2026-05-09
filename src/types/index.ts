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
    mode?: 'linear' | 'logarithmic' | 'percentage';
    scaleMargins?: { top?: number; bottom?: number };
    priceFormat?: PriceFormat;
    /** Current price line options */
    currentPrice?: {
      /** Show/hide the current price line and label. Default: true */
      show?: boolean;
      /** Show/hide only the dashed line across the chart (label stays visible). Default: true */
      showLine?: boolean;
      showCountdown?: boolean;
      /** Color for the countdown text. If null, falls back to currentPrice.textColor, then layout.textColor */
      countdownColor?: string;
      /** Bullish line color. Falls back to series.upColor if not set */
      upColor?: string;
      /** Bearish line color. Falls back to series.downColor if not set */
      downColor?: string;
      /** Line style: 'dashed' or 'solid'. Default: 'dashed' */
      lineStyle?: 'dashed' | 'solid';
      /** Price label text color. Falls back to layout.textColor if not set */
      textColor?: string;
    };
    /** Reverse price axis: false = normal (high at top), true = inverted (high at bottom) */
    reverse?: boolean;
  };

  // === Time Scale ===
  timeScale?: {
    visible?: boolean;
    timeVisible?: boolean;
    secondsVisible?: boolean;
    showFullDate?: boolean;
    showDayOfWeek?: boolean;
    dateFormat?: string;
    /** IANA timezone (e.g. 'America/New_York', 'UTC'). Omit for browser local. */
    timezone?: string;
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
  };

  // === Right-Click Context Menu ===
  menu?: {
    /** Master toggle for the right-click context menu. Default: true */
    enabled?: boolean;
    /** Array of item IDs to show in the menu, in order.
     *  Available IDs: 'copy', 'save', 'grid', 'volume', 'crosshair', 'market',
     *  'watermark', 'fit-content', 'reset-price', 'reverse', 'fullscreen'
     *  Omit or set to null/undefined to show all defaults. */
    items?: string[];
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
    /** Font size for the header label. Default: 20 (tooltip is 12, so header stands out) */
    fontSize?: number;
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

  // === LLM Context Exposure ===
  context?: {
    /** Controls whether getContext() returns visible bars, latest bar, and sub-panes.
     *  false (default): only viewport metadata. true: full trading data exposure. */
    exposeData?: boolean;
    /** Controls whether the chart registers in the global window.__AXON_CHARTS__ registry.
     *  When true, AI agents with the Axon Charts skill can discover and interact with this chart.
     *  Set to false for stealth mode (agents won't know this is an Axon Charts chart). */
    discoverable?: boolean;
    /** Optional identifier for this chart instance in the global registry.
     *  Used by AI agents to target specific charts in multi-chart environments.
     *  Auto-generated from market.baseAsset/quoteAsset if available, or auto-incremented.
     *  Also set as a DOM attribute: data-axon-charts-id="{id}" on the container element. */
    id?: string;
  };

  // === Volume Sub-Pane ===
  volume?: {
    show?: boolean;            // default: false
    upColor?: string;          // default: '#22c55e'
    downColor?: string;        // default: '#ef4444'
    /** Percentage of total chart height (0.1-0.5). Default: 0.2 (20%) */
    heightPercent?: number;
    /** Number of decimal places for volume formatting. If null, auto-detects from data. */
    precision?: number | null;
    /** Minimum volume increment - if set, derives precision from it. Example: 0.00000001 for crypto with 8 decimals */
    minMove?: number | null;
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
  | { type: 'setPriceScale'; mode: 'linear' | 'logarithmic' | 'percentage' }
  | { type: 'setCrosshair'; mode: 'normal' | 'magnet' | 'none' }
  | { type: 'setSubPane'; id: string; show: boolean }
  | { type: 'setReverse'; reverse: boolean };

/**
 * Chart state for serialization
 */
export interface ChartState {
  version: string;
  options: Required<ChartOptions>;
  data: Bar[];
  referencePrice: number;
  priceScaleMode: 'linear' | 'logarithmic' | 'percentage';
  reverse: boolean;
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
    /** Bottom edge of the main chart area (above sub-pane if visible) */
    chartBottom: number;
    /** Height of the sub-pane area in pixels (0 if no sub-pane) */
    subPaneHeight: number;
    priceScale: number;
    priceOffset: number;
    priceScaleMode: 'linear' | 'logarithmic' | 'percentage';
    axisWidth: number;
    reverse: boolean;
    /** Reference price for percentage mode (first visible bar close) */
    referencePrice: number;
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
  timeScale(): import('../api/time-scale.js').TimeScaleAPI;
  setOptions(partial: Partial<ChartOptions>): void;
  getActiveSubPanes(): import('../subpanes/SubPane.js').SubPane[];
  render(): void;
  isAutoScrolling(): boolean;
  scrollToLatest(): void;
  triggerVisibleRangeChange(): void;
}
