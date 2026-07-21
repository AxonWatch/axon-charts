import { LAYOUT } from '../core/layout.js';
import { xToIndex, yToPrice, deriveVisibleStartIdx, indexToX } from '../utils/projection.js';
import { IChart, Bar } from '../types/index.js';
import { PriceFormatter } from '../utils/formatter.js';

/**
 * Crosshair overlay with OHLC tooltip
 */
export class Crosshair {
  private chart: IChart;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;
  private x: number = -1;
  private y: number = -1;
  private visible: boolean = false;

  // Event handler references for proper removal
  private handleMouseMove: (e: MouseEvent) => void;
  private handleMouseLeave: () => void;

  constructor(chart: IChart) {
    this.chart = chart;
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.id = 'overlay';
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.top = '0';
    this.overlayCanvas.style.left = '0';
    this.overlayCanvas.style.display = 'block';
    this.overlayCanvas.style.pointerEvents = 'none'; // Let mouse events pass through
    this.overlayCanvas.style.zIndex = '10';

    this.overlayCtx = this.overlayCanvas.getContext('2d')!;

    // Initialize handler references
    this.handleMouseMove = (e: MouseEvent) => {
      this.x = e.offsetX;
      this.y = e.offsetY;
      this.visible = true;
      this.draw();
    };

    this.handleMouseLeave = () => {
      this.visible = false;
      this.draw();
    };

    // Add to container on top of other canvases
    this.chart.container.appendChild(this.overlayCanvas);

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up mouse event listeners
   */
  private setupEventListeners(): void {
    const mainCanvas = this.chart.mainCanvas;
    mainCanvas.addEventListener('mousemove', this.handleMouseMove);
    mainCanvas.addEventListener('mouseleave', this.handleMouseLeave);
  }

  /**
   * Find bar under cursor
   */
  private hitTest(x: number): number | null {
    const { data, axisWidth } = this.chart.state;

    // Check if cursor is in chart area
    if (x < 0 || x > this.chart.state.w - axisWidth) {
      return null;
    }

    // Calculate bar index using unified projection
    const index = xToIndex(x, this.chart.state);

    if (index >= 0 && index < data.length) {
      return index;
    }

    return null;
  }

  /**
   * Get bar at index
   */
  private getBarAt(index: number): Bar | undefined {
    return this.chart.dataManager.data[index];
  }

  /**
   * Get price at Y coordinate
   * Uses unified projection system (same as renderer)
   */
  private getPriceAt(y: number): number {
    return yToPrice(y, this.chart.state);
  }

  /**
   * Draw crosshair and tooltip
   */
  public draw(): void {
    const { w, h, axisWidth, bottomMargin, chartBottom } = this.chart.state;

    // Clear overlay
    this.overlayCtx.clearRect(0, 0, w, h);

    // Draw market header if enabled
    if (this.chart.options.market?.show) {
      this.drawMarketHeader();
    }

    // Check if over axes or sub-pane
    const isOverPriceAxis = this.x > w - axisWidth;
    const isOverTimeAxis = this.y > h - bottomMargin;
    const isOverChart = !isOverPriceAxis && !isOverTimeAxis;


    // 1. Identify bar to display (use latest if not visible or over axes, or crosshair position if in chart)
    const data = this.chart.dataManager.data;
    let barIndex: number;
    let crosshairX: number;
    let displayTime: number;

    if (this.visible && isOverChart) {
      const mode = this.chart.options.crosshair.mode;

      if (mode === 'normal') {
        // Use raw mouse position (no snap)
        crosshairX = this.x;
        barIndex = xToIndex(this.x, this.chart.state);
      } else {
        // Magnet mode: snap to nearest bar
        barIndex = xToIndex(this.x, this.chart.state);
        crosshairX = indexToX(barIndex, this.chart.state);
      }

      // Don't clamp — allow virtual time for empty areas past/before data
    } else {
      // Default to latest candle
      barIndex = data.length - 1;
      crosshairX = indexToX(barIndex, this.chart.state);
    }

    // 2. Use bar timestamp when available, or compute virtual time from the
    //    data interval for cursor positions outside the data range.
    const bar = data[barIndex];
    if (bar) {
      displayTime = bar.time;
    } else if (data.length >= 2) {
      // Virtual time from known bar interval — works for past and future areas
      const interval = data[1].time - data[0].time;
      displayTime = data[0].time + barIndex * interval;
    } else if (data.length === 1) {
      displayTime = data[0].time;
    } else {
      displayTime = Date.now();
    }

    // Trigger onCrosshairMove callback
    if (this.visible && isOverChart && this.chart.onCrosshairMove) {
      // bar is already declared above from data[barIndex]
      const price = this.getPriceAt(this.y);

      this.chart.onCrosshairMove({
        time: displayTime,
        price: price,
        bar: bar
      });
    }

    // 3. Draw crosshair elements (only when visible and over chart area)
    if (this.visible && isOverChart && this.chart.options.crosshair.mode !== 'none') {
      // Draw Axis Labels (Only if enabled in options)
      if (this.chart.options.crosshair.showLabels) {
        this.drawPriceLabel(this.getPriceAt(this.y), Math.max(0, Math.min(barIndex, data.length - 1)));
        this.drawTimeLabel(displayTime, crosshairX);
      }

      // Draw crosshair lines
      const vert = this.chart.options.crosshair.vertLine;
      const horz = this.chart.options.crosshair.horzLine;

      // Vertical line extends through sub-pane to full chart height
      this.overlayCtx.strokeStyle = vert?.color ?? '#888';
      this.overlayCtx.lineWidth = vert?.width ?? 1;
      this.overlayCtx.setLineDash(vert?.style === 'dashed' ? [4, 4] : []);
      this.overlayCtx.beginPath();
      this.overlayCtx.moveTo(crosshairX, 0);
      this.overlayCtx.lineTo(crosshairX, h - bottomMargin);
      this.overlayCtx.stroke();

      // Horizontal line (full width, including sub-pane)
      this.overlayCtx.strokeStyle = horz?.color ?? '#888';
      this.overlayCtx.lineWidth = horz?.width ?? 1;
      this.overlayCtx.setLineDash(horz?.style === 'dashed' ? [4, 4] : []);
      this.overlayCtx.beginPath();
      this.overlayCtx.moveTo(0, this.y);
      this.overlayCtx.lineTo(w - axisWidth, this.y); 
      this.overlayCtx.stroke();

      this.overlayCtx.setLineDash([]);
    }

    // 4. Draw Tooltip (Legend) - Only if enabled
    if (this.chart.options.crosshair.showTooltip) {
      const bar = data[barIndex];
      if (bar) {
        this.drawTooltip(bar, barIndex);
      }
    }

    // 5. Sub-pane tooltips are not drawn separately — the sub-pane
    // label (drawn by ScalePane.render on the bgCanvas) already shows
    // the indicator name + value. When the crosshair is over a bar,
    // the label shows the hovered bar's value; otherwise it shows
    // the latest value. This avoids duplicate text and keeps each
    // sub-pane's information in its own area.
  }

  /**
   * Draw market header as top-left label inside chart area
   */
  private drawMarketHeader(): void {
    const market = this.chart.options.market;
    if (!market) return;

    const parts = [
      `${market.baseAsset || ''}/${market.quoteAsset || ''}`,
      market.timeframe || '',
      market.source || ''
    ].filter(p => p.length > 0);

    const headerText = parts.join(' | ');

    this.overlayCtx.fillStyle = this.chart.options.layout.textColor ?? '#888';
    this.overlayCtx.font = (this.chart.options.market.fontSize || 15) + 'px ' + this.chart.options.layout.fontFamily;
    this.overlayCtx.textBaseline = 'top';
    this.overlayCtx.textAlign = 'left';
    this.overlayCtx.fillText(headerText, LAYOUT.TOOLTIP_MARGIN_X, LAYOUT.TOOLTIP_MARGIN_Y);
  }

  /**
   * Draw OHLC legend in the top-left corner
   */
  private drawTooltip(bar: Bar, barIndex?: number): void {
    // HA mode: show Heiken Ashi OHLC values (not raw values)
    const seriesType = this.chart.options.series.type || 'candlestick';
    const haBar = (seriesType === 'heiken-ashi' && barIndex !== undefined)
      ? this.getHaBar(barIndex) : null;

    // 1. Format values — use HA O/H/L/C for heiken-ashi
    const open = this.chart.priceFormatter.formatPrice(haBar ? haBar.o : bar.open);
    const high = this.chart.priceFormatter.formatPrice(haBar ? haBar.h : bar.high);
    const low = this.chart.priceFormatter.formatPrice(haBar ? haBar.l : bar.low);
    const close = this.chart.priceFormatter.formatPrice(haBar ? haBar.c : bar.close);

    // 2. Determine color based on bar direction (HA direction for HA mode)
    const isUp = haBar ? (haBar.c >= haBar.o) : (bar.close >= bar.open);
    const color = isUp ? (this.chart.options.series.upColor ?? '#10B981') : (this.chart.options.series.downColor ?? '#E11D48');

    // 3. Position: Top Left with small margin
    // Account for market header line if shown (one line of bold 14px text ≈ 18px)
    const headerFontSize = (this.chart.options.market.fontSize || 15);
    const headerOffset = this.chart.options.market?.show ? (headerFontSize + 4) : 0;
    const startX = LAYOUT.TOOLTIP_MARGIN_X;
    const startY = LAYOUT.TOOLTIP_MARGIN_Y + headerOffset;

    this.overlayCtx.font = this.chart.options.layout.fontSize + 'px ' + this.chart.options.layout.fontFamily;
    this.overlayCtx.textBaseline = 'top';
    this.overlayCtx.textAlign = 'left';

    // Label styling
    // Draw O:val H:val L:val C:val (labels in neutral color, values in direction color)
    const pairs = [
      { label: 'O', val: open },
      { label: 'H', val: high },
      { label: 'L', val: low },
      { label: 'C', val: close }
    ];
    const gap = 6;
    const labelColor = this.chart.options.layout.textColor ?? '#888';
    let currentX = startX;
    for (const p of pairs) {
      this.overlayCtx.fillStyle = labelColor;
      this.overlayCtx.fillText(p.label + ':', currentX, startY);
      currentX += this.overlayCtx.measureText(p.label + ':').width;
      this.overlayCtx.fillStyle = color;
      this.overlayCtx.fillText(p.val, currentX, startY);
      currentX += this.overlayCtx.measureText(p.val).width + gap;
    }

  }

  /**
   * Get Heiken Ashi bar values from the renderer cache
   */
  private getHaBar(barIndex: number): { o: number; h: number; l: number; c: number } | null {
    try {
      const cache = this.chart.renderer.getSeriesCache();
      const haArr = cache?.ha as Array<{o:number;h:number;l:number;c:number}> | undefined;
      if (haArr && haArr.length > barIndex) return haArr[barIndex];
    } catch { /* renderer not ready */ }
    return null;
  }

  /**
   * Draw price label on Y axis
   */
  private drawPriceLabel(price: number, barIndex: number): void {
    const { w, axisWidth, chartBottom } = this.chart.state;
    const labelHeight = LAYOUT.LABEL_HEIGHT;

    // === NEW: Generic sub-pane axis labels ===
    // First check if we're over any sub-pane
    let currentTop = chartBottom;
    let isOverSubPane = false;

    for (const pane of this.chart.getActiveSubPanes()) {
      const subPaneHeight = pane.computeHeight(this.chart.state, pane.getOptions());
      const isOverThisPane = this.y > currentTop && this.y <= currentTop + subPaneHeight;

      if (isOverThisPane) {
        // Sub-pane handles its own label rendering (box + text)
        pane.renderAxisLabel(this.overlayCtx, this.chart, barIndex, this.y, currentTop, this.chart.state.w - this.chart.state.axisWidth);
        isOverSubPane = true;
        break; // Only show label for topmost pane under cursor
      }

      currentTop += subPaneHeight;
    }

    // If not over any sub-pane, draw main chart price label
    if (!isOverSubPane) {
      // Draw price label box
      this.overlayCtx.fillStyle = this.chart.options.layout.background ?? '#1e1e1e';
      this.overlayCtx.fillRect(w - axisWidth, this.y - labelHeight / 2, axisWidth, labelHeight);

      // Draw price label border
      this.overlayCtx.strokeStyle = this.chart.options.layout.textColor ?? '#888';
      this.overlayCtx.lineWidth = 1;
      this.overlayCtx.strokeRect(w - axisWidth, this.y - labelHeight / 2, axisWidth, labelHeight);

      // Draw price label text
      this.overlayCtx.fillStyle = this.chart.options.layout.textColor ?? '#888';
      this.overlayCtx.font = (this.chart.options.layout.fontSize ?? 12) + 'px ' + (this.chart.options.layout.fontFamily ?? 'system-ui');
      this.overlayCtx.textAlign = 'right';
      this.overlayCtx.textBaseline = 'middle';

      let formattedPrice = this.chart.priceFormatter.formatPrice(price);
      if (this.chart.state.priceScaleMode === 'percentage' && this.chart.state.referencePrice > 0) {
        const pct = ((price - this.chart.state.referencePrice) / this.chart.state.referencePrice) * 100;
        formattedPrice = PriceFormatter.formatPercentage(pct);
      }
      this.overlayCtx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, this.y);
    }
  }

  /**
   * Draw time label on X axis
   */
  private drawTimeLabel(time: number, x: number): void {
    const { h, bottomMargin } = this.chart.state;
    const ts = this.chart.options.timeScale;
    const tz = PriceFormatter.isValidTimezone(ts.timezone) ? ts.timezone : undefined;

    // Format based on options
    let timeStr: string;
    if (ts.showFullDate) {
      // Full date format with configurable dateFormat and timezone
      const dateStr = PriceFormatter.formatDate(time, ts.timezone, ts.dateFormat, ts.showDayOfWeek);
      const date = new Date(time);
      const formatter = new Intl.DateTimeFormat([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz
      });
      timeStr = dateStr + ' ' + formatter.format(date);
    } else if (!ts.timeVisible) {
      timeStr = PriceFormatter.formatDate(time, ts.timezone, ts.dateFormat, false);
    } else if (ts.secondsVisible) {
      const formatter = new Intl.DateTimeFormat([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        timeZone: tz
      });
      timeStr = formatter.format(new Date(time));
    } else {
      const formatter = new Intl.DateTimeFormat([], {
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: tz
      });
      timeStr = formatter.format(new Date(time));
    }

    this.overlayCtx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
    const textWidth = this.overlayCtx.measureText(timeStr).width;
    const padding = 10;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = LAYOUT.LABEL_HEIGHT;

    // Center label vertically in the time axis area
    const textY = h - bottomMargin / 2;
    const boxY = textY - boxHeight / 2;

    // Clamp box to stay within visible chart area (prevent edge clipping)
    const { w, axisWidth } = this.chart.state;
    const minBoxX = 2;
    const maxBoxX = (w - axisWidth) - boxWidth - 2;
    let boxX = x - boxWidth / 2;
    if (minBoxX <= maxBoxX) {
      boxX = Math.max(minBoxX, Math.min(boxX, maxBoxX));
    } else {
      boxX = (w - axisWidth - boxWidth) / 2;
    }
    const textX = boxX + boxWidth / 2;

    // Background (Match layout background)
    this.overlayCtx.fillStyle = this.chart.options.layout.background ?? '#1e1e1e';
    this.overlayCtx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // Border
    this.overlayCtx.strokeStyle = this.chart.options.layout.textColor ?? '#888';
    this.overlayCtx.lineWidth = 1;
    this.overlayCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Text
    this.overlayCtx.fillStyle = this.chart.options.layout.textColor ?? '#888';
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.textBaseline = 'middle';
    this.overlayCtx.fillText(timeStr, textX, textY);
  }

  /**
   * Update crosshair position
   */
  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.visible = true;
    this.draw();
  }

  /**
   * Hide crosshair
   */
  public hide(): void {
    this.visible = false;
    this.draw();
  }

  /**
   * Resize overlay canvas
   */
  public resize(w: number, h: number, devicePixelRatio: number): void {
    this.overlayCanvas.width = w * devicePixelRatio;
    this.overlayCanvas.height = h * devicePixelRatio;
    this.overlayCanvas.style.width = w + 'px';
    this.overlayCanvas.style.height = h + 'px';
    this.overlayCtx.scale(devicePixelRatio, devicePixelRatio);
  }

  /**
   * Get overlay canvas (for screenshot export)
   */
  public getOverlayCanvas(): HTMLCanvasElement | null {
    return this.overlayCanvas;
  }

  /**
   * Clean up
   */
  public destroy(): void {
    const mainCanvas = this.chart.mainCanvas;
    mainCanvas.removeEventListener('mousemove', this.handleMouseMove);
    mainCanvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.overlayCanvas.remove();
  }
}