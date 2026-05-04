import { LAYOUT } from './layout.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import { IChart, Bar } from '../types/index.js';
import { Axes } from '../ui/axes.js';

/**
 * Handles all canvas rendering logic for candles, grid, and UI elements
 */
export class Renderer {
  private chart: IChart;
  private candleBuffer: HTMLCanvasElement | null = null;
  private bufferCtx: CanvasRenderingContext2D | null = null;
  private lastBufferWidth: number = 0;
  private axes: Axes;
  private bufferRenderStart: number = 0;
  private bufferRenderEnd: number = 0;

  constructor(chart: IChart) {
    this.chart = chart;
    this.axes = new Axes(chart);
  }

  /**
   * Create or resize the offscreen buffer
   */
  createBuffer(): void {
    const { w, h, devicePixelRatio, barWidth } = this.chart.state;

    // Guard against truly invalid dimensions (zero or negative)
    if (w <= 0 || h <= 0 || barWidth <= 0) {
      return;
    }

    // SMART BUFFER:
    const screenBars = Math.ceil(w / barWidth);
    const marginPixels = Math.min(w, 1000);
    const marginBars = Math.max(20, Math.ceil(marginPixels / barWidth));

    const minBarsNeeded = screenBars + marginBars;
    let bufferWidth = Math.ceil(minBarsNeeded * barWidth);

    // 3. HARD SAFETY CAP: Never exceed 4000px
    bufferWidth = Math.min(bufferWidth, LAYOUT.MAX_BUFFER_WIDTH);

    // REUSE LOGIC: Only resize if width/height changed significantly
    if (this.candleBuffer) {
      const currentBufferWidth = this.candleBuffer.width / devicePixelRatio;
      if (Math.abs(currentBufferWidth - bufferWidth) < LAYOUT.BUFFER_RECREATION_THRESHOLD &&
          this.lastBufferWidth === barWidth) {
        return;
      }
    }

    // Initialize or Resize (Don't recreate element)
    if (!this.candleBuffer) {
      this.candleBuffer = document.createElement('canvas');
    }

    // Ensure buffer has at least 1px dimensions
    this.candleBuffer.width = Math.max(1, Math.ceil(bufferWidth * devicePixelRatio));
    this.candleBuffer.height = Math.max(1, Math.ceil(h * devicePixelRatio));

    this.bufferCtx = this.candleBuffer.getContext('2d', { alpha: true });

    if (this.bufferCtx) {
      this.bufferCtx.scale(devicePixelRatio, devicePixelRatio);
      this.bufferCtx.imageSmoothingEnabled = false;
    }

    this.lastBufferWidth = barWidth;
    this.renderCandles();
  }

  /**
   * Render candles to the offscreen buffer
   */
  renderCandles(): void {
    if (!this.bufferCtx || !this.candleBuffer) return;

    const { data, barWidth, w, devicePixelRatio } = this.chart.state;
    if (data.length === 0) return;

    // 1. Calculate actual buffer capacity in bars
    const bufferWidthCSS = this.candleBuffer.width / devicePixelRatio;
    const maxBarsInBuffer = Math.floor(bufferWidthCSS / barWidth);

    // 2. Derive visible range
    const visibleStartIdx = deriveVisibleStartIdx(this.chart.state, data.length);
    
    // 3. Center the render range within the buffer
    const screenBars = Math.ceil(w / barWidth);
    const spareBars = maxBarsInBuffer - screenBars;
    
    const renderStart = Math.max(0, visibleStartIdx - Math.floor(spareBars / 2));
    const renderEnd = Math.min(data.length, renderStart + maxBarsInBuffer);

    // 4. Clear and Draw
    this.bufferCtx.clearRect(0, 0, bufferWidthCSS, this.chart.state.h);
    this.bufferCtx.lineWidth = 1;

    for (let i = renderStart; i < renderEnd; i++) {
      this.drawCandleToBuffer(i, renderStart);
    }

    this.bufferRenderStart = renderStart;
    this.bufferRenderEnd = renderEnd;
  }

  private drawCandleToBuffer(index: number, startIdx: number): void {
    if (!this.bufferCtx) return;
    const { data, barWidth } = this.chart.state;
    const bar = data[index];
    if (!bar) return;

    const bufferX = (index - startIdx) * barWidth;
    const centerX = bufferX + barWidth / 2;

    const yHigh = priceToY(bar.high, this.chart.state);
    const yLow = priceToY(bar.low, this.chart.state);
    const yOpen = priceToY(bar.open, this.chart.state);
    const yClose = priceToY(bar.close, this.chart.state);

    const isUp = bar.close >= bar.open;
    const color = isUp ? this.chart.options.series.upColor : this.chart.options.series.downColor;

    this.bufferCtx.fillStyle = color;
    this.bufferCtx.strokeStyle = color;

    const wickX = Math.floor(centerX) + 0.5;

    this.bufferCtx.beginPath();
    this.bufferCtx.moveTo(wickX, yHigh);
    this.bufferCtx.lineTo(wickX, yLow);
    this.bufferCtx.stroke();

    let bodyWidth = Math.floor(barWidth * LAYOUT.CANDLE_GAP_RATIO);
    if (bodyWidth % 2 === 0 && bodyWidth > 1) bodyWidth--; 
    
    const bodyLeft = Math.floor(wickX) - Math.floor(bodyWidth / 2);
    this.bufferCtx.fillRect(
      bodyLeft, 
      Math.floor(Math.min(yOpen, yClose)), 
      bodyWidth, 
      Math.max(Math.abs(yOpen - yClose), 1)
    );
  }

  drawBackground(ctx: CanvasRenderingContext2D, force: boolean = false): void {
    if (!force) return;
    const { w, h, axisWidth, bottomMargin } = this.chart.state;

    ctx.fillStyle = this.chart.options.layout.background;
    ctx.fillRect(0, 0, w, h);

    this.axes.drawGrid(ctx);

    ctx.fillStyle = this.chart.options.layout.background;
    ctx.fillRect(w - axisWidth, 0, axisWidth, h);
    ctx.fillRect(0, h - bottomMargin, w, bottomMargin);

    this.axes.drawTimeAxis(ctx);
    this.axes.drawPriceAxis(ctx);
    this.drawCurrentPriceLine(ctx);
    this.drawWatermark(ctx);
  }

  drawViewport(mainCtx: CanvasRenderingContext2D): void {
    const { w, h, barWidth, devicePixelRatio, axisWidth, bottomMargin } = this.chart.state;

    // Only skip if dimensions are truly invalid (<= 0)
    if (w <= 0 || h <= 0 || barWidth <= 0) {
      return;
    }

    mainCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    mainCtx.clearRect(0, 0, w, h);

    // Skip clipping if viewport is too small
    if (w - axisWidth > 0 && h - bottomMargin > 0) {
      mainCtx.save();
      mainCtx.beginPath();
      mainCtx.rect(0, 0, w - axisWidth, h - bottomMargin);
      mainCtx.clip();

      const bufferStartScreenX = indexToX(this.bufferRenderStart, this.chart.state) - (barWidth / 2);
      const bufferWidthCSS = (this.bufferRenderEnd - this.bufferRenderStart) * barWidth;

      // Only draw if buffer exists and has valid dimensions
      if (this.candleBuffer && this.candleBuffer.width > 0 && this.candleBuffer.height > 0) {
        mainCtx.drawImage(
          this.candleBuffer,
          0, 0,
          bufferWidthCSS * devicePixelRatio, h * devicePixelRatio,
          bufferStartScreenX, 0,
          bufferWidthCSS, h
        );
      }

      mainCtx.restore();
    }
  }

  private drawCurrentPriceLine(ctx: CanvasRenderingContext2D): void {
    const { w, h, data, axisWidth } = this.chart.state;
    if (data.length === 0) return;

    const lastBar = data[data.length - 1];
    const currentPrice = lastBar.close;
    const yClose = priceToY(currentPrice, this.chart.state);

    const isUp = lastBar.close >= lastBar.open;
    const lineColor = isUp ? this.chart.options.series.upColor : this.chart.options.series.downColor;

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, yClose);
    ctx.lineTo(w - axisWidth, yClose);
    ctx.stroke();
    ctx.setLineDash([]);

    const showCountdown = this.chart.options.priceScale.currentPrice?.showCountdown;
    const labelHeight = showCountdown ? LAYOUT.CURRENT_PRICE_LABEL_HEIGHT : LAYOUT.LABEL_HEIGHT;
    
    ctx.fillStyle = this.hexToRgba(lineColor, LAYOUT.CURRENT_PRICE_LABEL_ALPHA);
    ctx.fillRect(w - axisWidth, yClose - labelHeight / 2, axisWidth, labelHeight);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(w - axisWidth, yClose - labelHeight / 2, axisWidth, labelHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
    ctx.textAlign = 'right';
    
    const formattedPrice = this.chart.priceFormatter.formatPrice(currentPrice);
    
    if (showCountdown) {
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, yClose - 2);

      const currentTime = Date.now();
      const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
      const candleCloseTime = lastBar.time + interval;
      const remainingMs = candleCloseTime - currentTime;

      if (remainingMs > 0) {
        const countdownText = this.formatCountdown(remainingMs, interval);
        ctx.fillStyle = this.chart.options.priceScale.currentPrice?.countdownColor || 'rgba(255, 255, 255, 0.8)';
        ctx.font = `10px ${this.chart.options.layout.fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.fillText(countdownText, w - LAYOUT.LABEL_OFFSET, yClose + 3);
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, yClose);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private formatCountdown(remainingMs: number, intervalMs: number): string {
    const remainingSec = Math.ceil(remainingMs / 1000);
    if (intervalMs <= 3600000) {
      if (remainingSec < 60) return `${remainingSec}s`;
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    if (intervalMs <= 86400000) {
      const hours = Math.floor(remainingSec / 3600);
      const mins = Math.floor((remainingSec % 3600) / 60);
      const secs = remainingSec % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    const days = Math.floor(remainingSec / 86400);
    const hours = Math.floor((remainingSec % 86400) / 3600);
    return `${days}d ${hours}h`;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private drawWatermark(ctx: CanvasRenderingContext2D): void {
    const watermark = this.chart.options.watermark;
    if (!watermark?.show) return;

    // Resolve text: use watermark.text, or fall back to pair from market options
    let wmText = (watermark.text || '').trim();
    if (!wmText) {
      const market = this.chart.options.market;
      if (market?.baseAsset && market?.quoteAsset) {
        wmText = `${market.baseAsset}/${market.quoteAsset}`;
      }
    }
    if (!wmText) return;

    const { w, h, axisWidth } = this.chart.state;
    const chartAreaWidth = w - axisWidth;
    const baseFontSize = 48;
    const isRotated = watermark.rotate === true;

    // Determine font size: explicit override or auto-scale to ~30% of chart width
    let fontSize: number;
    if (watermark.fontSize != null && watermark.fontSize > 0) {
      fontSize = watermark.fontSize;
    } else {
      // Measure at base font to compute auto-scale
      ctx.font = `bold ${baseFontSize}px ${this.chart.options.layout.fontFamily}`;
      const measuredWidth = ctx.measureText(wmText).width;
      if (measuredWidth === 0) return;

      // For rotated text the effective visible width is smaller (cos45° ≈ 0.707)
      // For horizontal text the visible width is the full measured width
      const scaleFactor = isRotated ? 0.707 : 1.0;
      const targetMeasuredWidth = (chartAreaWidth * 0.30) / scaleFactor;

      fontSize = Math.round(baseFontSize * (targetMeasuredWidth / measuredWidth));
      fontSize = Math.max(12, Math.min(fontSize, 128));
    }

    ctx.save();
    ctx.font = `bold ${fontSize}px ${this.chart.options.layout.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = watermark.opacity;
    ctx.fillStyle = watermark.color;

    if (isRotated) {
      ctx.translate(chartAreaWidth / 2, h / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(wmText, 0, 0);
    } else {
      ctx.fillText(wmText, chartAreaWidth / 2, h / 2);
    }

    ctx.restore();
  }

  destroy(): void {
    if (this.candleBuffer) {
      this.candleBuffer.width = 0;
      this.candleBuffer.height = 0;
      this.candleBuffer = null;
    }
    this.bufferCtx = null;
  }
}
