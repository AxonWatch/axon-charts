import { LAYOUT } from '../core/layout.js';
import { xToIndex, yToPrice, deriveVisibleStartIdx, indexToX } from '../utils/projection.js';
import { getPriceDecimals } from '../utils/math.js';
import { IChart } from '../types/index.js';

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
    const isOverVolumePane = this.chart.options.volume.show && chartBottom > 0 && this.y > chartBottom && this.y <= h - bottomMargin;
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

      // Clamp to valid range
      barIndex = Math.max(0, Math.min(barIndex, data.length - 1));
    } else {
      // Default to latest candle
      barIndex = data.length - 1;
      crosshairX = indexToX(barIndex, this.chart.state);
    }

    // 2. Calculate Virtual Time (matches Axes.ts logic)
    const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
    const refTime = data.length > 0 ? data[data.length - 1].time : Date.now();
    const refIdx = data.length > 0 ? data.length - 1 : 0;
    const virtualTime = refTime + (barIndex - refIdx) * interval;

    // For normal mode, calculate time at cursor position
    if (this.chart.options.crosshair.mode === 'normal' && this.visible && isOverChart) {
      const cursorIndex = xToIndex(this.x, this.chart.state);
      displayTime = refTime + (cursorIndex - refIdx) * interval;
    } else {
      displayTime = virtualTime;
    }

    // Trigger onCrosshairMove callback
    if (this.visible && isOverChart && this.chart.onCrosshairMove) {
      const bar = data[barIndex];
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
        this.drawPriceLabel(this.getPriceAt(this.y));
        this.drawTimeLabel(displayTime, crosshairX);
      }

      // Draw crosshair lines
      const vert = this.chart.options.crosshair.vertLine;
      const horz = this.chart.options.crosshair.horzLine;

      // Vertical line extends through sub-pane to full chart height
      this.overlayCtx.strokeStyle = vert.color;
      this.overlayCtx.lineWidth = vert.width;
      this.overlayCtx.setLineDash(vert.style === 'dashed' ? [4, 4] : []);
      this.overlayCtx.beginPath();
      this.overlayCtx.moveTo(crosshairX, 0);
      this.overlayCtx.lineTo(crosshairX, h - bottomMargin);
      this.overlayCtx.stroke();

      // Horizontal line (full width, including sub-pane)
      this.overlayCtx.strokeStyle = horz.color;
      this.overlayCtx.lineWidth = horz.width;
      this.overlayCtx.setLineDash(horz.style === 'dashed' ? [4, 4] : []);
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
        this.drawTooltip(bar);
      }
    }

    // 5. Draw volume tooltip at top-left of sub-pane (always shows the latest/near bar's volume)
    if (this.chart.options.volume.show && this.chart.options.crosshair.showTooltip) {
      const bar = data[barIndex];
      if (bar) {
        this.drawVolumeTooltip(bar);
      }
    }
  }

  /**
   * Draw volume tooltip at top-left of the sub-pane
   */
  private drawVolumeTooltip(bar: Bar): void {
    if (!this.chart.options.volume.show) return;
    const { chartBottom, subPaneHeight } = this.chart.state;
    if (subPaneHeight <= 0) return;

    const isUp = bar.close >= bar.open;
    const color = isUp ? this.chart.options.series.upColor : this.chart.options.series.downColor;
    const volLabel = 'Volume:';
    const volValue = bar.volume != null ? this.formatVolume(bar.volume) : '0';

    const x = LAYOUT.TOOLTIP_MARGIN_X;
    const y = chartBottom + LAYOUT.TOOLTIP_MARGIN_Y;

    this.overlayCtx.font = 'bold 12px system-ui';
    this.overlayCtx.textBaseline = 'top';
    this.overlayCtx.textAlign = 'left';

    // Label in neutral color
    this.overlayCtx.fillStyle = '#888';
    this.overlayCtx.fillText(volLabel, x, y);
    // Value in candle-direction color
    this.overlayCtx.fillStyle = color;
    this.overlayCtx.fillText(volValue, x + this.overlayCtx.measureText(volLabel).width + 5, y);
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

    this.overlayCtx.fillStyle = '#888';
    this.overlayCtx.font = 'bold 14px system-ui';
    this.overlayCtx.textBaseline = 'top';
    this.overlayCtx.textAlign = 'left';
    this.overlayCtx.fillText(headerText, LAYOUT.TOOLTIP_MARGIN_X, LAYOUT.TOOLTIP_MARGIN_Y);
  }

  /**
   * Draw OHLC legend in the top-left corner
   */
  private drawTooltip(bar: Bar): void {
    // 1. Format values
    const open = bar.open.toFixed(2);
    const high = bar.high.toFixed(2);
    const low = bar.low.toFixed(2);
    const close = bar.close.toFixed(2);

    // 2. Determine color based on bar direction
    const isUp = bar.close >= bar.open;
    const color = isUp ? this.chart.options.series.upColor : this.chart.options.series.downColor;

    // 3. Position: Top Left with small margin
    // Account for market header line if shown (one line of bold 14px text ≈ 18px)
    const headerOffset = this.chart.options.market?.show ? 18 : 0;
    const startX = LAYOUT.TOOLTIP_MARGIN_X;
    const startY = LAYOUT.TOOLTIP_MARGIN_Y + headerOffset;

    this.overlayCtx.font = 'bold 12px system-ui';
    this.overlayCtx.textBaseline = 'top';
    this.overlayCtx.textAlign = 'left';

    // Label styling
    const labelColor = '#888';
    
    // Draw O: value
    let currentX = startX;
    this.overlayCtx.fillStyle = labelColor;
    this.overlayCtx.fillText('O', currentX, startY);
    currentX += LAYOUT.TOOLTIP_LABEL_SPACING;
    this.overlayCtx.fillStyle = color;
    this.overlayCtx.fillText(open, currentX, startY);
    currentX += this.overlayCtx.measureText(open).width + LAYOUT.TOOLTIP_LABEL_SPACING;

    // Draw H: value
    this.overlayCtx.fillStyle = labelColor;
    this.overlayCtx.fillText('H', currentX, startY);
    currentX += LAYOUT.TOOLTIP_LABEL_SPACING;
    this.overlayCtx.fillStyle = color;
    this.overlayCtx.fillText(high, currentX, startY);
    currentX += this.overlayCtx.measureText(high).width + LAYOUT.TOOLTIP_LABEL_SPACING;

    // Draw L: value
    this.overlayCtx.fillStyle = labelColor;
    this.overlayCtx.fillText('L', currentX, startY);
    currentX += LAYOUT.TOOLTIP_LABEL_SPACING;
    this.overlayCtx.fillStyle = color;
    this.overlayCtx.fillText(low, currentX, startY);
    currentX += this.overlayCtx.measureText(low).width + LAYOUT.TOOLTIP_LABEL_SPACING;

    // Draw C: value
    this.overlayCtx.fillStyle = labelColor;
    this.overlayCtx.fillText('C', currentX, startY);
    currentX += LAYOUT.TOOLTIP_LABEL_SPACING;
    this.overlayCtx.fillStyle = color;
    this.overlayCtx.fillText(close, currentX, startY);

  }

  /**
   * Format volume to human-readable string (K/M suffixes)
   */
  private formatVolume(value: number): string {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(0);
  }

  /**
   * Draw price label on Y axis
   */
  private drawPriceLabel(price: number): void {
    const { w, h, axisWidth, chartBottom, bottomMargin } = this.chart.state;

    // 1. Draw price label box (Standard 20px height)
    const labelHeight = LAYOUT.LABEL_HEIGHT;
    this.overlayCtx.fillStyle = this.chart.options.layout.background;
    this.overlayCtx.fillRect(w - axisWidth, this.y - labelHeight / 2, axisWidth, labelHeight);

    // Draw price label border
    this.overlayCtx.strokeStyle = this.chart.options.layout.textColor;
    this.overlayCtx.lineWidth = 1;
    this.overlayCtx.strokeRect(w - axisWidth, this.y - labelHeight / 2, axisWidth, labelHeight);

    this.overlayCtx.fillStyle = this.chart.options.layout.textColor;
    this.overlayCtx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
    this.overlayCtx.textAlign = 'right';
    this.overlayCtx.textBaseline = 'middle';

    // Check if we're over the volume sub-pane
    const isOverVolume = this.chart.options.volume.show && chartBottom > 0 && this.y > chartBottom && this.y <= h - bottomMargin;

    if (isOverVolume) {
      // Show the volume level at the cursor's Y position within the sub-pane
      const subPaneTop = chartBottom;
      const volAreaHeight = this.chart.state.subPaneHeight - 4;
      const volAreaTop = subPaneTop + 2;
      const localY = this.y - volAreaTop;
      const ratio = Math.max(0, Math.min(1, 1 - (localY / volAreaHeight)));
      // Compute the visible max volume from data (same logic as renderer)
      const data = this.chart.dataManager.data;
      const firstVisibleIdx = deriveVisibleStartIdx(this.chart.state, data.length);
      const barsVisible = Math.ceil((w - axisWidth) / this.chart.state.barWidth) + 2;
      const endIdx = Math.min(firstVisibleIdx + barsVisible, data.length);
      let maxVol = 0;
      for (let i = firstVisibleIdx; i < endIdx; i++) {
        if (data[i] && data[i].volume != null && data[i].volume > maxVol) maxVol = data[i].volume;
      }
      if (maxVol <= 0) maxVol = 1;
      const volScale = this.chart.state.volumeScale;
      const volOffset = this.chart.state.volumeOffset;
      const visibleVolMax = maxVol / volScale;
      const visibleVolMin = Math.max(0, volOffset);
      const volValue = visibleVolMin + ratio * (visibleVolMax - visibleVolMin);
      const volText = this.formatVolume(Math.round(volValue));
      this.overlayCtx.fillText(volText, w - LAYOUT.LABEL_OFFSET, this.y);
    } else {
      // Show formatted price
      const formattedPrice = this.chart.priceFormatter.formatPrice(price);
      this.overlayCtx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, this.y);
    }
  }

  /**
   * Draw time label on X axis
   */
  private drawTimeLabel(time: number, x: number): void {
    const { h, bottomMargin } = this.chart.state;
    const date = new Date(time);

    // Format based on options
    let timeStr: string;
    if (this.chart.options.timeScale.showFullDate) {
      // Full date format: "Fri 03 Jan'26 17:55"
      const day = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateNum = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      const time = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      timeStr = `${day} ${dateNum} ${month}'${year} ${time}`;
    } else if (!this.chart.options.timeScale.timeVisible) {
      timeStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else if (this.chart.options.timeScale.secondsVisible) {
      timeStr = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } else {
      timeStr = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    this.overlayCtx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
    const textWidth = this.overlayCtx.measureText(timeStr).width;
    const padding = 10;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = LAYOUT.LABEL_HEIGHT;

    // Center label vertically in the time axis area
    const textY = h - bottomMargin / 2;
    const boxY = textY - boxHeight / 2;

    // Background (Match layout background)
    this.overlayCtx.fillStyle = this.chart.options.layout.background;
    this.overlayCtx.fillRect(x - boxWidth / 2, boxY, boxWidth, boxHeight);

    // Border
    this.overlayCtx.strokeStyle = this.chart.options.layout.textColor;
    this.overlayCtx.lineWidth = 1;
    this.overlayCtx.strokeRect(x - boxWidth / 2, boxY, boxWidth, boxHeight);


    // Text
    this.overlayCtx.fillStyle = this.chart.options.layout.textColor;
    this.overlayCtx.textAlign = 'center';
    this.overlayCtx.textBaseline = 'middle';
    this.overlayCtx.fillText(timeStr, x, textY);
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
