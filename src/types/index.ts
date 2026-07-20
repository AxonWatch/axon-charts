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
    /** Show axis border lines between chart area and price/time axes. Falls back to layout.textColor. Default: true */
    borderVisible?: boolean;
  };

  // === Grid ===
  grid?: {
    show?: boolean;
    vertLines?: { show?: boolean; color?: string; width?: number };
    horzLines?: { show?: boolean; color?: string; width?: number };
  };

  // === Series ===
  series?: {
    type?: 'candlestick' | 'line' | 'area' | 'bar' | 'heiken-ashi' | 'hollow';
    upColor?: string;
    downColor?: string;
    /** Dedicated color for line/area series. Falls back to upColor if not set. */
    lineColor?: string;
    /** Show a small dot at every close price point (line/area series). Default: false */
    showMarkers?: boolean;
    /** Show a highlighted marker at the latest close price. Default: true */
    showLatestPriceMarker?: boolean;
    /** Animate the latest price marker with a continuous pulse. Default: true */
    showLatestPriceAnimation?: boolean;
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
    upColor?: string;          // default: '#10B981'
    downColor?: string;        // default: '#E11D48'
    /** Percentage of total chart height (0.1-0.5). Default: 0.2 (20%) */
    heightPercent?: number;
    /** Number of decimal places for volume formatting. If null, auto-detects from data. */
    precision?: number | null;
    /** Minimum volume increment - if set, derives precision from it. Example: 0.00000001 for crypto with 8 decimals */
    minMove?: number | null;
  };

  // === RSI Sub-Pane ===
  rsi?: {
    /** Show the RSI sub-pane. Default: false */
    show?: boolean;
    /** RSI period. Default: 14 */
    period?: number;
    /** Percentage of total chart height (0.05-0.5). Default: 0.15 */
    heightPercent?: number;
    /** RSI line color. Default: '#9ca3af' (light gray) */
    color?: string;
    /** Overbought level (reference line). Default: 70 */
    overbought?: number;
    /** Oversold level (reference line). Default: 30 */
    oversold?: number;
    /** Show overbought/oversold reference lines. Default: true */
    showLevels?: boolean;
  };

  // === MACD Sub-Pane ===
  macd?: {
    /** Show the MACD sub-pane. Default: false */
    show?: boolean;
    /** Fast EMA period. Default: 12 */
    fastPeriod?: number;
    /** Slow EMA period. Default: 26 */
    slowPeriod?: number;
    /** Signal EMA period. Default: 9 */
    signalPeriod?: number;
    /** Percentage of total chart height (0.05-0.5). Default: 0.15 */
    heightPercent?: number;
    /** MACD line color. Default: '#3b82f6' (blue) */
    macdColor?: string;
    /** Signal line color. Default: '#f59e0b' (amber) */
    signalColor?: string;
    /** Histogram color (up). Default: '#10B981' (green) */
    histogramUpColor?: string;
    /** Histogram color (down). Default: '#E11D48' (red) */
    histogramDownColor?: string;
  };

  // === Stochastic Sub-Pane ===
  stochastic?: {
    /** Show the Stochastic sub-pane. Default: false */
    show?: boolean;
    /** %K lookback period. Default: 14 */
    kPeriod?: number;
    /** %D smoothing period. Default: 3 */
    dPeriod?: number;
    /** Slow %K smoothing (1 = fast, 3 = slow). Default: 3 */
    smoothK?: number;
    /** Percentage of total chart height (0.05-0.5). Default: 0.15 */
    heightPercent?: number;
    /** %K line color. Default: '#3b82f6' (blue) */
    kColor?: string;
    /** %D line color. Default: '#f59e0b' (amber) */
    dColor?: string;
    /** Overbought level. Default: 80 */
    overbought?: number;
    /** Oversold level. Default: 20 */
    oversold?: number;
    /** Show overbought/oversold reference lines. Default: true */
    showLevels?: boolean;
  };

  // === Williams %R Sub-Pane ===
  williamsR?: {
    show?: boolean;
    period?: number;          // default: 14
    heightPercent?: number;   // default: 0.15
    color?: string;           // default: '#9ca3af'
    overbought?: number;      // default: -20
    oversold?: number;        // default: -80
    showLevels?: boolean;     // default: true
  };

  // === CCI Sub-Pane ===
  cci?: {
    show?: boolean;
    period?: number;          // default: 20
    heightPercent?: number;   // default: 0.15
    color?: string;           // default: '#9ca3af'
    upperLevel?: number;      // default: 100
    lowerLevel?: number;      // default: -100
    showLevels?: boolean;     // default: true
  };

  // === MFI Sub-Pane ===
  mfi?: {
    show?: boolean;
    period?: number;          // default: 14
    heightPercent?: number;   // default: 0.15
    color?: string;           // default: '#9ca3af'
    overbought?: number;      // default: 80
    oversold?: number;        // default: 20
    showLevels?: boolean;     // default: true
  };

  // === ATR Sub-Pane ===
  atr?: {
    show?: boolean;
    period?: number;          // default: 14
    heightPercent?: number;   // default: 0.15
    color?: string;           // default: '#9ca3af'
  };

  // === ADX Sub-Pane ===
  adx?: {
    show?: boolean;
    period?: number;          // default: 14
    heightPercent?: number;   // default: 0.15
    adxColor?: string;        // default: '#3b82f6'
    plusDiColor?: string;     // default: '#10B981'
    minusDiColor?: string;    // default: '#E11D48'
    threshold?: number;       // default: 25 (reference line)
    showThreshold?: boolean;  // default: true
  };

  // === Attribution Logo ===
  attribution?: {
    /** Show the Axon.Watch attribution logo at bottom-left. Default: true */
    show?: boolean;
  };

  // === Drawings ===
  drawing?: {
    /** When true, drawing anchors snap to the nearest OHLC of the bar under the cursor.
     *  Default: false (free placement). */
    magnet?: boolean;
  };

  // === Callbacks ===
  /** Fires when visible range changes (scroll, zoom, resize). */
  onVisibleRangeChange?: VisibleRangeChangeCallback;
  /** Fires when crosshair position changes. */
  onCrosshairMove?: CrosshairMoveCallback;
  /** Fires when a bar is clicked. */
  onBarClick?: BarClickCallback;
  /** Fires when scroll lock state changes. */
  onScrollLockChange?: ScrollLockChangeCallback;
  /** Fires when data is appended or updated. */
  onDataUpdate?: ((bars: Bar[]) => void) | null;
  /** Fires once per candle close (new bar appended via updateLastBar/updateLastBarFast). Receives the finalized closed bar. */
  onCandleClose?: CandleCloseCallback;
  /** Fires when the user clicks an on-chart indicator label (sub-pane or overlay).
   *  The integrating app can use this to open a settings panel.
   *  id: the sub-pane id (e.g. 'rsi') or overlay id (e.g. 'sma-20').
   *  type: 'subpane' for indicators in a separate pane, 'overlay' for main-chart overlays. */
  onIndicatorClick?: (id: string, type: 'subpane' | 'overlay') => void;

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
 * Callback invoked when a candle closes and a new candle opens.
 * Fires once per actual candle close (when the incoming bar's timestamp
 * differs from the last bar's timestamp, causing a new bar to be appended).
 * Receives the finalized (closed) bar — its O/H/L/C/volume are the final
 * values for that period.
 *
 * Triggered by `updateLastBar()` and `updateLastBarFast()` only.
 * Does NOT fire from `setData()`, `appendBar()`, or `prependData()` (bulk loads).
 */
export type CandleCloseCallback = (closedBar: Bar) => void;

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
 * Type-specific payload for a drawing. Fields are optional and interpreted
 * by the drawing's renderer. Unknown fields are allowed so user-registered
 * drawing types can carry their own data without extending this interface.
 */
export interface DrawingData {
  // === Position / Order (shared side/qty fields) ===
  /** Side. Required by 'position' and 'order' drawing types. 'long' = buy, 'short' = sell. */
  side?: 'long' | 'short';
  /** Size/quantity. Required by 'position' and 'order' drawing types. */
  qty?: number;
  /** Stop-loss price level (optional, position only). Draws a dashed red line. */
  sl?: number;
  /** Take-profit price level (optional, position only). Draws a dashed green line. */
  tp?: number;
  /** Lifecycle status. Renderers may style non-working states differently. */
  status?: 'open' | 'closed' | 'pending' | 'working' | 'cancelled' | 'filled' | 'rejected';
  /** Order kind. Required by the 'order' drawing type. */
  kind?: 'limit' | 'stop' | 'stop_limit' | 'market';

  // === Two-point drawings (trendline, box, fib, measure) ===
  /** Stroke width in pixels (default 1). */
  lineWidth?: number;
  /** Stroke style (default 'solid'). */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  /** Extend the line beyond its anchors. Used by trendline. */
  extend?: 'none' | 'left' | 'right' | 'both';
  /** Fill color for closed shapes (box). Semi-transparent recommended. */
  fill?: string;

  // === Text (multi-line annotation) ===
  /** Multi-line text content. Each entry is one line. */
  lines?: string[];
  /** Text background fill (semi-transparent recommended). Defaults to 10%-alpha of color. */
  textFill?: string;

  // === Custom (user-registered drawing types) ===
  [key: string]: unknown;
}

/**
 * A persistent drawing on the chart (arrow, label, line, position, etc.)
 * Rendered on the main canvas overlay every frame. Used by drawing tools,
 * plugins, and external apps (e.g. to mark trading positions).
 *
 * Anchoring:
 *   - `time` is preferred over `barIndex` because it survives maxBars
 *     auto-cleanup (oldest bars are spliced out, shifting barIndex but
 *     leaving time stable). Set `time` for any drawing that should
 *     persist across data cleanup.
 *   - `barIndex` alone is fine for short-lived drawings or when the
 *     chart's data won't be pruned.
 *
 * Single-point drawings (arrow, label, hline, vline, position) use
 * {barIndex|time, price}. Two-point drawings (trendline, box — future)
 * additionally use {barIndex2|time2, price2}.
 *
 * Type-specific fields (side, qty, sl, tp, lineWidth, fill, etc.) live
 * in the optional `data` bag. See DrawingData.
 */
export interface Drawing {
  id: string;
  /**
   * Drawing type identifier. Built-in values: 'arrow_up', 'arrow_down',
   * 'label', 'hline', 'vline', 'position'. Custom types can be registered
   * via Chart.registerDrawingType().
   */
  type: string;
  color: string;
  text?: string;

  // === Primary anchor ===
  /** Bar index this drawing attaches to. Optional — prefer `time` for stability. */
  barIndex?: number;
  /** Anchor timestamp (preferred over barIndex — survives maxBars cleanup). */
  time?: number;
  /** Price level at the primary anchor. Optional for vline (barIndex-only). */
  price?: number;

  // === Secondary anchor (two-point drawings: trendline, box — future) ===
  barIndex2?: number;
  time2?: number;
  price2?: number;

  // === Type-specific payload ===
  /** Optional data bag interpreted by the drawing's renderer. */
  data?: DrawingData;
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
    /** Binary search for a bar by timestamp. Used by drawing anchor resolution. */
    getBarAtTime(timestamp: number): Bar | undefined;
  };
  renderer: {
    createBuffer(): void;
    /** Lightweight: re-draw only the last candle in the buffer */
    updateLastCandleInBuffer(): void;
    /** Get cached series-specific computed values (e.g., HA O/H/L/C for heiken-ashi) */
    getSeriesCache(): Record<string, unknown> | null;
    /** Redraw the viewport (buffer + overlays) without full render */
    drawViewport(ctx: CanvasRenderingContext2D): void;
  };
  priceFormatter: {
    formatPrice(price: number): string;
  };
  onScrollLockChange?: ScrollLockChangeCallback;
  onCrosshairMove?: CrosshairMoveCallback;
  onBarClick?: BarClickCallback;
  onVisibleRangeChange?: VisibleRangeChangeCallback;
  onDataUpdate?: ((bars: Bar[]) => void) | null;
  onCandleClose?: CandleCloseCallback;
  timeScale(): import('../api/time-scale.js').TimeScaleAPI;
  setOptions(partial: Partial<ChartOptions>): void;
  getActiveSubPanes(): import('../subpanes/SubPane.js').SubPane[];
  render(): void;
  prependData(bars: Bar[]): void;
  isAutoScrolling(): boolean;
  scrollToLatest(): void;
  triggerVisibleRangeChange(): void;
  /** Drawing API — add/remove/list persistent chart drawings */
  addDrawing(drawing: Drawing): void;
  removeDrawing(id: string): void;
  clearDrawings(): void;
  getDrawings(): Drawing[];
  /** Update an existing drawing in place (used by the drag interaction layer). */
  updateDrawing(id: string, updates: Partial<Drawing>): void;
  /** Get the currently selected drawing id, or null. */
  getSelectedDrawingId(): string | null;
  /** Select a drawing (draws a selection outline) or null to clear. */
  selectDrawing(id: string | null): void;
  /** Get the currently hovered handle (drawingId + handleId), or null. Used by renderers to draw hover highlights. */
  getHoveredHandle(): { drawingId: string; handleId: string } | null;
  /** Enter drawing-creation mode. Click on the chart to place anchor 1, move + click to place anchor 2, commit. */
  beginDrawing(type: string): void;
  /** Cancel drawing-creation mode (Escape or second click on the same point). */
  cancelDrawing(): void;
  /** True when drawing-creation mode is active. */
  isDrawing(): boolean;
  /** Get the in-progress drawing's preview anchor (first click), or null. */
  getDrawingPreview(): { time: number; price: number; time2?: number; price2?: number } | null;
  /** Get the visual shape category for the rubber-band preview ('line' | 'rect' | 'hline' | 'vline' | 'point' | null). */
  getDrawingPreviewShape(): 'line' | 'rect' | 'hline' | 'vline' | 'point' | null;
  /** Toggle drawing magnet mode at runtime. When on, anchors snap to nearest OHLC. */
  setDrawingMagnet(enabled: boolean): void;
  /** Route a mousedown to the drawing controller (create mode). Returns true if consumed. */
  routeDrawingMouseDown(x: number, y: number): boolean;
  /** Route a mousemove to the drawing controller (create mode preview update). */
  routeDrawingMouseMove(x: number, y: number): void;
  /** Register a custom drawing type (e.g. 'fib') with its renderer. */
  registerDrawingType(type: string, renderer: import('../drawings/DrawingRenderer.js').DrawingRenderer): void;
  /** Add an overlay indicator (drawn on top of candles on the main chart). */
  addOverlay(overlay: import('../overlays/Overlay.js').Overlay): void;
  /** Remove an overlay by id. */
  removeOverlay(id: string): void;
  /** Get all registered overlays. */
  getOverlays(): import('../overlays/Overlay.js').Overlay[];
  /** Update a sub-pane indicator's options at runtime (e.g. chart.setIndicatorOptions('rsi', { period: 21 })). */
  setIndicatorOptions(id: string, options: Record<string, any>): void;
}