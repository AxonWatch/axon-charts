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
    const { data } = this.chart.state;

    // Check if cursor is in chart area
    if (x < 0 || x > this.chart.state.w - LAYOUT.RIGHT_GAP) {
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
    const { w, h, axisWidth } = this.chart.state;

    // Clear overlay
    this.overlayCtx.clearRect(0, 0, w, h);

    // Check if over axes - FIXED: Use dynamic axisWidth for sidebar detection
    const isOverPriceAxis = this.x > w - axisWidth;
    const isOverTimeAxis = this.y > h - LAYOUT.BOTTOM_MARGIN;
    const isOverChart = !isOverPriceAxis && !isOverTimeAxis;


    // 1. Identify bar to display (use latest if not visible or over axes, or crosshair position if in chart)
    const data = this.chart.dataManager.data;
    let barIndex: number;

    if (this.visible && isOverChart) {
      // Use crosshair position
      barIndex = xToIndex(this.x, this.chart.state);
    } else {
      // Default to latest candle
      barIndex = data.length - 1;
    }

    // Clamp to valid range
    barIndex = Math.max(0, Math.min(barIndex, data.length - 1));

    // 2. Calculate Virtual Time (matches Axes.ts logic)
    const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
    const refTime = data.length > 0 ? data[data.length - 1].time : Date.now();
    const refIdx = data.length > 0 ? data.length - 1 : 0;
    const virtualTime = refTime + (barIndex - refIdx) * interval;

    // 3. Draw crosshair elements (only in chart area when visible)
    if (this.visible && isOverChart && this.chart.options.crosshair.mode !== 'none') {
      const snapX = indexToX(barIndex, this.chart.state);

      // Draw Axis Labels (Only if enabled in options)
      if (this.chart.options.crosshair.showLabels) {
        this.drawPriceLabel(this.getPriceAt(this.y));
        this.drawTimeLabel(virtualTime, snapX);
      }

      // Draw crosshair lines
      const vert = this.chart.options.crosshair.vertLine;
      const horz = this.chart.options.crosshair.horzLine;

      // Vertical line
      this.overlayCtx.strokeStyle = vert.color;
      this.overlayCtx.lineWidth = vert.width;
      this.overlayCtx.setLineDash(vert.style === 'dashed' ? [4, 4] : []);
      this.overlayCtx.beginPath();
      this.overlayCtx.moveTo(snapX, 0);
      this.overlayCtx.lineTo(snapX, h - LAYOUT.BOTTOM_MARGIN);
      this.overlayCtx.stroke();

      // Horizontal line
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
    const color = isUp ? this.chart.options.colors.up : this.chart.options.colors.down;

    // 3. Position: Top Left with small margin (Using LAYOUT)
    const startX = LAYOUT.TOOLTIP_MARGIN_X;
    const startY = LAYOUT.TOOLTIP_MARGIN_Y;

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
   * Draw price label on Y axis
   */
  private drawPriceLabel(price: number): void {
    const { w, axisWidth } = this.chart.state;

    // 1. Draw price label box (Standard 20px height)
    const labelHeight = LAYOUT.LABEL_HEIGHT;
    this.overlayCtx.fillStyle = this.chart.options.layout.background;
    this.overlayCtx.fillRect(w - axisWidth, this.y - labelHeight / 2, axisWidth, labelHeight);

    // Draw price label border
    this.overlayCtx.strokeStyle = this.chart.options.layout.textColor;
    this.overlayCtx.lineWidth = 1;
    this.overlayCtx.strokeRect(w - axisWidth, this.y - labelHeight / 2, axisWidth, labelHeight);

    // Draw price text
    this.overlayCtx.fillStyle = this.chart.options.layout.textColor;
    this.overlayCtx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
    this.overlayCtx.textAlign = 'right';
    this.overlayCtx.textBaseline = 'middle';
    
    // Use Professional Formatter
    const formattedPrice = this.chart.priceFormatter.formatPrice(price);
    this.overlayCtx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, this.y);
  }

  /**
   * Draw time label on X axis
   */
  private drawTimeLabel(time: number, x: number): void {
    const { h } = this.chart.state;
    const date = new Date(time);
    
    // FIXED: Match time axis format (24-hour format)
    const timeStr = date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });

    this.overlayCtx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
    const textWidth = this.overlayCtx.measureText(timeStr).width;
    const padding = 10;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = LAYOUT.LABEL_HEIGHT;

    // FIXED: Centered in the bottom margin area (Using LAYOUT)
    const textY = h - LAYOUT.TIME_LABEL_Y; 
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
   * Clean up
   */
  public destroy(): void {
    const mainCanvas = this.chart.mainCanvas;
    mainCanvas.removeEventListener('mousemove', this.handleMouseMove);
    mainCanvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.overlayCanvas.remove();
  }
}
