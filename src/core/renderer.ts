import { LAYOUT } from './layout.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import { calculateTimeStep } from '../utils/math.js';
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

  /**
   * Lightweight update: re-draw only the last candle in the buffer.
   * Skips clearing the entire buffer. Call this instead of renderCandles()
   * during high-frequency live ticks for ~10-20x faster updates.
   */
  updateLastCandleInBuffer(): void {
    if (!this.bufferCtx || !this.candleBuffer) return;
    const { data, barWidth } = this.chart.state;
    if (data.length === 0) return;
    const lastIdx = data.length - 1;

    // Only redraw if the last index is within our buffer range
    if (lastIdx < this.bufferRenderStart || lastIdx >= this.bufferRenderEnd) return;

    // Clear just the last candle's region in the buffer
    const bufferOffset = lastIdx - this.bufferRenderStart;
    const candleX = bufferOffset * barWidth;
    this.bufferCtx.clearRect(candleX, 0, barWidth, this.chart.state.h);

    // Re-draw only the last candle
    this.drawCandleToBuffer(lastIdx, this.bufferRenderStart);
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
    const { w, h, axisWidth, bottomMargin, chartBottom, subPaneHeight } = this.chart.state;

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

    // Volume sub-pane: background and bars
    if (subPaneHeight > 0) {
      this.drawVolumeSubPane(ctx);
    }
  }

  drawViewport(mainCtx: CanvasRenderingContext2D): void {
    const { w, h, barWidth, devicePixelRatio, axisWidth, bottomMargin, chartBottom } = this.chart.state;

    // Only skip if dimensions are truly invalid (<= 0)
    if (w <= 0 || h <= 0 || barWidth <= 0) {
      return;
    }

    mainCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    mainCtx.clearRect(0, 0, w, h);

    // Clip to main chart area (above sub-pane)
    const clipBottom = chartBottom || (h - bottomMargin);
    if (w - axisWidth > 0 && clipBottom > 0) {
      mainCtx.save();
      mainCtx.beginPath();
      mainCtx.rect(0, 0, w - axisWidth, clipBottom);
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
    const { w, h, data, axisWidth, bottomMargin } = this.chart.state;
    if (data.length === 0) return;

    const lastBar = data[data.length - 1];
    const currentPrice = lastBar.close;
    const yClose = priceToY(currentPrice, this.chart.state);

    const isUp = lastBar.close >= lastBar.open;
    const lineColor = isUp ? this.chart.options.series.upColor : this.chart.options.series.downColor;

    const clipBottom = this.chart.state.chartBottom || (h - bottomMargin);
    // Clamp the line Y to chart area — don't let it go diagonal
    const lineY = Math.min(yClose, clipBottom);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(w - axisWidth, lineY);
    ctx.stroke();
    ctx.setLineDash([]);

    const showCountdown = this.chart.options.priceScale.currentPrice?.showCountdown;
    const labelHeight = showCountdown ? LAYOUT.CURRENT_PRICE_LABEL_HEIGHT : LAYOUT.LABEL_HEIGHT;
    
    // Use the same clamped Y for the label so it stays in the chart area
    const labelY = Math.min(yClose, clipBottom);
    ctx.fillStyle = this.hexToRgba(lineColor, LAYOUT.CURRENT_PRICE_LABEL_ALPHA);
    ctx.fillRect(w - axisWidth, labelY - labelHeight / 2, axisWidth, labelHeight);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(w - axisWidth, labelY - labelHeight / 2, axisWidth, labelHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
    ctx.textAlign = 'right';
    
    const formattedPrice = this.chart.priceFormatter.formatPrice(currentPrice);
    
    if (showCountdown) {
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, labelY - 2);

      const currentTime = Date.now();
      const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
      const candleCloseTime = lastBar.time + interval;
      const remainingMs = candleCloseTime - currentTime;

      if (remainingMs > 0) {
        const countdownText = this.formatCountdown(remainingMs, interval);
        ctx.fillStyle = this.chart.options.priceScale.currentPrice?.countdownColor || 'rgba(255, 255, 255, 0.8)';
        ctx.font = `10px ${this.chart.options.layout.fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.fillText(countdownText, w - LAYOUT.LABEL_OFFSET, labelY + 3);
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, labelY);
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

  private drawVolumeSubPane(ctx: CanvasRenderingContext2D): void {
    const { w, h, data, barWidth, axisWidth, bottomMargin, chartBottom, subPaneHeight } = this.chart.state;
    if (!this.chart.options.volume.show || subPaneHeight <= 0) return;
    if (data.length === 0) return;

    const chartAreaWidth = w - axisWidth;
    const subPaneTop = chartBottom;
    const volUpColor = this.chart.options.volume.upColor || '#22c55e';
    const volDownColor = this.chart.options.volume.downColor || '#ef4444';

    // Fill sub-pane background (only axis area — chart area keeps grid lines visible)
    ctx.fillStyle = this.chart.options.layout.background;
    ctx.fillRect(w - axisWidth, subPaneTop, axisWidth, subPaneHeight);

    // Draw separator line (full width including axis column) — thicker for easy drag
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, subPaneTop);
    ctx.lineTo(w, subPaneTop);
    ctx.stroke();

    // Re-draw vertical grid lines through sub-pane (background fill above erased them)
    const vertOpts = this.chart.options.grid.vertLines || {};
    const drawVertLines = this.chart.options.grid.show && vertOpts.show !== false;
    if (drawVertLines) {
      ctx.strokeStyle = vertOpts.color ?? '#2a2a2a';
      ctx.lineWidth = vertOpts.width ?? 1;
      ctx.setLineDash([]);
      const interval = data.length > 1 ? data[1].time - data[0].time : 60000;
      const step = calculateTimeStep(barWidth);
      const stepTime = step * interval;
      const refBar = data[data.length - 1];
      const refIdx = data.length - 1;
      const refTime = refBar.time;
      const leftIdx = Math.max(0, Math.floor(-this.chart.state.offsetX / barWidth));
      const leftTime = refTime + (leftIdx - refIdx) * interval;
      const startSnapped = Math.floor(leftTime / stepTime) * stepTime;
      for (let t = startSnapped; t < refTime + stepTime; t += stepTime) {
        const virtualIdx = refIdx + (t - refTime) / interval;
        const x = indexToX(virtualIdx, this.chart.state);
        if (x < -100) continue;
        if (x > chartAreaWidth) break;
        ctx.beginPath();
        ctx.moveTo(x, subPaneTop);
        ctx.lineTo(x, subPaneTop + subPaneHeight);
        ctx.stroke();
      }
    }

    // Draw horizontal grid lines inside sub-pane at volume levels
    // Style matches the main chart horizontal grid
    const horzOpts = this.chart.options.grid.horzLines || {};
    if (this.chart.options.grid.show && horzOpts.show !== false) {
      ctx.strokeStyle = horzOpts.color ?? '#2a2a2a';
      ctx.lineWidth = horzOpts.width ?? 1;
      ctx.setLineDash([]);
      // Draw 3 evenly spaced rows inside the sub-pane
      for (let row = 1; row <= 3; row++) {
        const gy = subPaneTop + (subPaneHeight / 4) * row;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(chartAreaWidth, gy);
        ctx.stroke();
      }
    }

    // Find min/max volume across visible bars
    const firstVisibleIdx = deriveVisibleStartIdx(this.chart.state, data.length);
    const barsVisible = Math.ceil(chartAreaWidth / barWidth) + 2;
    const endIdx = Math.min(firstVisibleIdx + barsVisible, data.length);

    let maxVol = 0;
    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const bar = data[i];
      if (bar && bar.volume != null && bar.volume > maxVol) {
        maxVol = bar.volume;
      }
    }
    if (maxVol <= 0) maxVol = 1;

    // Draw volume bars with 2px bottom margin and 10% top gap for visual comfort
    const volTopGap = Math.max(4, Math.round(subPaneHeight * 0.1));
    const volAreaHeight = subPaneHeight - 2 - volTopGap;
    const volTop = subPaneTop + volTopGap;

    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const bar = data[i];
      if (!bar || bar.volume == null) continue;

      const centerX = indexToX(i, this.chart.state);
      const candleWidth = Math.floor(barWidth * LAYOUT.CANDLE_GAP_RATIO);
      const x = centerX - candleWidth / 2;

      if (x + candleWidth < 0 || x > chartAreaWidth) continue;

      const volScale = this.chart.state.volumeScale;
      const volOffset = this.chart.state.volumeOffset;
      const visibleVolMax = maxVol / volScale;
      const visibleVolMin = Math.max(0, volOffset);
      const visibleRange = Math.max(1, visibleVolMax - visibleVolMin);
      const volRatio = Math.max(0, Math.min(1, (bar.volume - visibleVolMin) / visibleRange));
      const volBarHeight = Math.max(1, volRatio * volAreaHeight);
      const y = volTop + (volAreaHeight - volBarHeight);

      const isUp = bar.close >= bar.open;
      ctx.fillStyle = isUp ? volUpColor : volDownColor;
      ctx.fillRect(x, y, Math.max(1, candleWidth), volBarHeight);
    }

    // Draw volume axis labels on the price axis area within sub-pane
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const volLabelPadding = LAYOUT.LABEL_OFFSET;

    // Draw scaled volume axis ticks
    const volScale = this.chart.state.volumeScale;
    const volOffset = this.chart.state.volumeOffset;
    const visibleVolMax = maxVol / volScale;
    const visibleVolMin = Math.max(0, volOffset);
    const visibleRange = Math.max(1, visibleVolMax - visibleVolMin);
    const volTicks = [
      { ratio: 1.0, label: this.formatVolume(Math.round(visibleVolMin + visibleRange)) },
      { ratio: 0.75, label: this.formatVolume(Math.round(visibleVolMin + visibleRange * 0.75)) },
      { ratio: 0.5, label: this.formatVolume(Math.round(visibleVolMin + visibleRange * 0.5)) },
      { ratio: 0.25, label: this.formatVolume(Math.round(visibleVolMin + visibleRange * 0.25)) },
      { ratio: 0, label: this.formatVolume(Math.round(visibleVolMin)) }
    ];
    for (const tick of volTicks) {
      const tickY = subPaneTop + 2 + (volAreaHeight * (1 - tick.ratio));
      ctx.fillText(tick.label, w - volLabelPadding, tickY);
    }
    ctx.textAlign = 'left';
  }

  private formatVolume(value: number): string {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(0);
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
