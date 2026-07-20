import { DataManager } from './data.js';
import { Renderer } from './renderer.js';
import { Crosshair } from '../ui/crosshair.js';
import { EventManager } from '../interaction/events.js';
import { ChartOptions, Bar, Drawing, ScrollLockChangeCallback, ChartCommand, ChartState, CrosshairMoveCallback, BarClickCallback, VisibleRangeChangeCallback, CandleCloseCallback } from '../types/index.js';
import { LIB_VERSION } from '../version.js';
import { LAYOUT } from './layout.js';
import { priceToY, indexToX, xToIndex, deriveVisibleStartIdx, clampOffsetX, calculateRightEdgeOffset } from '../utils/projection.js';
import { deepMerge, deepClone } from '../utils/merge.js';
import { PriceFormatter } from '../utils/formatter.js';
import { PriceScaleAPI } from '../api/price-scale.js';
import { TimeScaleAPI } from '../api/time-scale.js';
import { CrosshairAPI } from '../api/crosshair.js';
import { validateOptions, validateDrawing } from '../utils/validation.js';
import { registerDrawingType as registerDrawingTypeImpl } from '../drawings/registry.js';
import type { DrawingRenderer } from '../drawings/DrawingRenderer.js';
import { DrawingController } from '../interaction/drawing-controller.js';
import { VolumeSubPane } from '../subpanes/VolumeSubPane.js';
import { Attribution } from '../ui/Attribution.js';
import type { SubPane } from '../subpanes/SubPane.js';

const DEFAULT_OPTIONS = {
  layout: {
    width: 'auto',
    height: 'auto',
    background: '#1a1a1a',
    textColor: '#ffffff',
    fontSize: 12,
    fontFamily: 'system-ui',
    padding: { top: 40, right: 60, bottom: 35, left: 10 },
    borderVisible: false
  },
  grid: {
    show: true,
    vertLines: { show: true, color: '#2a2a2a', width: 1 },
    horzLines: { show: true, color: '#2a2a2a', width: 1 }
  },
  series: {
    type: 'candlestick',
    upColor: '#10B981',
    downColor: '#E11D48',
    lineColor: '#1E90FF',
    showMarkers: false,
    showLatestPriceMarker: true,
    showLatestPriceAnimation: true
  },
  priceScale: {
    mode: 'linear',
    scaleMargins: { top: 0.1, bottom: 0.1 },
    currentPrice: {
      show: true,
      showLine: true,
      showCountdown: false,
      countdownColor: 'rgba(255, 255, 255, 0.8)',
      lineStyle: 'dashed'
    },
    reverse: false
  },
  timeScale: {
    visible: true,
    timeVisible: true,
    secondsVisible: false,
    showFullDate: true,
    showDayOfWeek: true,
    dateFormat: 'MMM dd, yyyy',
    timezone: undefined,
    rightOffset: 80,
    barSpacing: 11,
    minBarSpacing: 4,
    maxBarSpacing: 1000
  },
  crosshair: {
    mode: 'magnet',
    showLabels: true,
    showTooltip: true,
    vertLine: { color: '#555555', width: 1, style: 'dashed' },
    horzLine: { color: '#555555', width: 1, style: 'dashed' },
  },
  menu: {
    enabled: true,
    items: undefined
  },
  behavior: {
    dragToZoom: true,
    scrollToZoom: true,
    pinchToZoom: true,
    panOnMouseDrag: true,
    dragPriceScale: true,
    autoScroll: true
  },
  data: {
    maxBars: 5000,
    autoCleanup: true
  },
  market: {
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    timeframe: '1m',
    source: '',
    show: false,
    fontSize: 15
  },
  watermark: {
    text: '',
    color: '#ffffff',
    fontSize: null,
    opacity: 0.07,
    show: false,
    rotate: false
  },
  attribution: {
    show: true
  },
  drawing: {
    magnet: false
  },
  context: {
    exposeData: false
  },
  volume: {
    show: false,
    upColor: '#10B981',
    downColor: '#E11D48',
    heightPercent: 0.2
  }
};

/**
 * Generate a chart ID for the global __AXON_CHARTS__ registry.
 *
 * Priority:
 * 1. User-provided context.id (used verbatim)
 * 2. Opaque random token (ax-xxxxxx) — no pair inference, no stale associations.
 *
 * Opaque IDs force agents to read state.market for instrument info.
 * User-provided IDs are used verbatim (user takes responsibility for meaning).
 */
function generateChartId(options: ChartOptions): string {
  if (options.context?.id && options.context.id.trim().length > 0) {
    return options.context.id.trim();
  }
  return 'ax-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Main Chart class - Core candlestick chart implementation
 */
export class Chart {
  public readonly container: HTMLElement;
  public options: Required<ChartOptions>;

  // Canvas layers
  private bgCanvas!: HTMLCanvasElement;
  mainCanvas!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;
  private mainCtx!: CanvasRenderingContext2D;

  // UI modules
  public crosshair!: Crosshair;

  // Sub-panes (indicators, volume, etc.)
  private subPanes: Map<string, SubPane> = new Map();
  private _subPaneShow: Map<string, boolean> = new Map();
  public volumeSubPane!: VolumeSubPane;

  // Chart state
  public state: {
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
    chartBottom: number;
    subPaneHeight: number;
    priceScale: number;
    priceOffset: number;
    priceScaleMode: 'linear' | 'logarithmic' | 'percentage';
    axisWidth: number;
    reverse: boolean;
    referencePrice: number;
  };

  // Core modules
  /** Chart identifier in global __AXON_CHARTS__ registry */
  public readonly axonId: string = "";
  public dataManager: DataManager;
  public renderer: Renderer;
  public eventManager: EventManager;
  priceFormatter!: PriceFormatter;
  private priceScaleAPI: PriceScaleAPI;
  private timeScaleAPI: TimeScaleAPI;
  private _crosshairAPI: CrosshairAPI;

  // Attribution logo overlay
  private attribution!: Attribution;

  // Real-time Countdown management
  private countdownRafId: number | null = null;
  private _destroyed: boolean = false;
  private lastCountdownUpdate: number = 0;

  // Callbacks
  public onScrollLockChange?: ScrollLockChangeCallback;
  public onCrosshairMove?: CrosshairMoveCallback;
  public onBarClick?: BarClickCallback;
  public onVisibleRangeChange?: VisibleRangeChangeCallback;
  public onDataUpdate?: ((bars: Bar[]) => void) | null = null;
  public onCandleClose?: CandleCloseCallback;
  private _drawings: Drawing[] = [];
  private _selectedDrawingId: string | null = null;
  /** Drawing-creation mode controller (click-to-create new drawings). */
  private drawingController: DrawingController;

  // Event handlers stored for proper removal
  private readonly handleResizeBound: () => void;
  private resizeObserver: ResizeObserver | null = null;
  private isResizing = false;

  constructor(container: HTMLElement | string, options: ChartOptions = {}) {
    // 1. Validation
    if (!container) throw new Error('AxonCharts: Container element is required');
    
    this.container = typeof container === 'string'
      ? document.querySelector(container)!
      : container;

    if (!this.container) {
      throw new Error(`AxonCharts: Container "${container}" not found`);
    }

    // 2. Validate and initialize options
    validateOptions(options);
    this.options = this.normalizeOptions(options);

    // Wire up callbacks from options
    this.onVisibleRangeChange = options.onVisibleRangeChange;
    this.onCrosshairMove = options.onCrosshairMove;
    this.onBarClick = options.onBarClick;
    this.onScrollLockChange = options.onScrollLockChange;
    this.onDataUpdate = options.onDataUpdate ?? null;
    this.onCandleClose = options.onCandleClose;

    // 3. Initialize state
    this.state = {
      w: 0,
      h: 0,
      devicePixelRatio: this.options.devicePixelRatio || window.devicePixelRatio || 1,
      barWidth: this.options.timeScale.barSpacing ?? 6,
      baseBarWidth: this.options.timeScale.barSpacing ?? 6,
      offsetX: 0,
      priceMin: 0,
      priceMax: 100,
      data: [],
      rightGap: this.options.timeScale.rightOffset ?? 0,
      topMargin: this.options.layout.padding?.top ?? LAYOUT.TOP_MARGIN,
      bottomMargin: this.options.layout.padding?.bottom ?? LAYOUT.BOTTOM_MARGIN,
      priceScale: 1.0,
      priceOffset: 0,
      priceScaleMode: this.options.priceScale.mode ?? 'linear',
      axisWidth: this.options.layout.padding?.right ?? LAYOUT.RIGHT_GAP,
      chartBottom: 0,
      subPaneHeight: 0,
      reverse: this.options.priceScale.reverse ?? false,
      referencePrice: 0
    };

    // 4. Initialize core modules
    this.dataManager = new DataManager(this.options.data.maxBars ?? 5000);
    this.dataManager.setAutoCleanup(this.options.data.autoCleanup ?? true);
    this.priceFormatter = new PriceFormatter(this.options.priceScale.priceFormat);
    this.renderer = new Renderer(this);
    this.initCanvases();
    this.crosshair = new Crosshair(this);
    this._crosshairAPI = new CrosshairAPI(this, this.crosshair);
    this.drawingController = new DrawingController(this);
    this.eventManager = new EventManager(this);
    this.attribution = new Attribution(this);
    this.priceScaleAPI = new PriceScaleAPI(this);
    this.timeScaleAPI = new TimeScaleAPI(this);

    // Initialize sub-panes
    this.volumeSubPane = new VolumeSubPane(this);
    this.addSubPane(this.volumeSubPane);

    this.startCountdownTimer();

    // Generate chart ID for AI agent registry (handles user-provided ID, market pair, or auto-increment)
    this.axonId = generateChartId(this.options);

    // Register in global AI agent registry
    if (typeof window !== 'undefined' && this.options.context.discoverable !== false) {
      const registry = (window as any).__AXON_CHARTS__;
      if (registry) {
        registry.charts[this.axonId] = this;
      }
      // Set DOM attribute for agent discovery
      this.container.setAttribute('data-axon-charts-id', this.axonId);
    }

    // 5. Setup Resize Listeners (Memory Leak Protected)
    this.handleResizeBound = () => {
      try {
        this.resize();
      } catch (error) {
        console.warn('AxonCharts: Window resize error:', error);
      }
    };
    window.addEventListener('resize', this.handleResizeBound);

    // Use ResizeObserver for better container resize tracking
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        try {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              this.resize(width, height);
            }
          }
        } catch (error) {
          // Silently handle ResizeObserver errors to prevent SES exceptions
          console.warn('AxonCharts: ResizeObserver callback error:', error);
        }
      });
      this.resizeObserver.observe(this.container);
    }

    // Initial resize (delayed to ensure container layout is complete)
    requestAnimationFrame(() => {
      try {
        this.resize();
      } catch (error) {
        console.warn('AxonCharts: Initial resize error:', error);
      }
    });
  }

  private initCanvases(): void {
    this.bgCanvas = document.createElement('canvas');
    this.mainCanvas = document.createElement('canvas');

    [this.bgCanvas, this.mainCanvas].forEach(canvas => {
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.display = 'block';
    });

    this.bgCtx = this.bgCanvas.getContext('2d', { alpha: false })!;
    this.mainCtx = this.mainCanvas.getContext('2d', { alpha: true })!;

    // Set the chart font on bgCtx so the first axis-width measurement uses the correct font
    // (updatePriceScale measures before drawBackground sets the font)
    this.bgCtx.font = `${this.options.layout.fontSize}px ${this.options.layout.fontFamily}`;

    this.container.appendChild(this.bgCanvas);
    this.container.appendChild(this.mainCanvas);
  }

  public resize(width?: number, height?: number): void {
    if (this._destroyed) return;
    // Prevent reentrant resize calls (can happen with ResizeObserver + window resize)
    if (this.isResizing) {
      return;
    }

    this.isResizing = true;

    try {
      // If dimensions provided, use them. Otherwise read from container.
      let targetWidth = width;
      let targetHeight = height;

      if (targetWidth === undefined || targetHeight === undefined) {
        // Layout options can override container dimensions
        const containerW = typeof this.options.layout.width === 'number'
          ? this.options.layout.width
          : this.container.clientWidth;
        const containerH = typeof this.options.layout.height === 'number'
          ? this.options.layout.height
          : this.container.clientHeight;

        targetWidth = targetWidth ?? containerW;
        targetHeight = targetHeight ?? containerH;
      }

      // Ensure minimum valid dimensions
      const newWidth = Math.max(1, targetWidth);
      const newHeight = Math.max(1, targetHeight);

      // Skip if dimensions haven't actually changed (prevents unnecessary redraws)
      if (this.state.w === newWidth && this.state.h === newHeight) {
        return;
      }

      const oldWidth = this.state.w;
      // Capture OLD center pixel BEFORE state.w is updated.
      // This is the pixel the user was actually looking at — must use the old
      // width, not the new one, to find the correct center bar.
      const oldCenterX = (oldWidth - this.state.axisWidth) / 2;
      this.state.w = newWidth;
      this.state.h = newHeight;

      // Pre-compute center bar index BEFORE scaling barWidth.
      // Uses oldCenterX (from old width) with old barWidth and old offsetX —
      // a fully consistent old coordinate system. After barWidth is scaled,
      // using the new width's center would mix coordinate systems and pick
      // the wrong bar.
      let preservedCenterIdx = -1;
      if (!this.dataManager.isEmpty && oldCenterX > 0 && this.state.barWidth > 0) {
        const raw = xToIndex(oldCenterX, this.state);
        if (!isNaN(raw) && isFinite(raw)) {
          preservedCenterIdx = Math.max(0, Math.min(Math.round(raw), this.dataManager.length - 1));
        }
      }

      // Scale barWidth to match the new width, preserving the visible range.
      // Without this, candles render at the old pixel width after resize,
      // causing them to appear "cut" at the chart edges.
      if (oldWidth >= 50 && newWidth >= 50 && this.state.barWidth > 0) {
        const ratio = newWidth / oldWidth;
        const minSpacing = this.options.timeScale.minBarSpacing ?? 4;
        const maxSpacing = this.options.timeScale.maxBarSpacing ?? 1000;
        this.state.barWidth = Math.max(minSpacing, Math.min(maxSpacing, this.state.barWidth * ratio));
        this.options.timeScale.barSpacing = this.state.barWidth;
      }

      // Smart resize: Adjust offset based on autoScroll state
      const isAutoScrolling = this.isAutoScrolling();

      try {
        if (isAutoScrolling && !this.dataManager.isEmpty) {
          // Option 1: Anchor to latest candle (user is watching live data)
          this.state.offsetX = calculateRightEdgeOffset(
            this.dataManager.length,
            this.state.barWidth,
            this.state.w,
            this.state.rightGap,
            this.state.axisWidth
          );
        } else if (!this.dataManager.isEmpty) {
          // Option 2: Preserve visible center (user is viewing historical data)
          // Use the pre-computed center index (computed before barWidth scaling
          // so the coordinate system was still consistent).
          if (preservedCenterIdx >= 0) {
            const newChartAreaWidth = this.state.w - this.state.axisWidth;
            const targetCenterPixelX = newChartAreaWidth / 2;
            const targetIndexX = preservedCenterIdx * this.state.barWidth;

            // targetCenterPixelX = targetIndexX + newOffsetX + (barWidth / 2)
            // newOffsetX = targetCenterPixelX - targetIndexX - (barWidth / 2)
            const newOffsetX = targetCenterPixelX - targetIndexX - (this.state.barWidth / 2);

            // Validate newOffsetX before clamping
            if (!isNaN(newOffsetX) && isFinite(newOffsetX)) {
              // Clamp the new offset to prevent off-screen rendering
              this.state.offsetX = clampOffsetX(
                newOffsetX,
                this.state.barWidth,
                this.dataManager.length,
                this.state.w,
                this.state.rightGap,
                this.state.axisWidth
              );
            }
          }
          // If dimensions are invalid or calculations fail, keep existing offset
        }
      } catch (error) {
        // If any calculation fails, log warning and keep existing offset
        console.warn('AxonCharts: Smart resize calculation failed, keeping existing offset:', error);
        // Offset remains unchanged - safe fallback
      }

      [this.bgCanvas, this.mainCanvas].forEach(canvas => {
        canvas.width = this.state.w * this.state.devicePixelRatio;
        canvas.height = this.state.h * this.state.devicePixelRatio;
        canvas.style.width = this.state.w + 'px';
        canvas.style.height = this.state.h + 'px';
      });

      this.bgCtx.setTransform(this.state.devicePixelRatio, 0, 0, this.state.devicePixelRatio, 0, 0);
      this.mainCtx.setTransform(this.state.devicePixelRatio, 0, 0, this.state.devicePixelRatio, 0, 0);
      this.mainCtx.imageSmoothingEnabled = false;

      // Reset font after canvas resize (width/height change resets context state)
      this.bgCtx.font = `${this.options.layout.fontSize}px ${this.options.layout.fontFamily}`;

      this.renderer.createBuffer();
      this.crosshair.resize(this.state.w, this.state.h, this.state.devicePixelRatio);

      try {
        this.render();
        // Trigger visible range change callback after resize
        this.triggerVisibleRangeChange();
      } catch (renderError) {
        console.warn('AxonCharts: Render failed during resize:', renderError);
      }
    } finally {
      // Always reset the resizing flag, even if errors occur
      this.isResizing = false;
    }
  }

  private updatePriceScale(): boolean {
    if (this.dataManager.isEmpty) return false;

    const { h, w, barWidth, priceScale } = this.state;
    const firstVisibleIdx = deriveVisibleStartIdx(this.state, this.dataManager.length);
    
    // Use dynamic axisWidth for visible end calculation
    const visibleEnd = Math.min(
      firstVisibleIdx + Math.ceil((w - this.state.axisWidth) / barWidth) + 5,
      this.dataManager.length
    );

    const range = this.dataManager.getPriceRange(
      firstVisibleIdx,
      visibleEnd - firstVisibleIdx,
      this.options.priceScale.scaleMargins
    );
    const mid = (range.max + range.min) / 2;
    const halfRange = ((range.max - range.min) / 2) * priceScale;

    this.state.priceMin = mid - halfRange;
    this.state.priceMax = mid + halfRange;

    // In percentage mode, convert priceMin/Max to percentage space and set reference price
    if (this.options.priceScale.mode === 'percentage') {
      const firstVisibleBar = this.dataManager.data[firstVisibleIdx];
      if (firstVisibleBar) {
        this.state.referencePrice = firstVisibleBar.open;
        const ref = this.state.referencePrice;
        if (ref > 0) {
          this.state.priceMin = ((mid - halfRange - ref) / ref) * 100;
          this.state.priceMax = ((mid + halfRange - ref) / ref) * 100;
        }
      }
    }

    // --- DYNAMIC AXIS WIDTH ---
    // Ensure font is set before measuring (context state can be lost)
    this.bgCtx.font = `${this.options.layout.fontSize}px ${this.options.layout.fontFamily}`;
    const requiredWidth = this.priceFormatter.measureRequiredWidth(this.bgCtx, this.state.priceMin, this.state.priceMax);

    // Update if required width changed at all (snapping to 5px increments prevents most jitter)
    const currentWidth = this.state.axisWidth;
    if (requiredWidth !== currentWidth) {
      const minAxisWidth = this.options.layout.padding?.right ?? LAYOUT.RIGHT_GAP;
      this.state.axisWidth = Math.max(minAxisWidth, requiredWidth);
      return true;
    }

    return false;
  }

  /**
   * Fast price scale update for high-frequency tick streams.
   * Only recalculates when the last bar's high/low exceeds the current range
   * by more than the hysteresis threshold (1.5% of current range).
   * Prevents micro-updates and flickering during normal noise.
   * Returns true if range expanded (caller should redraw background).
   */
  private updatePriceScaleFast(): boolean {
    if (this.dataManager.isEmpty) return false;

    const lastBar = this.dataManager.data[this.dataManager.length - 1];
    if (!lastBar) return false;

    const currentRange = this.state.priceMax - this.state.priceMin;
    if (currentRange <= 0) return false;

    // Hysteresis: 1.5% threshold prevents jitter from normal market noise
    const threshold = currentRange * 0.015;

    const needsUpdate =
      lastBar.high > this.state.priceMax + threshold ||
      lastBar.low < this.state.priceMin - threshold;

    if (!needsUpdate) return false;

    // Recalculate using existing price range logic
    const { h, w, barWidth, priceScale } = this.state;
    const firstVisibleIdx = deriveVisibleStartIdx(this.state, this.dataManager.length);

    const visibleEnd = Math.min(
      firstVisibleIdx + Math.ceil((w - this.state.axisWidth) / barWidth) + 5,
      this.dataManager.length
    );

    const range = this.dataManager.getPriceRange(
      firstVisibleIdx,
      visibleEnd - firstVisibleIdx,
      this.options.priceScale.scaleMargins
    );
    const mid = (range.max + range.min) / 2;
    const halfRange = ((range.max - range.min) / 2) * priceScale;

    this.state.priceMin = mid - halfRange;
    this.state.priceMax = mid + halfRange;

    // In percentage mode, convert priceMin/Max to percentage space and set reference price
    if (this.options.priceScale.mode === 'percentage') {
      const firstVisibleBar = this.dataManager.data[firstVisibleIdx];
      if (firstVisibleBar) {
        this.state.referencePrice = firstVisibleBar.open;
        const ref = this.state.referencePrice;
        if (ref > 0) {
          this.state.priceMin = ((mid - halfRange - ref) / ref) * 100;
          this.state.priceMax = ((mid + halfRange - ref) / ref) * 100;
        }
      }
    }

    return true;
  }

  private ensureRightGapAndRoll(): void {
    if (!this.options.behavior.autoScroll || !this.isAutoScrolling()) return;
    const { barWidth, axisWidth, w, rightGap } = this.state;
    const totalBars = this.dataManager.length;
    if (totalBars === 0) return;

    // Compute where the right edge WOULD be for the current data length
    const chartAreaWidth = w - axisWidth;
    const rightEdgeOffset = chartAreaWidth - rightGap - 1 - (totalBars * barWidth);

    // Compute how far the user has pushed the latest bar from the right edge
    const userGapPx = this.state.offsetX - rightEdgeOffset;

    // Shift left by one bar to make room for the new bar
    this.state.offsetX -= barWidth;

    // Re-compute right edge with the new bar count
    const newRightEdgeOffset = chartAreaWidth - rightGap - 1 - (totalBars * barWidth) - barWidth;

    // Re-apply the user's gap — preserves their chosen empty space exactly
    this.state.offsetX = newRightEdgeOffset + userGapPx;

    // Only clamp LEFT (bar 0 off-screen right)
    const maxOffsetX = chartAreaWidth - (barWidth * 2);
    this.state.offsetX = Math.min(maxOffsetX, this.state.offsetX);
  }

  public render(): void {
    if (this._destroyed) return;
    this.state.data = this.dataManager.data;

    // === NEW: Generic sub-pane geometry ===
    let totalHeight = 0;
    for (const pane of this.getActiveSubPanes()) {
      const paneHeight = pane.computeHeight(this.state, pane.getOptions());
      totalHeight += paneHeight;
    }
    this.state.subPaneHeight = totalHeight;
    this.state.chartBottom = this.state.h - this.state.bottomMargin - totalHeight;

    const layoutChanged = this.updatePriceScale();

    // Recreate buffer ONLY if layout changed
    if (layoutChanged) {
      this.renderer.createBuffer();
    }

    this.renderer.renderCandles();
    this.renderer.drawBackground(this.bgCtx, true);
    this.renderer.drawViewport(this.mainCtx);

    // === NEW: Render all active sub-panes ===
    let currentTop = this.state.chartBottom;
    for (const pane of this.getActiveSubPanes()) {
      pane.render(this.bgCtx, this, currentTop);
      currentTop += pane.computeHeight(this.state, pane.getOptions());
    }

    this.crosshair.draw();
  }

  /**
   * Trigger onVisibleRangeChange callback with current visible range
   */
  private _lastRangeChangeTime: number = 0;

  public triggerVisibleRangeChange(): void {
    if (!this.onVisibleRangeChange || this.dataManager.isEmpty) return;
    const now = Date.now();
    if (now - this._lastRangeChangeTime < 200) return;
    this._lastRangeChangeTime = now;

    const { w, axisWidth, barWidth, offsetX } = this.state;
    const data = this.dataManager.data;

    const fromIndex = deriveVisibleStartIdx(this.state, data.length);
    const barsVisible = Math.ceil((w - axisWidth) / barWidth);
    const toIndex = Math.min(fromIndex + barsVisible, data.length - 1);

    // Read actual bar.time directly — avoids fictional timestamps during data gaps
    const fromTime = data[fromIndex]?.time ?? Date.now();
    const toTime = data[toIndex]?.time ?? Date.now();

    this.onVisibleRangeChange({
      fromIndex,
      toIndex,
      fromTime,
      toTime
    });
  }

  public setData(bars: Bar[]): void {
    if (!Array.isArray(bars)) throw new Error('AxonCharts: Data must be an array');
    
    // Validate structural integrity of data
    for (const bar of bars) {
      this.validateBar(bar);
    }

    // Invalidate measurement cache — new data means completely different prices
    this.priceFormatter.resetMeasurement();

    this.dataManager.setData(bars, this.options.data.autoCleanup);
    if (this.dataManager.length === 0) return;
    this.state.offsetX = calculateRightEdgeOffset(this.dataManager.length, this.state.barWidth, this.state.w, this.state.rightGap, this.state.axisWidth);
    this.render();
  }

  public appendBar(bar: Bar): void {
    this.validateBar(bar);
    this.dataManager.appendBar(bar);
    this.ensureRightGapAndRoll();
    this.render();
    if (this.onDataUpdate) this.onDataUpdate([bar]);
  }

  /**
   * Prepend historical bars to the beginning of the chart.
   * Keeps the current viewport position — does not jump to the latest bar.
   * Use this in combination with onVisibleRangeChange to load more history
   * when the user scrolls to the first bar.
   */
  public prependData(bars: Bar[]): void {
    if (!Array.isArray(bars)) throw new Error('AxonCharts: Data must be an array');
    if (bars.length === 0) return;

    for (const bar of bars) {
      this.validateBar(bar);
    }

    // Invalidate measurement cache — new data changes the price range
    this.priceFormatter.resetMeasurement();

    // Insert at beginning
    this.dataManager.prependData(bars);

    // Shift offsetX left by the width of the new bars to keep the viewport
    // showing the same bars at the same screen positions
    this.state.offsetX -= bars.length * this.state.barWidth;

    this.renderer.createBuffer();
    this.render();

    if (this.onDataUpdate) this.onDataUpdate(bars);
  }

  public updateLastBar(bar: Bar): void {
    const previousLength = this.dataManager.length;
    // Capture the bar that is about to close BEFORE the data mutation.
    // When updateLastBar appends a new bar (time advanced), this is the finalized
    // version of the previous candle — its O/H/L/C/volume are final.
    const closingBar = previousLength > 0 ? this.dataManager.data[previousLength - 1] : null;
    this.validateBar(bar);
    this.dataManager.updateLastBar(bar);

    // If a new bar was appended internally (time advanced), trigger auto-scroll
    if (this.dataManager.length > previousLength) {
      this.ensureRightGapAndRoll();
      // A candle just closed — notify listeners with the finalized bar.
      if (this.onCandleClose && closingBar) this.onCandleClose(closingBar);
    }

    this.render();
    if (this.onDataUpdate && this.dataManager.length > 0) this.onDataUpdate([bar]);
  }

  /**
   * Lightweight live update for high-frequency tick streams.
   * Skips full buffer re-render, grid/axis redraw, and axis width re-measurement.
   * Only re-draws the last candle in the buffer and copies to screen.
   * ~10-20x faster than updateLastBar() for rapid stream updates.
   *
   * Use this when receiving 10+ ticks/second.
   * Fall back to updateLastBar() occasionally when the candle closes
   * so axes/grid catch up with any price range changes.
   */
  public updateLastBarFast(bar: Bar): void {
    const previousLength = this.dataManager.length;
    // Capture the bar that is about to close BEFORE the data mutation.
    // See updateLastBar() for rationale.
    const closingBar = previousLength > 0 ? this.dataManager.data[previousLength - 1] : null;
    this.validateBar(bar);
    this.dataManager.updateLastBar(bar);

    // If new candle appended, use full render to handle buffer boundary + auto-scroll
    if (this.dataManager.length > previousLength) {
      this.ensureRightGapAndRoll();
      // A candle just closed — notify listeners with the finalized bar.
      if (this.onCandleClose && closingBar) this.onCandleClose(closingBar);
      this.renderer.createBuffer();
      this.render();
      return;
    }

    // Fast price scale check: update priceMin/priceMax if range expanded
    // beyond hysteresis threshold (1.5%). Only redraws background when needed.
    const rangeChanged = this.updatePriceScaleFast();

    // Notify plugins of new tick (indicator re-evaluation)
    if (this.onDataUpdate) this.onDataUpdate([bar]);

    // Lightweight path: only update last candle in buffer, then composite
    this.renderer.updateLastCandleInBuffer();
    this.renderer.drawViewport(this.mainCtx);

    // Redraw background if price range expanded significantly (flash crash)
    // This updates grid lines, axis labels, and current price label on bgCanvas
    if (rangeChanged) {
      this.renderer.drawBackground(this.bgCtx, true);
    }

    // Current price line is drawn atomically inside drawViewport — no separate call needed
  }

  /**
   * Internal validation for Bar structure
   */
  private validateBar(bar: Bar): void {
    if (!bar) throw new Error('AxonCharts: Bar data is null or undefined');
    const fields: (keyof Bar)[] = ['time', 'open', 'high', 'low', 'close'];
    for (const field of fields) {
      if (typeof bar[field] !== 'number' || isNaN(bar[field] as number)) {
        throw new Error(`AxonCharts: Invalid bar data. Field "${field}" must be a valid number.`);
      }
    }
  }

  public getContext() {
    const { w, h, axisWidth, priceMin, priceMax, barWidth, offsetX, rightGap, topMargin, bottomMargin } = this.state;
    const data = this.dataManager.data;
    const usableWidth = w - axisWidth;
    const startIdx = Math.max(0, Math.ceil((1 - offsetX - barWidth) / barWidth));
    const endIdx = Math.min(data.length - 1, Math.floor((usableWidth - 1 - offsetX) / barWidth));
    const visibleBars = data.slice(startIdx, endIdx + 1);
    const usableH = h - topMargin - bottomMargin;
    const pricePerPixel = (priceMax - priceMin) / (usableH || 1);
    const timePerBar = data.length > 1 ? data[1].time - data[0].time : 0;

    const result: Record<string, any> = {
      viewport: { width: w, height: h, rightGap,
        visibleRange: { fromIndex: startIdx, toIndex: endIdx, fromTime: data[startIdx]?.time, toTime: data[endIdx]?.time },
        priceRange: { min: priceMin, max: priceMax },
        scales: { pricePerPixel, timePerBar, barWidth }
      },
      state: { id: this.axonId, version: LIB_VERSION, totalBars: data.length, isAutoScrolling: this.isAutoScrolling(),
        market: {
          baseAsset: this.options.market?.baseAsset || null,
          quoteAsset: this.options.market?.quoteAsset || null,
          timeframe: this.options.market?.timeframe || null,
          source: this.options.market?.source || null
        } }
    };

    // Conditionally expose data — reduces token cost for AI agents that only need metadata
    if (this.options.context?.exposeData !== false) {
      result.visibleBars = visibleBars;
      result.latestBar = data[data.length - 1];

      // Auto-expose all active sub-panes
      const subPanes: Record<string, any> = {};
      for (const pane of this.getActiveSubPanes()) {
        subPanes[pane.id] = pane.getContextData();
      }
      if (Object.keys(subPanes).length > 0) {
        result.subPanes = subPanes;
      }
    }

    return result;
  }

  public setOptions(partialOptions: Partial<ChartOptions>): void {
    // Validate options before applying
    validateOptions(partialOptions);

    const normalizedPartial = this.normalizePartialOptions(partialOptions);
    this.options = deepMerge(this.options, normalizedPartial) as Required<ChartOptions>;

    let needsRender = false;
    let needsCrosshairUpdate = false;
    let needsResize = false;

    // === TIME SCALE ===
    if (normalizedPartial.timeScale) {
      if (normalizedPartial.timeScale.barSpacing !== undefined) {
        this.state.barWidth = this.options.timeScale.barSpacing!;
        this.renderer.createBuffer();
        needsRender = true;
      }
      if (normalizedPartial.timeScale.rightOffset !== undefined) {
        this.state.rightGap = this.options.timeScale.rightOffset!;
        needsRender = true;
      }
      if (normalizedPartial.timeScale.visible !== undefined) {
        needsRender = true;
      }
      if (normalizedPartial.timeScale.minBarSpacing !== undefined ||
          normalizedPartial.timeScale.maxBarSpacing !== undefined) {
        // Options updated by deepMerge, enforced in events.ts
        // No immediate render needed unless we want to clamp current barWidth
      }
    }

    // === PRICE SCALE ===
    if (normalizedPartial.priceScale) {
      if (normalizedPartial.priceScale.mode !== undefined) {
        this.state.priceScaleMode = normalizedPartial.priceScale.mode;
        needsRender = true;
      }
      if (normalizedPartial.priceScale.priceFormat !== undefined) {
        this.priceFormatter = new PriceFormatter(this.options.priceScale.priceFormat);
        needsRender = true;
      }
      if (normalizedPartial.priceScale.currentPrice !== undefined) {
        this.restartCountdownTimer();
        needsRender = true;
      }
      if (normalizedPartial.priceScale.reverse !== undefined) {
        this.state.reverse = normalizedPartial.priceScale.reverse;
        needsRender = true;
      }
    }

    // === LAYOUT ===
    if (normalizedPartial.layout) {
      if (normalizedPartial.layout.width !== undefined || normalizedPartial.layout.height !== undefined) {
        needsResize = true;
      }
      // Visual changes that need re-render
      if (normalizedPartial.layout.background !== undefined ||
          normalizedPartial.layout.textColor !== undefined ||
          normalizedPartial.layout.fontSize !== undefined ||
          normalizedPartial.layout.fontFamily !== undefined) {
        this.priceFormatter.resetMeasurement();
        needsRender = true;
      }
      if (normalizedPartial.layout.borderVisible !== undefined) {
        needsRender = true;
      }
      // Padding changes
      if (normalizedPartial.layout.padding) {
        if (normalizedPartial.layout.padding.top !== undefined) {
          this.state.topMargin = normalizedPartial.layout.padding.top;
          needsRender = true;
        }
        if (normalizedPartial.layout.padding.bottom !== undefined) {
          this.state.bottomMargin = normalizedPartial.layout.padding.bottom;
          needsRender = true;
        }
        if (normalizedPartial.layout.padding.right !== undefined) {
          this.state.axisWidth = normalizedPartial.layout.padding.right;
          needsRender = true;
        }
      }
    }

    // === GRID ===
    if (normalizedPartial.grid) {
      // Any grid change requires re-render
      needsRender = true;
    }

    // === CROSSHAIR ===
    if (normalizedPartial.crosshair) {
      needsCrosshairUpdate = true;
    }

    // === BEHAVIOR ===
    // No state updates needed - flags are read directly in events.ts
    // Changes take effect immediately on next event

    // === DATA ===
    if (normalizedPartial.data) {
      if (normalizedPartial.data.maxBars !== undefined) {
        this.dataManager.setMaxBars(normalizedPartial.data.maxBars);
        needsRender = true;
      }
      if (normalizedPartial.data.autoCleanup !== undefined) {
        this.dataManager.setAutoCleanup(normalizedPartial.data.autoCleanup);
      }
    }

    // === MARKET ===
    if (normalizedPartial.market) {
      // Market changes (pair, timeframe, source) need a re-render
      // to update the header label and the watermark pair fallback
      needsRender = true;
    }

    // === SERIES ===
    if (normalizedPartial.series) {
      // Series type change: recreate the series renderer
      if (normalizedPartial.series.type !== undefined) {
        this.renderer.setSeriesType();
      }
      // Visual changes need a full buffer redraw
      needsRender = true;
      this.renderer.createBuffer();
    }

    // === WATERMARK ===
    if (normalizedPartial.watermark) {
      // Watermark visibility, text, color, font size, opacity
      needsRender = true;
    }

    // === VOLUME ===
    if (normalizedPartial.volume) {
      // Volume sub-pane visibility, colors, height
      // Always recreate buffer when show changes (old buffer may be wrong height)
      if (normalizedPartial.volume.show !== undefined || this.options.volume.show) {
        this.renderer.createBuffer();
      }
      needsRender = true;
    }

    // === ATTRIBUTION LOGO ===
    if (normalizedPartial.attribution) {
      this.attribution.update();
    }

    // === APPLY CHANGES ===
    if (needsResize) {
      this.resize();
    } else if (needsRender) {
      this.render();
    }

    if (needsCrosshairUpdate) {
      this.crosshair.draw();
    }
  }

  private normalizePartialOptions(options: Partial<ChartOptions>): Partial<ChartOptions> {
    return options;
  }

  private normalizeOptions(options: ChartOptions): Required<ChartOptions> {
    return deepMerge<ChartOptions>(deepClone(DEFAULT_OPTIONS) as ChartOptions, this.normalizePartialOptions(options)) as Required<ChartOptions>;
  }

  public getOptions(): Readonly<ChartOptions> { return deepClone(this.options); }
  public resetOptions(): void {
    this.options = deepClone(DEFAULT_OPTIONS) as Required<ChartOptions>;
    this.state.reverse = false;
    this.state.priceScale = 1.0;
    this.state.priceOffset = 0;
    this.renderer.setSeriesType();
    this.render();
  }

  /**
   * Start the real-time countdown timer loop
   */
  private startCountdownTimer(): void {
    if (!this.options.priceScale.currentPrice?.showCountdown) return;

    const updateCountdown = () => {
      if (this._destroyed) return;
      const now = Date.now();
      // Throttle to 100ms to save CPU
      if (now - this.lastCountdownUpdate >= 100) {
        this.lastCountdownUpdate = now;
        this.renderer.drawViewport(this.mainCtx); 
      }
      this.countdownRafId = requestAnimationFrame(updateCountdown);
    };

    this.countdownRafId = requestAnimationFrame(updateCountdown);
  }

  /**
   * Stop the countdown timer
   */
  private stopCountdownTimer(): void {
    if (this.countdownRafId !== null) {
      cancelAnimationFrame(this.countdownRafId);
      this.countdownRafId = null;
    }
  }

  private restartCountdownTimer(): void {
    this.stopCountdownTimer();
    this.startCountdownTimer();
  }

  /**
   * Add a sub-pane (indicator, volume, etc.)
   */
  public addSubPane(pane: SubPane): void {
    this.subPanes.set(pane.id, pane);
    this.render();
  }

  /**
   * Remove a sub-pane by id
   */
  public removeSubPane(id: string): void {
    this.subPanes.delete(id);
    this.render();
  }

  /**
   * Get a sub-pane by id
   */
  public getSubPane(id: string): SubPane | undefined {
    return this.subPanes.get(id);
  }

  /**
   * Get all active (visible) sub-panes
   */
  public getActiveSubPanes(): SubPane[] {
    return Array.from(this.subPanes.values()).filter(p => p.getOptions()?.show);
  }

  // ── Drawing API ──────────────────────────────────────────
  addDrawing(drawing: Drawing): void {
    validateDrawing(drawing);
    this._drawings.push(drawing);
    this.render();
  }
  removeDrawing(id: string): void {
    this._drawings = this._drawings.filter(d => d.id !== id);
    this.render();
  }
  clearDrawings(): void {
    this._drawings = [];
    this.render();
  }
  getDrawings(): Drawing[] {
    return this._drawings;
  }
  /**
   * Update an existing drawing in place by id. Used by the drag
   * interaction layer to move/resize drawings without removing and
   * re-adding them. Triggers a render so the new position is visible.
   */
  updateDrawing(id: string, updates: Partial<Drawing>): void {
    const idx = this._drawings.findIndex(d => d.id === id);
    if (idx < 0) return;
    this._drawings[idx] = { ...this._drawings[idx], ...updates };
    this.render();
  }
  getSelectedDrawingId(): string | null {
    return this._selectedDrawingId;
  }
  selectDrawing(id: string | null): void {
    this._selectedDrawingId = id;
    this.render();
  }
  getHoveredHandle(): { drawingId: string; handleId: string } | null {
    return this.eventManager.getDrawingInteraction().getHoveredHandle();
  }
  /** Enter drawing-creation mode for the given type. */
  beginDrawing(type: string): void {
    this.drawingController.begin(type);
  }
  /** Cancel drawing-creation mode. */
  cancelDrawing(): void {
    this.drawingController.cancel();
  }
  /** True when drawing-creation mode is active. */
  isDrawing(): boolean {
    return this.drawingController.isDrawing();
  }
  /** Get the in-progress drawing's preview anchor(s), or null. */
  getDrawingPreview(): { time: number; price: number; time2?: number; price2?: number } | null {
    return this.drawingController.getPreview();
  }
  getDrawingPreviewShape(): 'line' | 'rect' | 'hline' | 'vline' | 'point' | null {
    return this.drawingController.getPreviewShape();
  }
  /**
   * Register a custom drawing type. After registration, drawings with
   * this `type` value passed to addDrawing() will be rendered by the
   * provided renderer. Overwriting a built-in type is allowed.
   */
  registerDrawingType(type: string, renderer: DrawingRenderer): void {
    registerDrawingTypeImpl(type, renderer);
  }

  /**
   * Toggle drawing magnet mode at runtime. When on, drawing anchors
   * snap to the nearest OHLC of the bar under the cursor during both
   * create mode and drag.
   */
  setDrawingMagnet(enabled: boolean): void {
    this.options.drawing.magnet = enabled;
  }

  /** Route a mousedown to the drawing controller (create mode). */
  routeDrawingMouseDown(x: number, y: number): boolean {
    return this.drawingController.onMouseDown(x, y);
  }

  /** Route a mousemove to the drawing controller (create mode preview). */
  routeDrawingMouseMove(x: number, y: number): void {
    this.drawingController.onMouseMove(x, y);
  }

  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stopCountdownTimer();

    // Unregister from AI agent registry
    if (typeof window !== 'undefined') {
      const registry = (window as any).__AXON_CHARTS__;
      if (registry) {
        delete registry.charts[this.axonId];
      }
    }

    window.removeEventListener('resize', this.handleResizeBound);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.eventManager.destroy();
    this.attribution.removeElement();
    this.bgCanvas.remove();
    this.mainCanvas.remove();
    this.crosshair.destroy();
    this.renderer.destroy();
    // Nullify references to prevent use-after-destroy
    this.dataManager = null!;
    this.renderer = null!;
    this.crosshair = null!;
    this.eventManager = null!;
    this.priceScaleAPI = null!;
    this.timeScaleAPI = null!;
    this._crosshairAPI = null!;
    this.priceFormatter = null!;
    this.bgCtx = null!;
    this.mainCtx = null!;
    this.bgCanvas = null!;
    this.mainCanvas = null!;
  }

  public isAutoScrolling(): boolean { return this.eventManager.isAutoScrolling(); }
  public scrollToLatest(): void { this.eventManager.scrollToLatest(); }

  /**
   * Get all chart data (returns a copy)
   */
  public getData(): Bar[] {
    return [...this.dataManager.data];
  }

  /**
   * Get bar by index
   */
  public getBar(index: number): Bar | undefined {
    return this.dataManager.data[index];
  }

  /**
   * Get bar at specific timestamp
   */
  public getBarAtTime(time: number): Bar | undefined {
    return this.dataManager.getBarAtTime(time);
  }

  /**
   * Get range of bars
   */
  public getBars(startIndex: number, count: number): Bar[] {
    return this.dataManager.data.slice(startIndex, startIndex + count);
  }

  /**
   * Get bars in time range
   */
  public getBarsInRange(startTime: number, endTime: number): Bar[] {
    return this.dataManager.data.filter(bar => bar.time >= startTime && bar.time <= endTime);
  }

  /**
   * Execute a command for LLM-driven chart control
   */
  public execute(command: ChartCommand): void {
    switch (command.type) {
      case 'setVisibleRange':
        this.timeScale().setVisibleRange(command.from, command.to);
        break;
      case 'scrollToTime':
        this.timeScale().scrollToTime(command.time);
        break;
      case 'zoomIn':
        this.timeScale().zoomIn(command.factor || 1.5);
        break;
      case 'zoomOut':
        this.timeScale().zoomOut(command.factor || 1.5);
        break;
      case 'fitContent':
        this.timeScale().fitContent();
        break;
      case 'setPriceScale':
        this.priceScale().setMode(command.mode);
        break;
      case 'setCrosshair':
        this.crosshairAPI().setMode(command.mode);
        break;
      case 'setSubPane':
        const pane = this.getSubPane(command.id);
        if (pane) {
          // Try options schema key first (volume uses this.options.volume.show)
          const currentOpts = this.options[command.id as keyof ChartOptions] as any;
          if (currentOpts) {
            currentOpts.show = command.show;
          } else {
            // Custom sub-pane without top-level options key: store in a visibility map
            this._subPaneShow.set(command.id, command.show);
          }
          this.render();
        }
        break;
      case 'setReverse':
        this.state.reverse = command.reverse;
        this.options.priceScale.reverse = command.reverse;
        this.render();
        break;
      default:
        const _exhaustive: never = command;
        throw new Error(`Unknown command type: ${(command as any).type}`);
    }
  }

  /**
   * Export chart as PNG data URL
   */
  public toDataURL(): string {
    const exportCanvas = this.createExportCanvas();
    return exportCanvas.toDataURL('image/png');
  }

  /**
   * Export chart as Blob
   */
  public async toBlob(): Promise<Blob> {
    return new Promise((resolve) => {
      const exportCanvas = this.createExportCanvas();
      exportCanvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/png');
    });
  }

  /**
   * Create export canvas with all chart layers merged
   */
  private createExportCanvas(): HTMLCanvasElement {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.state.w * this.state.devicePixelRatio;
    exportCanvas.height = this.state.h * this.state.devicePixelRatio;
    const ctx = exportCanvas.getContext('2d')!;

    // Draw background layer
    ctx.drawImage(this.bgCanvas, 0, 0);
    // Draw main chart layer
    ctx.drawImage(this.mainCanvas, 0, 0);
    // Draw crosshair overlay (if visible)
    const overlayCanvas = this.crosshair.getOverlayCanvas();
    if (overlayCanvas) {
      ctx.drawImage(overlayCanvas, 0, 0);
    }

    return exportCanvas;
  }

  /**
   * Save complete chart state
   */
  public saveState(): ChartState {
    return {
      version: '1.0.0',
      options: deepClone(this.options),
      data: [...this.dataManager.data],
      referencePrice: this.state.referencePrice,
      priceScaleMode: this.state.priceScaleMode,
      reverse: this.state.reverse,
      viewport: {
        offsetX: this.state.offsetX,
        barWidth: this.state.barWidth,
        priceScale: this.state.priceScale,
        priceOffset: this.state.priceOffset
      }
    };
  }

  /**
   * Load chart state
   */
  public loadState(state: ChartState): void {
    // Restore options
    this.setOptions(state.options);

    // Restore data
    this.setData(state.data);

    // Restore viewport
    this.state.offsetX = state.viewport.offsetX;
    this.state.barWidth = state.viewport.barWidth;
    this.state.priceScale = state.viewport.priceScale;
    this.state.priceOffset = state.viewport.priceOffset;

    // Re-render with restored viewport
    this.render();
  }

  /**
   * Get the Price Scale API
   * Provides methods to control the Y-axis (price scale) behavior
   */
  public priceScale(): PriceScaleAPI {
    return this.priceScaleAPI;
  }

  /**
   * Get the Time Scale API
   * Provides methods to control the X-axis (time scale) behavior
   */
  public timeScale(): TimeScaleAPI {
    return this.timeScaleAPI;
  }

  /**
   * Get the Crosshair API
   * Provides methods to control the crosshair overlay behavior and appearance
   */
  public crosshairAPI(): CrosshairAPI {
    return this._crosshairAPI;
  }
}