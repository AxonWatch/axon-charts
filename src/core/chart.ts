import { DataManager } from './data.js';
import { Renderer } from './renderer.js';
import { Crosshair } from '../ui/crosshair.js';
import { EventManager } from '../interaction/events.js';
import { ChartOptions, ChartColors, Bar, ScrollLockChangeCallback } from '../types/index.js';
import { LAYOUT } from './layout.js';
import { priceToY, indexToX, xToIndex, deriveVisibleStartIdx, clampOffsetX, calculateRightEdgeOffset } from '../utils/projection.js';
import { deepMerge, deepClone } from '../utils/merge.js';
import { PriceFormatter } from '../utils/formatter.js';
import { PriceScaleAPI } from '../api/price-scale.js';
import { TimeScaleAPI } from '../api/time-scale.js';
import { CrosshairAPI } from '../api/crosshair.js';
import { validateOptions } from '../utils/validation.js';

const DEFAULT_OPTIONS: Required<ChartOptions> = {
  layout: {
    width: 'auto',
    height: 'auto',
    background: '#1a1a1a',
    textColor: '#aaaaaa',
    fontSize: 12,
    fontFamily: 'system-ui',
    padding: { top: 10, right: 10, bottom: 10, left: 10 }
  },
  grid: {
    show: true,
    vertLines: { show: true, color: '#2a2a2a', width: 1 },
    horzLines: { show: true, color: '#2a2a2a', width: 1 }
  },
  priceScale: {
    mode: 'linear',
    scaleMargins: { top: 0.1, bottom: 0.1 },
    alignLabels: true,
    minVisibleBars: 2,
    currentPrice: {
      showCountdown: true,
      countdownColor: 'rgba(255, 255, 255, 0.8)'
    }
  },
  timeScale: {
    borderColor: '#2a2a2a',
    visible: true,
    timeVisible: true,
    secondsVisible: false,
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
    horzLine: { color: '#555555', width: 1, style: 'dashed' }
  },
  behavior: {
    dragToZoom: true,
    scrollToZoom: true,
    pinchToZoom: true,
    panOnMouseDrag: true,
    dragPriceScale: true
  },
  data: {
    maxBars: 5000,
    autoCleanup: true
  },
  colors: {
    background: '#1a1a1a',
    grid: '#2a2a2a',
    up: '#22c55e',
    down: '#ef4444',
    text: '#aaaaaa',
    crosshair: '#555555'
  },
  width: 'auto',
  height: 'auto',
  timeframe: 60,
  rightGap: 80,
  autoScroll: true,
  baseBarWidth: 11
};

/**
 * Main Chart class - Core candlestick chart implementation
 */
export class Chart {
  public readonly container: HTMLElement;
  public options: Required<ChartOptions>;

  // Canvas layers
  private bgCanvas!: HTMLCanvasElement;
  private mainCanvas!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;
  private mainCtx!: CanvasRenderingContext2D;

  // UI modules
  public crosshair!: Crosshair;

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
    priceScale: number;
    priceOffset: number;
    priceScaleMode: 'linear' | 'logarithmic';
    axisWidth: number;
  };

  // Core modules
  public dataManager: DataManager;
  public renderer: Renderer;
  public eventManager: EventManager;
  private priceFormatter: PriceFormatter;
  private priceScaleAPI: PriceScaleAPI;
  private timeScaleAPI: TimeScaleAPI;
  private crosshairAPI: CrosshairAPI;

  // Real-time Countdown management
  private countdownRafId: number | null = null;
  private lastCountdownUpdate: number = 0;

  // Callbacks
  public onScrollLockChange?: ScrollLockChangeCallback;

  // Event handlers stored for proper removal
  private readonly handleResizeBound: () => void;

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

    // 3. Initialize state
    this.state = {
      w: 0,
      h: 0,
      devicePixelRatio: this.options.devicePixelRatio || window.devicePixelRatio || 1,
      barWidth: this.options.timeScale.barSpacing,
      baseBarWidth: this.options.timeScale.barSpacing,
      offsetX: 0,
      priceMin: 0,
      priceMax: 100,
      data: [],
      rightGap: this.options.timeScale.rightOffset,
      priceScale: 1.0,
      priceOffset: 0,
      priceScaleMode: this.options.priceScale.mode,
      axisWidth: LAYOUT.RIGHT_GAP
    };

    // 4. Initialize core modules
    this.dataManager = new DataManager(this.options.data.maxBars);
    this.priceFormatter = new PriceFormatter(this.options.priceScale.priceFormat);
    this.renderer = new Renderer(this);
    this.initCanvases();
    this.crosshair = new Crosshair(this);
    this.crosshairAPI = new CrosshairAPI(this, this.crosshair);
    this.eventManager = new EventManager(this);
    this.priceScaleAPI = new PriceScaleAPI(this);
    this.timeScaleAPI = new TimeScaleAPI(this);

    this.startCountdownTimer();

    // 5. Setup Resize Listener (Memory Leak Protected)
    this.handleResizeBound = this.resize.bind(this);
    window.addEventListener('resize', this.handleResizeBound);

    this.resize();
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

    this.container.appendChild(this.bgCanvas);
    this.container.appendChild(this.mainCanvas);
  }

  public resize(width?: number, height?: number): void {
    const containerW = typeof this.options.layout.width === 'number'
      ? this.options.layout.width
      : this.container.clientWidth;
    const containerH = typeof this.options.layout.height === 'number'
      ? this.options.layout.height
      : this.container.clientHeight;

    this.state.w = width ?? containerW;
    this.state.h = height ?? containerH;

    [this.bgCanvas, this.mainCanvas].forEach(canvas => {
      canvas.width = this.state.w * this.state.devicePixelRatio;
      canvas.height = this.state.h * this.state.devicePixelRatio;
      canvas.style.width = this.state.w + 'px';
      canvas.style.height = this.state.h + 'px';
    });

    this.bgCtx.scale(this.state.devicePixelRatio, this.state.devicePixelRatio);
    this.mainCtx.scale(this.state.devicePixelRatio, this.state.devicePixelRatio);
    this.mainCtx.imageSmoothingEnabled = false;

    this.renderer.createBuffer();
    this.crosshair.resize(this.state.w, this.state.h, this.state.devicePixelRatio);
    this.render();
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

    const range = this.dataManager.getPriceRange(firstVisibleIdx, visibleEnd - firstVisibleIdx);
    const mid = (range.max + range.min) / 2;
    const halfRange = ((range.max - range.min) / 2) * priceScale;

    this.state.priceMin = mid - halfRange;
    this.state.priceMax = mid + halfRange;

    // --- DYNAMIC AXIS WIDTH ---
    const requiredWidth = this.priceFormatter.measureRequiredWidth(this.bgCtx, this.state.priceMin, this.state.priceMax);
    
    // Logic: Only update if expanding, or contracting significantly (>20px) to prevent jitter
    const currentWidth = this.state.axisWidth;
    if (requiredWidth > currentWidth || (currentWidth - requiredWidth) > 20) {
      this.state.axisWidth = Math.max(LAYOUT.RIGHT_GAP, requiredWidth);
      return true;
    }

    return false;
  }

  private ensureRightGapAndRoll(): void {
    if (!this.options.behavior.autoScroll || !this.isAutoScrolling()) return;
    const { barWidth, axisWidth, w, rightGap } = this.state;
    if (this.dataManager.length === 0) return;
    this.state.offsetX -= barWidth;
    this.state.offsetX = clampOffsetX(this.state.offsetX, barWidth, this.dataManager.length, w, rightGap, axisWidth);
  }

  public render(): void {
    this.state.data = this.dataManager.data;
    const layoutChanged = this.updatePriceScale();

    // Recreate buffer ONLY if layout changed
    if (layoutChanged) {
      this.renderer.createBuffer();
    }

    this.renderer.renderCandles();
    this.renderer.drawBackground(this.bgCtx, true);
    this.renderer.drawViewport(this.mainCtx);
    this.crosshair.draw();
  }

  public setData(bars: Bar[]): void {
    if (!Array.isArray(bars)) throw new Error('AxonCharts: Data must be an array');
    
    // Validate structural integrity of data
    if (bars.length > 0) {
      this.validateBar(bars[0]);
      if (bars.length > 1) this.validateBar(bars[bars.length - 1]);
    }

    this.dataManager.setData(bars);
    if (this.dataManager.length === 0) return;
    this.state.offsetX = calculateRightEdgeOffset(this.dataManager.length, this.state.barWidth, this.state.w, this.state.rightGap, this.state.axisWidth);
    this.render();
  }

  public appendBar(bar: Bar): void {
    this.validateBar(bar);
    this.dataManager.appendBar(bar);
    this.ensureRightGapAndRoll();
    this.render();
  }

  public updateLastBar(bar: Bar): void {
    const previousLength = this.dataManager.length;
    this.validateBar(bar);
    this.dataManager.updateLastBar(bar);

    // If a new bar was appended internally (time advanced), trigger auto-scroll
    if (this.dataManager.length > previousLength) {
      this.ensureRightGapAndRoll();
    }

    this.render();
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
    const { w, h, priceMin, priceMax, barWidth, offsetX, rightGap } = this.state;
    const data = this.dataManager.data;
    const usableWidth = w - rightGap;
    const startIdx = Math.max(0, Math.ceil((1 - offsetX - barWidth) / barWidth));
    const endIdx = Math.min(data.length - 1, Math.floor((usableWidth - 1 - offsetX) / barWidth));
    const visibleBars = data.slice(startIdx, endIdx + 1);
    const usableH = h - LAYOUT.TOP_MARGIN - LAYOUT.BOTTOM_MARGIN;
    const pricePerPixel = (priceMax - priceMin) / (usableH || 1);
    const timePerBar = data.length > 1 ? data[1].time - data[0].time : 0;

    return {
      viewport: { width: w, height: h, rightGap, 
        visibleRange: { fromIndex: startIdx, toIndex: endIdx, fromTime: data[startIdx]?.time, toTime: data[endIdx]?.time },
        priceRange: { min: priceMin, max: priceMax },
        scales: { pricePerPixel, timePerBar, barWidth }
      },
      state: { totalBars: data.length, isAutoScrolling: this.isAutoScrolling() },
      visibleBars,
      latestBar: data[data.length - 1]
    };
  }

  public setOptions(partialOptions: Partial<ChartOptions>): void {
    // Validate options before applying
    validateOptions(partialOptions);

    const normalizedPartial = this.normalizePartialOptions(partialOptions);
    this.options = deepMerge(this.options, normalizedPartial);

    let needsRender = false;
    let needsCrosshairUpdate = false;
    let needsResize = false;

    // === TIME SCALE ===
    if (normalizedPartial.timeScale) {
      if (normalizedPartial.timeScale.barSpacing !== undefined) {
        this.state.barWidth = this.options.timeScale.barSpacing;
        this.renderer.createBuffer();
        needsRender = true;
      }
      if (normalizedPartial.timeScale.rightOffset !== undefined) {
        this.state.rightGap = this.options.timeScale.rightOffset;
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
        needsRender = true;
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

    // === COLORS (LEGACY) ===
    // Colors are mapped to layout/grid in normalizePartialOptions()
    // Handled by layout/grid handlers above

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
    const normalized = deepClone(options);
    if (options.colors) {
      normalized.layout = normalized.layout || {};
      normalized.grid = normalized.grid || { vertLines: {}, horzLines: {} };
      if (options.colors.background) normalized.layout.background = options.colors.background;
      if (options.colors.text) normalized.layout.textColor = options.colors.text;
      if (options.colors.grid) {
        normalized.grid.vertLines = normalized.grid.vertLines || {};
        normalized.grid.horzLines = normalized.grid.horzLines || {};
        normalized.grid.vertLines.color = options.colors.grid;
        normalized.grid.horzLines.color = options.colors.grid;
      }
    }
    if (options.width) { normalized.layout = normalized.layout || {}; normalized.layout.width = options.width; }
    if (options.height) { normalized.layout = normalized.layout || {}; normalized.layout.height = options.height; }
    if (options.rightGap !== undefined) { normalized.timeScale = normalized.timeScale || {}; normalized.timeScale.rightOffset = options.rightGap; }
    if (options.baseBarWidth !== undefined) { normalized.timeScale = normalized.timeScale || {}; normalized.timeScale.barSpacing = options.baseBarWidth; }
    return normalized;
  }

  private normalizeOptions(options: ChartOptions): Required<ChartOptions> {
    return deepMerge(deepClone(DEFAULT_OPTIONS), this.normalizePartialOptions(options)) as Required<ChartOptions>;
  }

  public getOptions(): Readonly<ChartOptions> { return deepClone(this.options); }
  public resetOptions(): void { this.options = deepClone(DEFAULT_OPTIONS); this.render(); }

  /**
   * Start the real-time countdown timer loop
   */
  private startCountdownTimer(): void {
    if (!this.options.priceScale.currentPrice?.showCountdown) return;

    const updateCountdown = () => {
      const now = Date.now();
      // Throttle to 100ms to save CPU
      if (now - this.lastCountdownUpdate >= 100) {
        this.lastCountdownUpdate = now;
        this.render(); 
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

  public destroy(): void {
    this.stopCountdownTimer();
    window.removeEventListener('resize', this.handleResizeBound);
    this.eventManager.destroy();
    this.bgCanvas.remove();
    this.mainCanvas.remove();
    this.crosshair.destroy();
    this.renderer.destroy();
  }

  public isAutoScrolling(): boolean { return this.eventManager.isAutoScrolling(); }
  public scrollToLatest(): void { this.eventManager.scrollToLatest(); }

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
    return this.crosshairAPI;
  }
}
