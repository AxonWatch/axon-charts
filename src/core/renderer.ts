import { LAYOUT } from './layout.js';
import { priceToY, indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import { IChart } from '../types/index.js';
import { Axes } from '../ui/axes.js';
import { PriceFormatter } from '../utils/formatter.js';
import { SeriesRenderer } from '../series/SeriesRenderer.js';
import { CandlestickRenderer } from '../series/CandlestickRenderer.js';
import { LineRenderer } from '../series/LineRenderer.js';
import { AreaRenderer } from '../series/AreaRenderer.js';
import { BarRenderer } from '../series/BarRenderer.js';
import { HeikenAshiRenderer } from '../series/HeikenAshiRenderer.js';
import { HollowRenderer } from '../series/HollowRenderer.js';

/**
 * Handles all canvas rendering logic for candles, grid, and UI elements
 */
export class Renderer {
  private chart: IChart;
  private candleBuffer: HTMLCanvasElement | null = null;
  private bufferCtx: CanvasRenderingContext2D | null = null;
  private lastBufferPixelWidth: number = 0;
  private axes: Axes;
  private bufferRenderStart: number = 0;
  private bufferRenderEnd: number = 0;
  private seriesRenderer!: SeriesRenderer;
  private latestClose: number | null = null;
  private lastChangeTime: number = 0;

  constructor(chart: IChart) {
    this.chart = chart;
    this.axes = new Axes(chart);
    this.setSeriesType();
  }

  /**
   * Create or swap the series renderer based on current options.
   * Called on construction and whenever series.type changes.
   */
  setSeriesType(): void {
    const seriesType = this.chart.options.series.type ?? 'candlestick';
    switch (seriesType) {
      case 'line': this.seriesRenderer = new LineRenderer(); break;
      case 'area': this.seriesRenderer = new AreaRenderer(); break;
      case 'bar': this.seriesRenderer = new BarRenderer(); break;
      case 'heiken-ashi': this.seriesRenderer = new HeikenAshiRenderer(); break;
      case 'hollow': this.seriesRenderer = new HollowRenderer(); break;
      default:
      case 'candlestick': this.seriesRenderer = new CandlestickRenderer(); break;
    }
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
          Math.abs(this.lastBufferPixelWidth - currentBufferWidth) < LAYOUT.BUFFER_RECREATION_THRESHOLD) {
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

    this.lastBufferPixelWidth = this.candleBuffer ? this.candleBuffer.width / devicePixelRatio : 0;
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

    // 4. Clear the entire buffer before redrawing (prevents stale pixel buildup)
    const bufferCSSWidth = this.candleBuffer.width / devicePixelRatio;
    this.bufferCtx.clearRect(0, 0, bufferCSSWidth, this.chart.state.h);

    // 5. Delegate to active series renderer
    this.seriesRenderer.render(this.bufferCtx, this.chart, renderStart, renderEnd);

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
    const { data } = this.chart.state;
    if (data.length === 0) return;
    const lastIdx = data.length - 1;

    // Only redraw if the last index is within our buffer range
    if (lastIdx < this.bufferRenderStart || lastIdx >= this.bufferRenderEnd) return;

    // Delegate to active series renderer
    const needsFullRedraw = this.seriesRenderer.updateLast(
      this.bufferCtx, this.chart, lastIdx, this.bufferRenderStart
    );

    // Some renderers (line, area, Heiken-Ashi) need full redraw — re-run renderCandles
    if (needsFullRedraw) {
      this.renderCandles();
    }
  }

  drawBackground(ctx: CanvasRenderingContext2D, force: boolean = false): void {
    if (!force) return;
    const { w, h, axisWidth, bottomMargin } = this.chart.state;

    ctx.fillStyle = this.chart.options.layout.background ?? '#1e1e1e';
    ctx.fillRect(0, 0, w, h);

    this.axes.drawGrid(ctx);

    ctx.fillStyle = this.chart.options.layout.background ?? '#1e1e1e';
    ctx.fillRect(w - axisWidth, 0, axisWidth, h);
    ctx.fillRect(0, h - bottomMargin, w, bottomMargin);

    // Draw axis border lines (on top of axis overpaint, behind labels)
    // Vertical: between chart area and price axis — stops at time axis boundary.
    // Horizontal: between chart area and time axis — stops at price axis boundary.
    // Both extend to h - bottomMargin regardless of sub-panes — the time axis
    // and price axis zones are fixed. Sub-panes sit between them.
    const layout = this.chart.options.layout;
    const borderColor = layout.textColor ?? '#aaa';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    if (layout.borderVisible !== false) {
      const axisX = w - axisWidth;
      ctx.strokeStyle = borderColor;

      // Vertical: chart area ↔ price axis (full height)
      ctx.beginPath();
      ctx.moveTo(axisX, 0);
      ctx.lineTo(axisX, h - bottomMargin);
      ctx.stroke();

      // Horizontal: chart area ↔ time axis (full width)
      ctx.beginPath();
      ctx.moveTo(0, h - bottomMargin);
      ctx.lineTo(axisX, h - bottomMargin);
      ctx.stroke();
    }

    this.axes.drawTimeAxis(ctx);
    this.axes.drawPriceAxis(ctx);
    this.drawWatermark(ctx);

    // Draw 0% reference line in percentage mode
    this.drawPercentageReferenceLine(ctx);
  }

  drawViewport(mainCtx: CanvasRenderingContext2D): void {
    const { w, h, barWidth, devicePixelRatio, axisWidth, bottomMargin, chartBottom } = this.chart.state;

    // Only skip if dimensions are truly invalid (<= 0)
    if (w <= 0 || h <= 0 || barWidth <= 0) {
      return;
    }

    mainCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    mainCtx.imageSmoothingEnabled = false;
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

    // Atomic overlay: draw current price line in same render pass as buffer copy
    // This eliminates frame-race flicker between drawViewport and a separate overlay call
    this.drawCurrentPriceLine(mainCtx);
    this.drawLatestPriceMarker(mainCtx);
  }

  private drawCurrentPriceLine(ctx: CanvasRenderingContext2D): void {
    const { w, h, data, axisWidth, bottomMargin } = this.chart.state;
    if (data.length === 0) return;
    if (this.chart.options.priceScale.currentPrice?.show === false) return;

    const lastBar = data[data.length - 1];
    const cp = this.chart.options.priceScale.currentPrice;
    const layout = this.chart.options.layout;
    const seriesType = this.chart.options.series.type || 'candlestick';

    // Always use real close for the price line position and main label
    const currentPrice = lastBar.close;
    const isUp = lastBar.close >= lastBar.open;
    const yClose = priceToY(currentPrice, this.chart.state);

    // For line/area: use lineColor (not tied to up/down direction)
    // For OHLC series: cascading up/down colors
    const lineColor = (seriesType === 'line' || seriesType === 'area')
      ? (cp?.upColor || cp?.downColor || this.chart.options.series.lineColor || '#1E90FF')
      : (isUp
        ? (cp?.upColor || this.chart.options.series.upColor)
        : (cp?.downColor || this.chart.options.series.downColor));
    const textColor = cp?.textColor || layout.textColor;

    const clipBottom = this.chart.state.chartBottom || (h - bottomMargin);
    // Clamp the line Y to chart area — don't let it go diagonal
    const lineY = Math.max(this.chart.state.topMargin, Math.min(yClose, clipBottom));

    if (cp?.showLine !== false) {
      ctx.strokeStyle = lineColor ?? '#888';
      ctx.lineWidth = 1;
      ctx.setLineDash(cp?.lineStyle === 'solid' ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(w - axisWidth, lineY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const showCountdown = cp?.showCountdown;
    const labelHeight = showCountdown ? LAYOUT.CURRENT_PRICE_LABEL_HEIGHT : LAYOUT.LABEL_HEIGHT;
    
    // Use the same clamped Y for the label so it stays in the chart area
    const labelY = Math.min(yClose, clipBottom);
    ctx.fillStyle = this.hexToRgba(lineColor ?? '#888', LAYOUT.CURRENT_PRICE_LABEL_ALPHA);
    ctx.fillRect(w - axisWidth, labelY - labelHeight / 2, axisWidth, labelHeight);

    ctx.strokeStyle = lineColor ?? '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(w - axisWidth, labelY - labelHeight / 2, axisWidth, labelHeight);

    ctx.fillStyle = textColor ?? '#888';
    ctx.font = `${layout.fontSize}px ${layout.fontFamily}`;
    ctx.textAlign = 'right';
    
    let formattedPrice = this.chart.priceFormatter.formatPrice(currentPrice);
    if (this.chart.state.priceScaleMode === 'percentage' && this.chart.state.referencePrice > 0) {
      const pct = ((currentPrice - this.chart.state.referencePrice) / this.chart.state.referencePrice) * 100;
      formattedPrice = PriceFormatter.formatPercentage(pct);
    }

    // Draw real close label (standard behavior for all series)
    if (showCountdown) {
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, labelY - 2);

      const currentTime = Date.now();
      const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
      const candleCloseTime = lastBar.time + interval;
      const remainingMs = candleCloseTime - currentTime;

      if (remainingMs > 0) {
        const countdownText = this.formatCountdown(remainingMs, interval);
        ctx.fillStyle = (cp?.countdownColor || textColor) || '#aaa';
        ctx.font = `10px ${layout.fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.fillText(countdownText, w - LAYOUT.LABEL_OFFSET, labelY + 3);
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, labelY);
    }

    // HA mode: additional label at HA close level — no line, HA candle color, separate from real close
    if (seriesType === 'heiken-ashi') {
      const cache = this.getSeriesCache();
      const haArr = cache?.ha as Array<{o:number;h:number;l:number;c:number}> | undefined;
      if (haArr && haArr.length > 0) {
        const ha = haArr[haArr.length - 1];
        const haColor = (ha.c >= ha.o)
          ? (cp?.upColor || this.chart.options.series.upColor || '#22c55e')
          : (cp?.downColor || this.chart.options.series.downColor || '#ef4444');
        this.drawHaPriceLabel(ctx, ha.c, lastBar.close, haColor);
      }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private drawHaPriceLabel(ctx: CanvasRenderingContext2D, haClose: number, realClose: number, haColor: string): void {
    const { data, w, axisWidth } = this.chart.state;
    const layout = this.chart.options.layout;
    const cp = this.chart.options.priceScale.currentPrice;
    const showCountdown = cp?.showCountdown;
    // Use same label height as the real close label to match overlap detection
    const mainLabelH = showCountdown ? LAYOUT.CURRENT_PRICE_LABEL_HEIGHT : LAYOUT.LABEL_HEIGHT;
    const haLabelH = LAYOUT.LABEL_HEIGHT;  // HA label is compact, no countdown
    const haY = priceToY(haClose, this.chart.state);
    const realY = priceToY(realClose, this.chart.state);
    const clipBottom = this.chart.state.chartBottom || (this.chart.state.h - this.chart.state.bottomMargin);
    const y = Math.min(haY, clipBottom);

    // Compute the real close label's full occupied region (including countdown text below)
    const realCY = Math.min(realY, clipBottom);
    const realHalfH = mainLabelH / 2;
    const realTop = realCY - realHalfH;
    // Countdown text draws at labelY + 3 with 10px font — extends realBottom by ~13px
    const realBottom = realCY + realHalfH + (showCountdown ? 15 : 0);

    const haHalfH = haLabelH / 2;
    let labelY = y;
    // Overlap detection: does HA label box intersect real label box (including countdown)?
    if (labelY - haHalfH < realBottom && labelY + haHalfH > realTop) {
      // Overlap — shift HA label above or below the real label's full region
      labelY = (labelY < realCY)
        ? realTop - haHalfH - 4
        : realBottom + haHalfH + 4;
      // Clamp within chart area
      const minY = haHalfH + 2;
      const maxY = clipBottom - haHalfH - 2;
      labelY = Math.max(minY, Math.min(labelY, maxY));
    }

    // Draw HA price label box — same style as current price but no horizontal line
    ctx.fillStyle = this.hexToRgba(haColor, 0.20);
    ctx.fillRect(w - axisWidth, labelY - haHalfH, axisWidth, haLabelH);
    ctx.strokeStyle = haColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(w - axisWidth, labelY - haHalfH, axisWidth, haLabelH);

    // Text
    ctx.fillStyle = haColor;
    ctx.font = `${layout.fontSize}px ${layout.fontFamily}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const fmt = this.chart.priceFormatter.formatPrice(haClose);
    ctx.fillText(fmt, w - LAYOUT.LABEL_OFFSET, labelY);
    ctx.textAlign = 'left';
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

  /** Named CSS color to hex lookup */
  private static readonly NAMED_COLORS: Record<string, string> = {
    black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
    blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
    gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080',
    pink: '#ffc0cb', brown: '#a52a2a', transparent: '#000000'
  };

  private hexToRgba(hex: string, alpha: number): string {
    // Resolve named colors to hex
    const h = Renderer.NAMED_COLORS[hex.toLowerCase()] || hex;
    let r: number, g: number, b: number;

    if (/^#[0-9a-fA-F]{3}$/.test(h)) {
      // #RGB short form: duplicate each hex digit
      r = parseInt(h[1] + h[1], 16);
      g = parseInt(h[2] + h[2], 16);
      b = parseInt(h[3] + h[3], 16);
    } else if (/^#[0-9a-fA-F]{6}$/.test(h)) {
      // #RRGGBB standard form
      r = parseInt(h.slice(1, 3), 16);
      g = parseInt(h.slice(3, 5), 16);
      b = parseInt(h.slice(5, 7), 16);
    } else {
      // Fallback — use layout text color
      const fallback = this.chart.options.layout.textColor || '#aaa';
      const fb = Renderer.NAMED_COLORS[fallback.toLowerCase()] || fallback;
      if (/^#[0-9a-fA-F]{6}$/.test(fb)) {
        r = parseInt(fb.slice(1, 3), 16);
        g = parseInt(fb.slice(3, 5), 16);
        b = parseInt(fb.slice(5, 7), 16);
      } else {
        r = 170; g = 170; b = 170;
      }
    }
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

      // Use same target width regardless of rotation — both modes get equal font size
      const targetMeasuredWidth = chartAreaWidth * 0.30;

      fontSize = Math.round(baseFontSize * (targetMeasuredWidth / measuredWidth));
      fontSize = Math.max(12, Math.min(fontSize, 128));
    }

    ctx.save();
    ctx.font = `bold ${fontSize}px ${this.chart.options.layout.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = watermark.opacity ?? 0.07;
    const wmColor = watermark.color || this.chart.options.layout.textColor; ctx.fillStyle = wmColor || '#ffffff';

    if (isRotated) {
      ctx.translate(chartAreaWidth / 2, h / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(wmText, 0, 0);
    } else {
      ctx.fillText(wmText, chartAreaWidth / 2, h / 2);
    }

    ctx.restore();
  }

  /**
   * Draw horizontal line at 0% reference level in percentage mode.
   * Anchors the visual where percentage deviation calculations are relative to
   * (first visible candle's open price).
   */
  private drawPercentageReferenceLine(ctx: CanvasRenderingContext2D): void {
    const { w, axisWidth, bottomMargin, chartBottom } = this.chart.state;

    // Only draw in percentage mode with valid reference price
    if (this.chart.state.priceScaleMode !== 'percentage') return;
    if (this.chart.state.referencePrice <= 0) return;

    const clipBottom = chartBottom || (this.chart.state.h - bottomMargin);

    // Calculate Y position of 0% level (the reference price)
    const refPriceY = priceToY(this.chart.state.referencePrice, this.chart.state);

    // Don't draw if outside visible chart area
    if (refPriceY < 0 || refPriceY > clipBottom) return;

    // Draw solid horizontal line using axis text color
    ctx.strokeStyle = this.chart.options.layout.textColor || '#aaa';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, refPriceY);
    ctx.lineTo(w - axisWidth, refPriceY);
    ctx.stroke();
  }

  private drawLatestPriceMarker(ctx: CanvasRenderingContext2D): void {
    const { data } = this.chart.state;
    if (data.length === 0) return;

    const seriesOpts = this.chart.options.series;
    const seriesType = seriesOpts.type || 'candlestick';

    // Only for line/area series with animation enabled
    if (seriesType !== 'line' && seriesType !== 'area') return;
    if (seriesOpts.showLatestPriceMarker === false) return;
    if (seriesOpts.showLatestPriceAnimation === false) return;

    const lastBar = data[data.length - 1];

    // Track price changes - only animate on actual change from a known price
    if (this.latestClose !== null && lastBar.close !== this.latestClose) {
      this.latestClose = lastBar.close;
      this.lastChangeTime = Date.now();
    } else if (this.latestClose === null) {
      this.latestClose = lastBar.close;
    }

    const x = indexToX(data.length - 1, this.chart.state);
    const y = priceToY(lastBar.close, this.chart.state);
    const lineColor = seriesOpts.lineColor || '#1E90FF';

    // Pulse decay over 500ms after each price change
    const age = Date.now() - this.lastChangeTime;
    const decay = Math.max(0, 1 - age / 500);
    const dotR = 4 + decay * 5;

    ctx.fillStyle = lineColor;
    ctx.globalAlpha = 0.6 + decay * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  getSeriesCache(): Record<string, unknown> | null {
    return this.seriesRenderer.getSeriesCache?.() ?? null;
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