// Kybos Core v0.1.0
"use strict";
var KybosCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    Axes: () => Axes,
    Chart: () => Chart,
    Crosshair: () => Crosshair,
    DataManager: () => DataManager,
    EventManager: () => EventManager,
    LAYOUT: () => LAYOUT,
    Projection: () => projection_exports,
    Renderer: () => Renderer,
    calculateTimeStep: () => calculateTimeStep,
    clamp: () => clamp,
    createChart: () => createChart,
    getPriceDecimals: () => getPriceDecimals,
    niceStep: () => niceStep,
    niceTicks: () => niceTicks,
    roundTo: () => roundTo
  });

  // src/core/layout.ts
  var LAYOUT = {
    // === Structural Margins ===
    TOP_MARGIN: 40,
    BOTTOM_MARGIN: 35,
    RIGHT_GAP: 60,
    // === Label Styling ===
    LABEL_WIDTH: 50,
    LABEL_HEIGHT: 20,
    CURRENT_PRICE_LABEL_HEIGHT: 30,
    LABEL_OFFSET: 15,
    // Distance of labels from axis edge
    TIME_LABEL_Y: 23,
    // Vertical offset for time labels
    // === Interaction ===
    COLLISION_THRESHOLD: 25,
    AUTO_SCROLL_BUFFER: 8,
    DEFAULT_RIGHT_PADDING_BARS: 2,
    // === Behavior & Scaling ===
    ZOOM_FACTOR_IN: 1.15,
    ZOOM_FACTOR_OUT: 0.87,
    PRICE_SCROLL_FACTOR_IN: 1.1,
    PRICE_SCROLL_FACTOR_OUT: 0.9,
    MAX_ZOOM_DIVISOR: 2.9,
    DRAG_SCALE_DIVISOR: 200,
    ZOOM_SENSITIVITY: 20,
    // === Candle Rendering ===
    CANDLE_GAP_RATIO: 0.8,
    MIN_BAR_WIDTH: 4,
    MAX_BUFFER_WIDTH: 4e3,
    BUFFER_RECREATION_THRESHOLD: 10,
    // === Axis & UI Styling ===
    NICE_THRESHOLD_LOW: 1.5,
    NICE_THRESHOLD_MID: 3,
    NICE_THRESHOLD_HIGH: 7,
    TIME_LABEL_TARGET_PIXELS: 80,
    DEFAULT_TIME_INTERVAL: 6e4,
    DEFAULT_MAX_BARS: 5e3,
    DEFAULT_PRICE_RANGE: { min: 0, max: 100 },
    PRICE_PADDING_RATIO: 0.07,
    CURRENT_PRICE_LABEL_ALPHA: 0.2,
    TOOLTIP_MARGIN_X: 10,
    TOOLTIP_MARGIN_Y: 15,
    TOOLTIP_LABEL_SPACING: 15,
    OFFSCREEN_PRICE_FALLBACK: -1e3
  };
  function getUsableHeight(height) {
    return height - LAYOUT.TOP_MARGIN - LAYOUT.BOTTOM_MARGIN;
  }

  // src/core/data.ts
  var DataManager = class {
    constructor(maxBars = LAYOUT.DEFAULT_MAX_BARS) {
      this._data = [];
      this._maxBars = maxBars;
    }
    /**
     * Get all data
     */
    get data() {
      return this._data;
    }
    /**
     * Get number of bars
     */
    get length() {
      return this._data.length;
    }
    /**
     * Check if data is empty
     */
    get isEmpty() {
      return this._data.length === 0;
    }
    /**
     * Replace all data with new data
     */
    setData(bars) {
      this._data = [...bars];
      this.enforceMaxLimit();
    }
    /**
     * Append a new bar to the end
     */
    appendBar(bar) {
      this._data.push(bar);
      this.enforceMaxLimit();
    }
    /**
     * Update the last bar (for live updates)
     */
    updateLastBar(bar) {
      if (this._data.length === 0) {
        this._data.push(bar);
        return;
      }
      const lastBar = this._data[this._data.length - 1];
      if (bar.time !== lastBar.time) {
        this.appendBar(bar);
      } else {
        this._data[this._data.length - 1] = bar;
      }
    }
    /**
     * Get a bar by index
     */
    getBar(index) {
      return this._data[index];
    }
    /**
     * Get bar at a specific timestamp
     */
    getBarAtTime(timestamp) {
      let left = 0;
      let right = this._data.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const bar = this._data[mid];
        if (bar.time === timestamp) {
          return bar;
        } else if (bar.time < timestamp) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }
      return void 0;
    }
    /**
     * Get visible range of data
     */
    getVisibleRange(startIdx, count) {
      const from = Math.max(0, startIdx);
      const to = Math.min(this._data.length, from + count);
      return { from, to };
    }
    /**
     * Calculate price range for visible bars
     */
    getPriceRange(startIdx, count) {
      if (this._data.length === 0) {
        return LAYOUT.DEFAULT_PRICE_RANGE;
      }
      const end = Math.min(this._data.length, startIdx + count);
      let minP = Infinity;
      let maxP = -Infinity;
      for (let i = startIdx; i < end; i++) {
        const bar = this._data[i];
        if (!bar)
          continue;
        minP = Math.min(minP, bar.low);
        maxP = Math.max(maxP, bar.high);
      }
      const padding = (maxP - minP) * LAYOUT.PRICE_PADDING_RATIO || 1;
      return {
        min: minP - padding,
        max: maxP + padding
      };
    }
    /**
     * Enforce maximum bar limit by removing oldest bars
     */
    enforceMaxLimit() {
      if (this._data.length > this._maxBars) {
        const excess = this._data.length - this._maxBars;
        this._data.splice(0, excess);
      }
    }
    /**
     * Get all data (read-only copy)
     */
    getData() {
      return [...this._data];
    }
    /**
     * Clear all data
     */
    clear() {
      this._data = [];
    }
  };

  // src/utils/projection.ts
  var projection_exports = {};
  __export(projection_exports, {
    calculateRightEdgeOffset: () => calculateRightEdgeOffset,
    clampOffsetX: () => clampOffsetX,
    deriveVisibleStartIdx: () => deriveVisibleStartIdx,
    indexToX: () => indexToX,
    priceToY: () => priceToY,
    xToIndex: () => xToIndex,
    yToPrice: () => yToPrice
  });
  function priceToY(price, state) {
    const usableH = getUsableHeight(state.h);
    let ratio;
    if (state.priceScaleMode === "logarithmic") {
      const minLog = Math.log10(Math.max(state.priceMin, 0.01));
      const maxLog = Math.log10(Math.max(state.priceMax, 0.02));
      const priceLog = Math.log10(Math.max(price, 0.01));
      ratio = (priceLog - minLog) / (maxLog - minLog || 1);
    } else {
      const priceRange = state.priceMax - state.priceMin || 1;
      ratio = (price - state.priceMin) / priceRange;
    }
    const baseY = state.h - LAYOUT.BOTTOM_MARGIN - ratio * usableH;
    return baseY + state.priceOffset;
  }
  function yToPrice(y, state) {
    const usableH = getUsableHeight(state.h);
    const adjustedY = y - state.priceOffset;
    const ratio = (state.h - LAYOUT.BOTTOM_MARGIN - adjustedY) / usableH;
    if (state.priceScaleMode === "logarithmic") {
      const minLog = Math.log10(Math.max(state.priceMin, 0.01));
      const maxLog = Math.log10(Math.max(state.priceMax, 0.02));
      const priceLog = minLog + ratio * (maxLog - minLog || 1);
      return Math.pow(10, priceLog);
    } else {
      const priceRange = state.priceMax - state.priceMin || 1;
      return state.priceMin + ratio * priceRange;
    }
  }
  function indexToX(index, state) {
    return index * state.barWidth + state.offsetX + state.barWidth / 2;
  }
  function xToIndex(x, state) {
    return Math.round((x - state.offsetX - state.barWidth / 2) / state.barWidth);
  }
  function deriveVisibleStartIdx(state, totalBars) {
    const firstVisible = Math.floor(-state.offsetX / state.barWidth);
    return Math.max(0, Math.min(firstVisible, totalBars - 1));
  }
  function clampOffsetX(offsetX, barWidth, totalBars, screenWidth, rightGap, axisWidth) {
    const chartAreaWidth = screenWidth - axisWidth;
    const maxOffsetX = chartAreaWidth - barWidth * 2;
    return Math.min(maxOffsetX, offsetX);
  }
  function calculateRightEdgeOffset(totalBars, barWidth, screenWidth, rightGap, axisWidth) {
    const chartAreaWidth = screenWidth - axisWidth;
    const targetRightEdge = chartAreaWidth - rightGap - 1;
    return targetRightEdge - totalBars * barWidth;
  }

  // src/utils/math.ts
  function niceStep(range, targetTicks = 7) {
    if (range === 0)
      return 1;
    const rough = range / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / magnitude;
    let nice;
    if (normalized < LAYOUT.NICE_THRESHOLD_LOW) {
      nice = 1;
    } else if (normalized < LAYOUT.NICE_THRESHOLD_MID) {
      nice = 2;
    } else if (normalized < LAYOUT.NICE_THRESHOLD_HIGH) {
      nice = 5;
    } else {
      nice = 10;
    }
    return nice * magnitude;
  }
  function calculateTimeStep(barWidth) {
    if (!barWidth || barWidth <= 0)
      return 10;
    const targetPixels = LAYOUT.TIME_LABEL_TARGET_PIXELS;
    const roughStep = targetPixels / barWidth;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep) || 0));
    const normalized = roughStep / magnitude;
    let nice;
    if (normalized < LAYOUT.NICE_THRESHOLD_LOW) {
      nice = 1;
    } else if (normalized < LAYOUT.NICE_THRESHOLD_MID) {
      nice = 2;
    } else if (normalized < LAYOUT.NICE_THRESHOLD_HIGH) {
      nice = 5;
    } else {
      nice = 10;
    }
    return Math.max(1, nice * magnitude);
  }
  function niceTicks(min, max, targetTicks = 7) {
    if (min === max)
      return [min];
    const range = max - min;
    const step = niceStep(range, targetTicks);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];
    for (let tick = niceMin; tick <= niceMax + step * 0.5; tick += step) {
      if (tick >= min - step * 0.5 && tick <= max + step * 0.5) {
        ticks.push(tick);
      }
    }
    return ticks;
  }
  function roundTo(value, decimals) {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function getPriceDecimals(price) {
    if (price >= 1e3)
      return 2;
    if (price >= 100)
      return 2;
    if (price >= 10)
      return 2;
    if (price >= 1)
      return 2;
    return 4;
  }

  // src/ui/axes.ts
  var Axes = class {
    constructor(chart) {
      this.chart = chart;
    }
    /**
     * Draw price axis with nice-tick algorithm
     * VIRTUAL: Derives prices from the current viewport boundaries
     */
    drawPriceAxis(ctx) {
      const { w, h, axisWidth } = this.chart.state;
      const topPrice = yToPrice(0, this.chart.state);
      const bottomPrice = yToPrice(h - LAYOUT.BOTTOM_MARGIN, this.chart.state);
      const ticks = niceTicks(
        Math.min(topPrice, bottomPrice),
        Math.max(topPrice, bottomPrice),
        10
      );
      const data = this.chart.dataManager.data;
      const currentPrice = data.length > 0 ? data[data.length - 1].close : null;
      const currentPriceY = currentPrice !== null ? priceToY(currentPrice, this.chart.state) : LAYOUT.OFFSCREEN_PRICE_FALLBACK;
      ctx.fillStyle = this.chart.options.layout.textColor;
      ctx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ticks.forEach((price) => {
        const y = priceToY(price, this.chart.state);
        if (y < 0 || y > h - LAYOUT.BOTTOM_MARGIN)
          return;
        if (Math.abs(y - currentPriceY) < LAYOUT.COLLISION_THRESHOLD)
          return;
        const label = this.chart.priceFormatter.formatPrice(price);
        ctx.fillText(label, w - LAYOUT.LABEL_OFFSET, y);
      });
      ctx.textAlign = "left";
    }
    /**
     * Draw time axis with interval snapping
     * VIRTUAL & SNAPPED: Anchors to clean time boundaries (e.g. 13:00, 14:00)
     */
    drawTimeAxis(ctx) {
      const { w, h, barWidth, data, axisWidth } = this.chart.state;
      if (data.length === 0)
        return;
      const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
      const step = calculateTimeStep(barWidth);
      const stepTime = step * interval;
      const refBar = data[data.length - 1];
      const refIdx = data.length - 1;
      const refTime = refBar.time;
      const leftIndex = xToIndex(0, this.chart.state);
      const leftTime = refTime + (leftIndex - refIdx) * interval;
      const startSnappedTime = Math.floor(leftTime / stepTime) * stepTime;
      const chartWidth = w - axisWidth;
      ctx.strokeStyle = this.chart.options.grid.vertLines.color;
      ctx.fillStyle = this.chart.options.layout.textColor;
      ctx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!this.chart.options.grid.show)
        ctx.strokeStyle = "transparent";
      if (!this.chart.options.timeScale.visible)
        return;
      const safeStepTime = Math.max(1, stepTime || 1);
      let iterations = 0;
      const MAX_ITERATIONS = 1e3;
      for (let currentT = startSnappedTime; ; currentT += safeStepTime) {
        if (++iterations > MAX_ITERATIONS)
          break;
        const virtualIdx = refIdx + (currentT - refTime) / interval;
        const x = indexToX(virtualIdx, this.chart.state);
        if (x > chartWidth)
          break;
        if (x < -100)
          continue;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - LAYOUT.BOTTOM_MARGIN);
        ctx.stroke();
        if (x >= 0 && x <= chartWidth) {
          const label = this.formatTimeLabel(currentT, virtualIdx, step, interval);
          ctx.fillText(label, x, h - LAYOUT.TIME_LABEL_Y);
        }
      }
      ctx.textAlign = "left";
    }
    /**
     * Format time label with date rollover
     */
    formatTimeLabel(time, index, step, interval) {
      const date = new Date(time);
      const prevTime = time - step * interval;
      const prevDate = new Date(prevTime);
      const isNewDay = date.getDate() !== prevDate.getDate() || date.getMonth() !== prevDate.getMonth() || date.getFullYear() !== prevDate.getFullYear();
      if (isNewDay) {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      } else {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      }
    }
    /**
     * Draw grid lines
     */
    drawGrid(ctx) {
      if (!this.chart.options.grid.show)
        return;
      const { w, h, axisWidth } = this.chart.state;
      ctx.strokeStyle = this.chart.options.grid.horzLines.color;
      ctx.lineWidth = this.chart.options.grid.horzLines.width;
      const topPrice = yToPrice(0, this.chart.state);
      const bottomPrice = yToPrice(h - LAYOUT.BOTTOM_MARGIN, this.chart.state);
      const ticks = niceTicks(
        Math.min(topPrice, bottomPrice),
        Math.max(topPrice, bottomPrice),
        10
      );
      ticks.forEach((price) => {
        const y = priceToY(price, this.chart.state);
        if (y < 0 || y > h - LAYOUT.BOTTOM_MARGIN)
          return;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w - axisWidth, y);
        ctx.stroke();
      });
    }
  };

  // src/core/renderer.ts
  var Renderer = class {
    constructor(chart) {
      this.candleBuffer = null;
      this.bufferCtx = null;
      this.lastBufferWidth = 0;
      this.bufferRenderStart = 0;
      this.bufferRenderEnd = 0;
      this.chart = chart;
      this.axes = new Axes(chart);
    }
    /**
     * Create or resize the offscreen buffer
     */
    createBuffer() {
      const { w, h, devicePixelRatio, barWidth } = this.chart.state;
      const screenBars = Math.ceil(w / barWidth);
      const marginPixels = Math.min(w, 1e3);
      const marginBars = Math.max(20, Math.ceil(marginPixels / barWidth));
      const minBarsNeeded = screenBars + marginBars;
      let bufferWidth = Math.ceil(minBarsNeeded * barWidth);
      bufferWidth = Math.min(bufferWidth, LAYOUT.MAX_BUFFER_WIDTH);
      if (this.candleBuffer) {
        const currentBufferWidth = this.candleBuffer.width / devicePixelRatio;
        if (Math.abs(currentBufferWidth - bufferWidth) < LAYOUT.BUFFER_RECREATION_THRESHOLD && this.lastBufferWidth === barWidth) {
          return;
        }
      }
      if (!this.candleBuffer) {
        this.candleBuffer = document.createElement("canvas");
      }
      this.candleBuffer.width = Math.ceil(bufferWidth * devicePixelRatio);
      this.candleBuffer.height = Math.ceil(h * devicePixelRatio);
      this.bufferCtx = this.candleBuffer.getContext("2d", { alpha: true });
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
    renderCandles() {
      if (!this.bufferCtx || !this.candleBuffer)
        return;
      const { data, barWidth, w, devicePixelRatio } = this.chart.state;
      if (data.length === 0)
        return;
      const bufferWidthCSS = this.candleBuffer.width / devicePixelRatio;
      const maxBarsInBuffer = Math.floor(bufferWidthCSS / barWidth);
      const visibleStartIdx = deriveVisibleStartIdx(this.chart.state, data.length);
      const screenBars = Math.ceil(w / barWidth);
      const spareBars = maxBarsInBuffer - screenBars;
      const renderStart = Math.max(0, visibleStartIdx - Math.floor(spareBars / 2));
      const renderEnd = Math.min(data.length, renderStart + maxBarsInBuffer);
      this.bufferCtx.clearRect(0, 0, bufferWidthCSS, this.chart.state.h);
      this.bufferCtx.lineWidth = 1;
      for (let i = renderStart; i < renderEnd; i++) {
        this.drawCandleToBuffer(i, renderStart);
      }
      this.bufferRenderStart = renderStart;
      this.bufferRenderEnd = renderEnd;
    }
    drawCandleToBuffer(index, startIdx) {
      if (!this.bufferCtx)
        return;
      const { data, barWidth } = this.chart.state;
      const bar = data[index];
      if (!bar)
        return;
      const bufferX = (index - startIdx) * barWidth;
      const centerX = bufferX + barWidth / 2;
      const yHigh = priceToY(bar.high, this.chart.state);
      const yLow = priceToY(bar.low, this.chart.state);
      const yOpen = priceToY(bar.open, this.chart.state);
      const yClose = priceToY(bar.close, this.chart.state);
      const isUp = bar.close >= bar.open;
      const color = isUp ? this.chart.options.colors.up : this.chart.options.colors.down;
      this.bufferCtx.fillStyle = color;
      this.bufferCtx.strokeStyle = color;
      const wickX = Math.floor(centerX) + 0.5;
      this.bufferCtx.beginPath();
      this.bufferCtx.moveTo(wickX, yHigh);
      this.bufferCtx.lineTo(wickX, yLow);
      this.bufferCtx.stroke();
      let bodyWidth = Math.floor(barWidth * LAYOUT.CANDLE_GAP_RATIO);
      if (bodyWidth % 2 === 0 && bodyWidth > 1)
        bodyWidth--;
      const bodyLeft = Math.floor(wickX) - Math.floor(bodyWidth / 2);
      this.bufferCtx.fillRect(
        bodyLeft,
        Math.floor(Math.min(yOpen, yClose)),
        bodyWidth,
        Math.max(Math.abs(yOpen - yClose), 1)
      );
    }
    drawBackground(ctx, force = false) {
      if (!force)
        return;
      const { w, h, axisWidth } = this.chart.state;
      ctx.fillStyle = this.chart.options.layout.background;
      ctx.fillRect(0, 0, w, h);
      this.axes.drawGrid(ctx);
      ctx.fillStyle = this.chart.options.layout.background;
      ctx.fillRect(w - axisWidth, 0, axisWidth, h);
      ctx.fillRect(0, h - LAYOUT.BOTTOM_MARGIN, w, LAYOUT.BOTTOM_MARGIN);
      this.axes.drawTimeAxis(ctx);
      this.axes.drawPriceAxis(ctx);
      this.drawCurrentPriceLine(ctx);
    }
    drawViewport(mainCtx) {
      const { w, h, barWidth, devicePixelRatio, axisWidth } = this.chart.state;
      mainCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      mainCtx.clearRect(0, 0, w, h);
      mainCtx.save();
      mainCtx.beginPath();
      mainCtx.rect(0, 0, w - axisWidth, h - LAYOUT.BOTTOM_MARGIN);
      mainCtx.clip();
      const bufferStartScreenX = indexToX(this.bufferRenderStart, this.chart.state) - barWidth / 2;
      const bufferWidthCSS = (this.bufferRenderEnd - this.bufferRenderStart) * barWidth;
      if (this.candleBuffer) {
        mainCtx.drawImage(
          this.candleBuffer,
          0,
          0,
          bufferWidthCSS * devicePixelRatio,
          h * devicePixelRatio,
          bufferStartScreenX,
          0,
          bufferWidthCSS,
          h
        );
      }
      mainCtx.restore();
    }
    drawCurrentPriceLine(ctx) {
      const { w, h, data, axisWidth } = this.chart.state;
      if (data.length === 0)
        return;
      const lastBar = data[data.length - 1];
      const currentPrice = lastBar.close;
      const yClose = priceToY(currentPrice, this.chart.state);
      const isUp = lastBar.close >= lastBar.open;
      const lineColor = isUp ? this.chart.options.colors.up : this.chart.options.colors.down;
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
      ctx.fillStyle = "#ffffff";
      ctx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
      ctx.textAlign = "right";
      const formattedPrice = this.chart.priceFormatter.formatPrice(currentPrice);
      if (showCountdown) {
        ctx.textBaseline = "alphabetic";
        ctx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, yClose - 2);
        const currentTime = Date.now();
        const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
        const candleCloseTime = lastBar.time + interval;
        const remainingMs = candleCloseTime - currentTime;
        if (remainingMs > 0) {
          const countdownText = this.formatCountdown(remainingMs, interval);
          ctx.fillStyle = this.chart.options.priceScale.currentPrice?.countdownColor || "rgba(255, 255, 255, 0.8)";
          ctx.font = `10px ${this.chart.options.layout.fontFamily}`;
          ctx.textBaseline = "top";
          ctx.fillText(countdownText, w - LAYOUT.LABEL_OFFSET, yClose + 3);
        }
      } else {
        ctx.textBaseline = "middle";
        ctx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, yClose);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    formatCountdown(remainingMs, intervalMs) {
      const remainingSec = Math.ceil(remainingMs / 1e3);
      if (intervalMs <= 36e5) {
        if (remainingSec < 60)
          return `${remainingSec}s`;
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      if (intervalMs <= 864e5) {
        const hours2 = Math.floor(remainingSec / 3600);
        const mins = Math.floor(remainingSec % 3600 / 60);
        const secs = remainingSec % 60;
        return `${hours2.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      const days = Math.floor(remainingSec / 86400);
      const hours = Math.floor(remainingSec % 86400 / 3600);
      return `${days}d ${hours}h`;
    }
    hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    destroy() {
      if (this.candleBuffer) {
        this.candleBuffer.width = 0;
        this.candleBuffer.height = 0;
        this.candleBuffer = null;
      }
      this.bufferCtx = null;
    }
  };

  // src/ui/crosshair.ts
  var Crosshair = class {
    constructor(chart) {
      this.x = -1;
      this.y = -1;
      this.visible = false;
      this.chart = chart;
      this.overlayCanvas = document.createElement("canvas");
      this.overlayCanvas.id = "overlay";
      this.overlayCanvas.style.position = "absolute";
      this.overlayCanvas.style.top = "0";
      this.overlayCanvas.style.left = "0";
      this.overlayCanvas.style.display = "block";
      this.overlayCanvas.style.pointerEvents = "none";
      this.overlayCanvas.style.zIndex = "10";
      this.overlayCtx = this.overlayCanvas.getContext("2d");
      this.handleMouseMove = (e) => {
        this.x = e.offsetX;
        this.y = e.offsetY;
        this.visible = true;
        this.draw();
      };
      this.handleMouseLeave = () => {
        this.visible = false;
        this.draw();
      };
      this.chart.container.appendChild(this.overlayCanvas);
      this.setupEventListeners();
    }
    /**
     * Set up mouse event listeners
     */
    setupEventListeners() {
      const mainCanvas = this.chart.mainCanvas;
      mainCanvas.addEventListener("mousemove", this.handleMouseMove);
      mainCanvas.addEventListener("mouseleave", this.handleMouseLeave);
    }
    /**
     * Find bar under cursor
     */
    hitTest(x) {
      const { data } = this.chart.state;
      if (x < 0 || x > this.chart.state.w - LAYOUT.RIGHT_GAP) {
        return null;
      }
      const index = xToIndex(x, this.chart.state);
      if (index >= 0 && index < data.length) {
        return index;
      }
      return null;
    }
    /**
     * Get bar at index
     */
    getBarAt(index) {
      return this.chart.dataManager.data[index];
    }
    /**
     * Get price at Y coordinate
     * Uses unified projection system (same as renderer)
     */
    getPriceAt(y) {
      return yToPrice(y, this.chart.state);
    }
    /**
     * Draw crosshair and tooltip
     */
    draw() {
      const { w, h, axisWidth } = this.chart.state;
      this.overlayCtx.clearRect(0, 0, w, h);
      const isOverPriceAxis = this.x > w - axisWidth;
      const isOverTimeAxis = this.y > h - LAYOUT.BOTTOM_MARGIN;
      const isOverChart = !isOverPriceAxis && !isOverTimeAxis;
      const data = this.chart.dataManager.data;
      let barIndex;
      if (this.visible && isOverChart) {
        barIndex = xToIndex(this.x, this.chart.state);
      } else {
        barIndex = data.length - 1;
      }
      barIndex = Math.max(0, Math.min(barIndex, data.length - 1));
      const interval = data.length > 1 ? data[1].time - data[0].time : LAYOUT.DEFAULT_TIME_INTERVAL;
      const refTime = data.length > 0 ? data[data.length - 1].time : Date.now();
      const refIdx = data.length > 0 ? data.length - 1 : 0;
      const virtualTime = refTime + (barIndex - refIdx) * interval;
      if (this.visible && isOverChart && this.chart.options.crosshair.mode !== "none") {
        const snapX = indexToX(barIndex, this.chart.state);
        if (this.chart.options.crosshair.showLabels) {
          this.drawPriceLabel(this.getPriceAt(this.y));
          this.drawTimeLabel(virtualTime, snapX);
        }
        const vert = this.chart.options.crosshair.vertLine;
        const horz = this.chart.options.crosshair.horzLine;
        this.overlayCtx.strokeStyle = vert.color;
        this.overlayCtx.lineWidth = vert.width;
        this.overlayCtx.setLineDash(vert.style === "dashed" ? [4, 4] : []);
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(snapX, 0);
        this.overlayCtx.lineTo(snapX, h - LAYOUT.BOTTOM_MARGIN);
        this.overlayCtx.stroke();
        this.overlayCtx.strokeStyle = horz.color;
        this.overlayCtx.lineWidth = horz.width;
        this.overlayCtx.setLineDash(horz.style === "dashed" ? [4, 4] : []);
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(0, this.y);
        this.overlayCtx.lineTo(w - axisWidth, this.y);
        this.overlayCtx.stroke();
        this.overlayCtx.setLineDash([]);
      }
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
    drawTooltip(bar) {
      const open = bar.open.toFixed(2);
      const high = bar.high.toFixed(2);
      const low = bar.low.toFixed(2);
      const close = bar.close.toFixed(2);
      const isUp = bar.close >= bar.open;
      const color = isUp ? this.chart.options.colors.up : this.chart.options.colors.down;
      const startX = LAYOUT.TOOLTIP_MARGIN_X;
      const startY = LAYOUT.TOOLTIP_MARGIN_Y;
      this.overlayCtx.font = "bold 12px system-ui";
      this.overlayCtx.textBaseline = "top";
      this.overlayCtx.textAlign = "left";
      const labelColor = "#888";
      let currentX = startX;
      this.overlayCtx.fillStyle = labelColor;
      this.overlayCtx.fillText("O", currentX, startY);
      currentX += LAYOUT.TOOLTIP_LABEL_SPACING;
      this.overlayCtx.fillStyle = color;
      this.overlayCtx.fillText(open, currentX, startY);
      currentX += this.overlayCtx.measureText(open).width + LAYOUT.TOOLTIP_LABEL_SPACING;
      this.overlayCtx.fillStyle = labelColor;
      this.overlayCtx.fillText("H", currentX, startY);
      currentX += LAYOUT.TOOLTIP_LABEL_SPACING;
      this.overlayCtx.fillStyle = color;
      this.overlayCtx.fillText(high, currentX, startY);
      currentX += this.overlayCtx.measureText(high).width + LAYOUT.TOOLTIP_LABEL_SPACING;
      this.overlayCtx.fillStyle = labelColor;
      this.overlayCtx.fillText("L", currentX, startY);
      currentX += LAYOUT.TOOLTIP_LABEL_SPACING;
      this.overlayCtx.fillStyle = color;
      this.overlayCtx.fillText(low, currentX, startY);
      currentX += this.overlayCtx.measureText(low).width + LAYOUT.TOOLTIP_LABEL_SPACING;
      this.overlayCtx.fillStyle = labelColor;
      this.overlayCtx.fillText("C", currentX, startY);
      currentX += LAYOUT.TOOLTIP_LABEL_SPACING;
      this.overlayCtx.fillStyle = color;
      this.overlayCtx.fillText(close, currentX, startY);
    }
    /**
     * Draw price label on Y axis
     */
    drawPriceLabel(price) {
      const { w, axisWidth } = this.chart.state;
      const labelHeight = LAYOUT.LABEL_HEIGHT;
      this.overlayCtx.fillStyle = this.chart.options.layout.background;
      this.overlayCtx.fillRect(w - axisWidth, this.y - labelHeight / 2, axisWidth, labelHeight);
      this.overlayCtx.strokeStyle = this.chart.options.layout.textColor;
      this.overlayCtx.lineWidth = 1;
      this.overlayCtx.strokeRect(w - axisWidth, this.y - labelHeight / 2, axisWidth, labelHeight);
      this.overlayCtx.fillStyle = this.chart.options.layout.textColor;
      this.overlayCtx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
      this.overlayCtx.textAlign = "right";
      this.overlayCtx.textBaseline = "middle";
      const formattedPrice = this.chart.priceFormatter.formatPrice(price);
      this.overlayCtx.fillText(formattedPrice, w - LAYOUT.LABEL_OFFSET, this.y);
    }
    /**
     * Draw time label on X axis
     */
    drawTimeLabel(time, x) {
      const { h } = this.chart.state;
      const date = new Date(time);
      const timeStr = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      this.overlayCtx.font = `${this.chart.options.layout.fontSize}px ${this.chart.options.layout.fontFamily}`;
      const textWidth = this.overlayCtx.measureText(timeStr).width;
      const padding = 10;
      const boxWidth = textWidth + padding * 2;
      const boxHeight = LAYOUT.LABEL_HEIGHT;
      const textY = h - LAYOUT.TIME_LABEL_Y;
      const boxY = textY - boxHeight / 2;
      this.overlayCtx.fillStyle = this.chart.options.layout.background;
      this.overlayCtx.fillRect(x - boxWidth / 2, boxY, boxWidth, boxHeight);
      this.overlayCtx.strokeStyle = this.chart.options.layout.textColor;
      this.overlayCtx.lineWidth = 1;
      this.overlayCtx.strokeRect(x - boxWidth / 2, boxY, boxWidth, boxHeight);
      this.overlayCtx.fillStyle = this.chart.options.layout.textColor;
      this.overlayCtx.textAlign = "center";
      this.overlayCtx.textBaseline = "middle";
      this.overlayCtx.fillText(timeStr, x, textY);
    }
    /**
     * Update crosshair position
     */
    setPosition(x, y) {
      this.x = x;
      this.y = y;
      this.visible = true;
      this.draw();
    }
    /**
     * Hide crosshair
     */
    hide() {
      this.visible = false;
      this.draw();
    }
    /**
     * Resize overlay canvas
     */
    resize(w, h, devicePixelRatio) {
      this.overlayCanvas.width = w * devicePixelRatio;
      this.overlayCanvas.height = h * devicePixelRatio;
      this.overlayCanvas.style.width = w + "px";
      this.overlayCanvas.style.height = h + "px";
      this.overlayCtx.scale(devicePixelRatio, devicePixelRatio);
    }
    /**
     * Clean up
     */
    destroy() {
      const mainCanvas = this.chart.mainCanvas;
      mainCanvas.removeEventListener("mousemove", this.handleMouseMove);
      mainCanvas.removeEventListener("mouseleave", this.handleMouseLeave);
      this.overlayCanvas.remove();
    }
  };

  // src/interaction/events.ts
  var EventManager = class {
    constructor(chart) {
      this.isDragging = false;
      this.lastMouseX = 0;
      this.lastMouseY = 0;
      this.lastTouchDistance = 0;
      this.autoScrollEnabled = true;
      this.dragMode = "chart";
      this.rafId = null;
      /**
       * Handle double click
       */
      this.handleDblClick = (e) => {
        const { w, h, axisWidth } = this.chart.state;
        const chartAreaWidth = w - axisWidth;
        if (e.offsetX > chartAreaWidth) {
          this.chart.state.priceScale = 1;
          this.chart.state.priceOffset = 0;
          this.chart.render();
        }
        if (e.offsetY > h - LAYOUT.BOTTOM_MARGIN) {
          this.chart.state.barWidth = this.chart.state.baseBarWidth;
          this.chart.renderer.createBuffer();
          this.scrollToLatest();
        }
      };
      /**
       * Handle wheel zoom
       */
      this.handleWheel = (e) => {
        if (!this.chart.options.behavior.scrollToZoom)
          return;
        e.preventDefault();
        const factor = e.deltaY > 0 ? LAYOUT.ZOOM_FACTOR_OUT : LAYOUT.ZOOM_FACTOR_IN;
        const { w, h, rightGap, axisWidth } = this.chart.state;
        const chartAreaWidth = w - axisWidth;
        if (e.offsetX > chartAreaWidth) {
          this.chart.state.priceScale *= e.deltaY > 0 ? LAYOUT.PRICE_SCROLL_FACTOR_IN : LAYOUT.PRICE_SCROLL_FACTOR_OUT;
          this.chart.state.priceScale = Math.max(0.1, Math.min(this.chart.state.priceScale, 10));
          this.chart.render();
          return;
        }
        const isTimeAxis = e.offsetY > h - LAYOUT.BOTTOM_MARGIN;
        const oldWidth = this.chart.state.barWidth;
        const maxBarWidth = Math.min(1e3, Math.floor(chartAreaWidth / LAYOUT.MAX_ZOOM_DIVISOR));
        const newWidth = oldWidth * factor;
        if (newWidth < LAYOUT.MIN_BAR_WIDTH || newWidth > maxBarWidth)
          return;
        const mouseIdx = isTimeAxis ? this.chart.dataManager.length - 1 : xToIndex(e.offsetX, this.chart.state);
        const anchorX = isTimeAxis ? indexToX(this.chart.dataManager.length - 1, this.chart.state) : e.offsetX;
        this.chart.state.barWidth = newWidth;
        const zoomStart = 50;
        const weight = Math.max(0, (newWidth - zoomStart) / Math.max(1, maxBarWidth - zoomStart));
        const naturalOffset = anchorX - mouseIdx * newWidth - newWidth / 2;
        const centeredOffset = chartAreaWidth / 2 - mouseIdx * newWidth - newWidth / 2;
        this.chart.state.offsetX = naturalOffset * (1 - weight) + centeredOffset * weight;
        this.chart.state.offsetX = clampOffsetX(this.chart.state.offsetX, this.chart.state.barWidth, this.chart.dataManager.length, w, rightGap, axisWidth);
        this.checkAutoScrollState();
        this.requestRender();
      };
      this.handleMouseDown = (e) => {
        const { w, h, axisWidth } = this.chart.state;
        const chartAreaWidth = w - axisWidth;
        this.isDragging = true;
        this.lastMouseX = e.offsetX;
        this.lastMouseY = e.offsetY;
        if (e.offsetX > chartAreaWidth) {
          this.dragMode = "price";
        } else if (e.offsetY > h - LAYOUT.BOTTOM_MARGIN) {
          this.dragMode = "time";
        } else {
          this.dragMode = "chart";
        }
      };
      this.handleMouseUp = () => {
        this.isDragging = false;
        this.checkAutoScrollState();
      };
      this.handleMouseMove = (e) => {
        const { w, h, rightGap, barWidth, axisWidth } = this.chart.state;
        const chartAreaWidth = w - axisWidth;
        const isOverPrice = e.offsetX > chartAreaWidth;
        const isOverTime = e.offsetY > h - LAYOUT.BOTTOM_MARGIN;
        if (isOverPrice) {
          this.chart.mainCanvas.style.cursor = this.chart.options.behavior.dragPriceScale ? "ns-resize" : "default";
        } else if (isOverTime) {
          this.chart.mainCanvas.style.cursor = this.chart.options.behavior.dragToZoom ? "ew-resize" : "default";
        } else {
          this.chart.mainCanvas.style.cursor = "crosshair";
        }
        if (!this.isDragging)
          return;
        if (this.dragMode === "price") {
          if (!this.chart.options.behavior.dragPriceScale)
            return;
          const deltaY = e.offsetY - this.lastMouseY;
          this.chart.state.priceScale *= 1 + deltaY / LAYOUT.DRAG_SCALE_DIVISOR;
          this.chart.state.priceScale = Math.max(0.1, Math.min(this.chart.state.priceScale, 10));
        } else if (this.dragMode === "time") {
          if (!this.chart.options.behavior.dragToZoom)
            return;
          const deltaX = e.offsetX - this.lastMouseX;
          const factor = Math.pow(LAYOUT.ZOOM_FACTOR_IN, -deltaX / LAYOUT.ZOOM_SENSITIVITY);
          const oldWidth = this.chart.state.barWidth;
          const maxBarWidth = Math.min(1e3, Math.floor(chartAreaWidth / LAYOUT.MAX_ZOOM_DIVISOR));
          const newWidth = oldWidth * factor;
          if (newWidth >= LAYOUT.MIN_BAR_WIDTH && newWidth <= maxBarWidth) {
            const lastIdx = this.chart.dataManager.length - 1;
            const anchorX = indexToX(lastIdx, this.chart.state);
            this.chart.state.barWidth = newWidth;
            const zoomStart = 50;
            const weight = Math.max(0, (newWidth - zoomStart) / Math.max(1, maxBarWidth - zoomStart));
            const naturalOffset = anchorX - lastIdx * newWidth - newWidth / 2;
            const centeredOffset = chartAreaWidth / 2 - lastIdx * newWidth - newWidth / 2;
            this.chart.state.offsetX = naturalOffset * (1 - weight) + centeredOffset * weight;
          }
        } else {
          if (!this.chart.options.behavior.panOnMouseDrag)
            return;
          this.chart.state.offsetX += e.offsetX - this.lastMouseX;
          if (this.chart.state.priceScale !== 1) {
            this.chart.state.priceOffset += e.offsetY - this.lastMouseY;
          }
        }
        this.lastMouseX = e.offsetX;
        this.lastMouseY = e.offsetY;
        this.chart.state.offsetX = clampOffsetX(this.chart.state.offsetX, this.chart.state.barWidth, this.chart.dataManager.length, w, rightGap, axisWidth);
        this.checkAutoScrollState();
        this.requestRender();
      };
      this.handleTouchStart = (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          this.isDragging = true;
          this.lastMouseX = e.touches[0].clientX;
        } else if (e.touches.length === 2) {
          this.isDragging = false;
          this.lastTouchDistance = this.getTouchDistance(e.touches);
        }
      };
      this.handleTouchMove = (e) => {
        e.preventDefault();
        if (this.isDragging && e.touches.length === 1) {
          const touch = e.touches[0];
          this.chart.state.offsetX += touch.clientX - this.lastMouseX;
          this.lastMouseX = touch.clientX;
          this.requestRender();
        } else if (e.touches.length === 2) {
          if (!this.chart.options.behavior.pinchToZoom)
            return;
          const currentDistance = this.getTouchDistance(e.touches);
          const factor = currentDistance / this.lastTouchDistance;
          const { w, axisWidth, rightGap } = this.chart.state;
          const chartAreaWidth = w - axisWidth;
          const maxBarWidth = Math.min(1e3, Math.floor(chartAreaWidth / LAYOUT.MAX_ZOOM_DIVISOR));
          const newWidth = this.chart.state.barWidth * factor;
          if (newWidth >= LAYOUT.MIN_BAR_WIDTH && newWidth <= maxBarWidth) {
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const rect = this.chart.mainCanvas.getBoundingClientRect();
            const screenX = centerX - rect.left;
            const mouseIdx = xToIndex(screenX, this.chart.state);
            const anchorX = screenX;
            this.chart.state.barWidth = newWidth;
            const zoomStart = 50;
            const weight = Math.max(0, (newWidth - zoomStart) / Math.max(1, maxBarWidth - zoomStart));
            const naturalOffset = anchorX - mouseIdx * newWidth - newWidth / 2;
            const centeredOffset = chartAreaWidth / 2 - mouseIdx * newWidth - newWidth / 2;
            this.chart.state.offsetX = naturalOffset * (1 - weight) + centeredOffset * weight;
            this.chart.state.offsetX = clampOffsetX(this.chart.state.offsetX, this.chart.state.barWidth, this.chart.dataManager.length, w, rightGap, axisWidth);
            this.lastTouchDistance = currentDistance;
            this.requestRender();
          }
        }
      };
      this.handleTouchEnd = (e) => {
        e.preventDefault();
        if (e.touches.length === 0)
          this.isDragging = false;
      };
      this.chart = chart;
      this.setupEventListeners();
    }
    /**
     * Request a throttled render using RAF
     */
    requestRender() {
      if (this.rafId !== null)
        return;
      this.rafId = requestAnimationFrame(() => {
        this.chart.render();
        this.rafId = null;
      });
    }
    /**
     * Set up all event listeners
     */
    setupEventListeners() {
      const mainCanvas = this.chart.mainCanvas;
      mainCanvas.addEventListener("wheel", this.handleWheel);
      mainCanvas.addEventListener("mousedown", this.handleMouseDown);
      mainCanvas.addEventListener("dblclick", this.handleDblClick);
      window.addEventListener("mouseup", this.handleMouseUp);
      window.addEventListener("mousemove", this.handleMouseMove);
      mainCanvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
      mainCanvas.addEventListener("touchmove", this.handleTouchMove, { passive: false });
      mainCanvas.addEventListener("touchend", this.handleTouchEnd, { passive: false });
    }
    getTouchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    checkAutoScrollState() {
      const { w, barWidth, axisWidth } = this.chart.state;
      const dataLength = this.chart.dataManager.length;
      const firstVisibleIdx = deriveVisibleStartIdx(this.chart.state, dataLength);
      const barsVisible = Math.ceil((w - axisWidth) / barWidth);
      const atRightEdge = firstVisibleIdx + barsVisible >= dataLength - 8;
      const wasAutoScrolling = this.autoScrollEnabled;
      this.autoScrollEnabled = atRightEdge;
      if (wasAutoScrolling !== this.autoScrollEnabled) {
        this.chart.onScrollLockChange?.(!this.autoScrollEnabled);
      }
    }
    isAutoScrolling() {
      return this.autoScrollEnabled;
    }
    scrollToLatest() {
      const { w, barWidth, rightGap, axisWidth } = this.chart.state;
      if (this.chart.dataManager.length === 0)
        return;
      this.chart.state.offsetX = calculateRightEdgeOffset(this.chart.dataManager.length, barWidth, w, rightGap, axisWidth);
      this.autoScrollEnabled = true;
      this.chart.render();
    }
    destroy() {
      const mainCanvas = this.chart.mainCanvas;
      mainCanvas.removeEventListener("wheel", this.handleWheel);
      mainCanvas.removeEventListener("mousedown", this.handleMouseDown);
      window.removeEventListener("mouseup", this.handleMouseUp);
      window.removeEventListener("mousemove", this.handleMouseMove);
      mainCanvas.removeEventListener("touchstart", this.handleTouchStart);
      mainCanvas.removeEventListener("touchmove", this.handleTouchMove);
      mainCanvas.removeEventListener("touchend", this.handleTouchEnd);
    }
  };

  // src/utils/merge.ts
  function deepMerge(target, source) {
    if (!source)
      return target;
    if (!target)
      return deepClone(source);
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach((key) => {
        const sourceVal = source[key];
        const targetVal = target[key];
        if (isObject(sourceVal)) {
          if (!(key in target)) {
            output[key] = deepClone(sourceVal);
          } else {
            output[key] = deepMerge(targetVal, sourceVal);
          }
        } else {
          output[key] = sourceVal;
        }
      });
    }
    return output;
  }
  function deepClone(obj) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => deepClone(item));
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    const clonedObj = {};
    Object.keys(obj).forEach((key) => {
      clonedObj[key] = deepClone(obj[key]);
    });
    return clonedObj;
  }
  function isObject(item) {
    return item !== null && typeof item === "object" && !Array.isArray(item);
  }

  // src/utils/formatter.ts
  var PriceFormatter = class {
    constructor(format) {
      this.lastMeasurement = null;
      this.format = format || { type: "price" };
    }
    /**
     * Format a price value to a string
     */
    formatPrice(price) {
      if (isNaN(price) || !isFinite(price))
        return "0.00";
      if (this.format.type === "custom" && this.format.formatter) {
        return this.format.formatter(price);
      }
      if (this.format.type === "volume") {
        return this.formatVolume(price);
      }
      if (this.format.type === "percent") {
        return price.toFixed(2) + "%";
      }
      const precision = this.getPrecision();
      return price.toFixed(precision);
    }
    /**
     * Determine decimal precision based on options or auto-detection
     */
    getPrecision() {
      if (this.format.precision !== void 0) {
        return this.format.precision;
      }
      if (this.format.minMove !== void 0) {
        return this.getPrecisionFromMinMove(this.format.minMove);
      }
      return 2;
    }
    /**
     * Auto-detect required width for the price axis
     * Measures a 'worst case' price string using the current font
     */
    measureRequiredWidth(ctx, minPrice, maxPrice) {
      if (isNaN(minPrice) || isNaN(maxPrice))
        return 60;
      if (this.lastMeasurement) {
        const rangeChanged = Math.abs(minPrice - this.lastMeasurement.min) > minPrice * 0.05 || Math.abs(maxPrice - this.lastMeasurement.max) > maxPrice * 0.05;
        if (!rangeChanged) {
          return this.lastMeasurement.width;
        }
      }
      const longPrice = Math.max(Math.abs(minPrice), Math.abs(maxPrice));
      const testString = this.formatPrice(longPrice);
      const metrics = ctx.measureText(testString);
      const padding = 20;
      const width = Math.ceil((metrics.width + padding) / 5) * 5;
      this.lastMeasurement = { min: minPrice, max: maxPrice, width };
      return width;
    }
    getPrecisionFromMinMove(minMove) {
      const s = minMove.toString();
      if (s.indexOf(".") === -1)
        return 0;
      return s.split(".")[1].length;
    }
    formatVolume(price) {
      if (price >= 1e6)
        return (price / 1e6).toFixed(2) + "M";
      if (price >= 1e3)
        return (price / 1e3).toFixed(2) + "K";
      return price.toFixed(0);
    }
  };

  // src/core/chart.ts
  var DEFAULT_OPTIONS = {
    layout: {
      width: "auto",
      height: "auto",
      background: "#1a1a1a",
      textColor: "#aaaaaa",
      fontSize: 12,
      fontFamily: "system-ui",
      padding: { top: 10, right: 10, bottom: 10, left: 10 }
    },
    grid: {
      show: true,
      vertLines: { color: "#2a2a2a", style: "solid", width: 1 },
      horzLines: { color: "#2a2a2a", style: "solid", width: 1 }
    },
    priceScale: {
      mode: "linear",
      scaleMargins: { top: 0.1, bottom: 0.1 },
      alignLabels: true,
      minVisibleBars: 2,
      currentPrice: {
        showCountdown: true,
        countdownColor: "rgba(255, 255, 255, 0.8)"
      }
    },
    timeScale: {
      borderColor: "#2a2a2a",
      visible: true,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 80,
      barSpacing: 11,
      minBarSpacing: 4,
      maxBarSpacing: 1e3
    },
    crosshair: {
      mode: "magnet",
      showLabels: true,
      showTooltip: true,
      vertLine: { color: "#555555", width: 1, style: "dashed" },
      horzLine: { color: "#555555", width: 1, style: "dashed" }
    },
    behavior: {
      dragToZoom: true,
      scrollToZoom: true,
      pinchToZoom: true,
      panOnMouseDrag: true,
      dragPriceScale: true
    },
    data: {
      maxBars: 5e3,
      autoCleanup: true
    },
    colors: {
      background: "#1a1a1a",
      grid: "#2a2a2a",
      up: "#22c55e",
      down: "#ef4444",
      text: "#aaaaaa",
      crosshair: "#555555"
    },
    width: "auto",
    height: "auto",
    timeframe: 60,
    rightGap: 80,
    autoScroll: true,
    baseBarWidth: 11
  };
  var Chart = class {
    constructor(container, options = {}) {
      // Real-time Countdown management
      this.countdownRafId = null;
      this.lastCountdownUpdate = 0;
      if (!container)
        throw new Error("KybosCore: Container element is required");
      this.container = typeof container === "string" ? document.querySelector(container) : container;
      if (!this.container) {
        throw new Error(`KybosCore: Container "${container}" not found`);
      }
      this.options = this.normalizeOptions(options);
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
        priceScale: 1,
        priceOffset: 0,
        priceScaleMode: this.options.priceScale.mode,
        axisWidth: LAYOUT.RIGHT_GAP
      };
      this.dataManager = new DataManager(this.options.data.maxBars);
      this.priceFormatter = new PriceFormatter(this.options.priceScale.priceFormat);
      this.renderer = new Renderer(this);
      this.initCanvases();
      this.crosshair = new Crosshair(this);
      this.eventManager = new EventManager(this);
      this.startCountdownTimer();
      this.handleResizeBound = this.resize.bind(this);
      window.addEventListener("resize", this.handleResizeBound);
      this.resize();
    }
    initCanvases() {
      this.bgCanvas = document.createElement("canvas");
      this.mainCanvas = document.createElement("canvas");
      [this.bgCanvas, this.mainCanvas].forEach((canvas) => {
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.display = "block";
      });
      this.bgCtx = this.bgCanvas.getContext("2d", { alpha: false });
      this.mainCtx = this.mainCanvas.getContext("2d", { alpha: true });
      this.container.appendChild(this.bgCanvas);
      this.container.appendChild(this.mainCanvas);
    }
    resize(width, height) {
      const containerW = typeof this.options.layout.width === "number" ? this.options.layout.width : this.container.clientWidth;
      const containerH = typeof this.options.layout.height === "number" ? this.options.layout.height : this.container.clientHeight;
      this.state.w = width ?? containerW;
      this.state.h = height ?? containerH;
      [this.bgCanvas, this.mainCanvas].forEach((canvas) => {
        canvas.width = this.state.w * this.state.devicePixelRatio;
        canvas.height = this.state.h * this.state.devicePixelRatio;
        canvas.style.width = this.state.w + "px";
        canvas.style.height = this.state.h + "px";
      });
      this.bgCtx.scale(this.state.devicePixelRatio, this.state.devicePixelRatio);
      this.mainCtx.scale(this.state.devicePixelRatio, this.state.devicePixelRatio);
      this.mainCtx.imageSmoothingEnabled = false;
      this.renderer.createBuffer();
      this.crosshair.resize(this.state.w, this.state.h, this.state.devicePixelRatio);
      this.render();
    }
    updatePriceScale() {
      if (this.dataManager.isEmpty)
        return false;
      const { h, w, barWidth, priceScale } = this.state;
      const firstVisibleIdx = deriveVisibleStartIdx(this.state, this.dataManager.length);
      const visibleEnd = Math.min(
        firstVisibleIdx + Math.ceil((w - this.state.axisWidth) / barWidth) + 5,
        this.dataManager.length
      );
      const range = this.dataManager.getPriceRange(firstVisibleIdx, visibleEnd - firstVisibleIdx);
      const mid = (range.max + range.min) / 2;
      const halfRange = (range.max - range.min) / 2 * priceScale;
      this.state.priceMin = mid - halfRange;
      this.state.priceMax = mid + halfRange;
      const requiredWidth = this.priceFormatter.measureRequiredWidth(this.bgCtx, this.state.priceMin, this.state.priceMax);
      const currentWidth = this.state.axisWidth;
      if (requiredWidth > currentWidth || currentWidth - requiredWidth > 20) {
        this.state.axisWidth = Math.max(LAYOUT.RIGHT_GAP, requiredWidth);
        return true;
      }
      return false;
    }
    ensureRightGapAndRoll() {
      if (!this.options.behavior.autoScroll || !this.isAutoScrolling())
        return;
      const { barWidth, axisWidth, w, rightGap } = this.state;
      if (this.dataManager.length === 0)
        return;
      this.state.offsetX -= barWidth;
      this.state.offsetX = clampOffsetX(this.state.offsetX, barWidth, this.dataManager.length, w, rightGap, axisWidth);
    }
    render() {
      this.state.data = this.dataManager.data;
      const layoutChanged = this.updatePriceScale();
      if (layoutChanged) {
        this.renderer.createBuffer();
      }
      this.renderer.renderCandles();
      this.renderer.drawBackground(this.bgCtx, true);
      this.renderer.drawViewport(this.mainCtx);
      this.crosshair.draw();
    }
    setData(bars) {
      if (!Array.isArray(bars))
        throw new Error("KybosCore: Data must be an array");
      if (bars.length > 0) {
        this.validateBar(bars[0]);
        if (bars.length > 1)
          this.validateBar(bars[bars.length - 1]);
      }
      this.dataManager.setData(bars);
      if (this.dataManager.length === 0)
        return;
      this.state.offsetX = calculateRightEdgeOffset(this.dataManager.length, this.state.barWidth, this.state.w, this.state.rightGap, this.state.axisWidth);
      this.render();
    }
    appendBar(bar) {
      this.validateBar(bar);
      this.dataManager.appendBar(bar);
      this.ensureRightGapAndRoll();
      this.render();
    }
    updateLastBar(bar) {
      const previousLength = this.dataManager.length;
      this.validateBar(bar);
      this.dataManager.updateLastBar(bar);
      if (this.dataManager.length > previousLength) {
        this.ensureRightGapAndRoll();
      }
      this.render();
    }
    /**
     * Internal validation for Bar structure
     */
    validateBar(bar) {
      if (!bar)
        throw new Error("KybosCore: Bar data is null or undefined");
      const fields = ["time", "open", "high", "low", "close"];
      for (const field of fields) {
        if (typeof bar[field] !== "number" || isNaN(bar[field])) {
          throw new Error(`KybosCore: Invalid bar data. Field "${field}" must be a valid number.`);
        }
      }
    }
    getContext() {
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
        viewport: {
          width: w,
          height: h,
          rightGap,
          visibleRange: { fromIndex: startIdx, toIndex: endIdx, fromTime: data[startIdx]?.time, toTime: data[endIdx]?.time },
          priceRange: { min: priceMin, max: priceMax },
          scales: { pricePerPixel, timePerBar, barWidth }
        },
        state: { totalBars: data.length, isAutoScrolling: this.isAutoScrolling() },
        visibleBars,
        latestBar: data[data.length - 1]
      };
    }
    setOptions(partialOptions) {
      const normalizedPartial = this.normalizePartialOptions(partialOptions);
      this.options = deepMerge(this.options, normalizedPartial);
      if (normalizedPartial.timeScale) {
        if (normalizedPartial.timeScale.barSpacing !== void 0) {
          this.state.barWidth = this.options.timeScale.barSpacing;
          this.renderer.createBuffer();
        }
        if (normalizedPartial.timeScale.rightOffset !== void 0) {
          this.state.rightGap = this.options.timeScale.rightOffset;
        }
      }
      if (normalizedPartial.priceScale) {
        if (normalizedPartial.priceScale.mode !== void 0) {
          this.state.priceScaleMode = normalizedPartial.priceScale.mode;
        }
        if (normalizedPartial.priceScale.priceFormat !== void 0) {
          this.priceFormatter = new PriceFormatter(this.options.priceScale.priceFormat);
        }
        if (normalizedPartial.priceScale.currentPrice !== void 0) {
          this.restartCountdownTimer();
        }
      }
      if (normalizedPartial.layout && (normalizedPartial.layout.width || normalizedPartial.layout.height)) {
        this.resize();
      } else {
        this.render();
      }
    }
    normalizePartialOptions(options) {
      const normalized = deepClone(options);
      if (options.colors) {
        normalized.layout = normalized.layout || {};
        normalized.grid = normalized.grid || { vertLines: {}, horzLines: {} };
        if (options.colors.background)
          normalized.layout.background = options.colors.background;
        if (options.colors.text)
          normalized.layout.textColor = options.colors.text;
        if (options.colors.grid) {
          normalized.grid.vertLines = normalized.grid.vertLines || {};
          normalized.grid.horzLines = normalized.grid.horzLines || {};
          normalized.grid.vertLines.color = options.colors.grid;
          normalized.grid.horzLines.color = options.colors.grid;
        }
      }
      if (options.width) {
        normalized.layout = normalized.layout || {};
        normalized.layout.width = options.width;
      }
      if (options.height) {
        normalized.layout = normalized.layout || {};
        normalized.layout.height = options.height;
      }
      if (options.rightGap !== void 0) {
        normalized.timeScale = normalized.timeScale || {};
        normalized.timeScale.rightOffset = options.rightGap;
      }
      if (options.baseBarWidth !== void 0) {
        normalized.timeScale = normalized.timeScale || {};
        normalized.timeScale.barSpacing = options.baseBarWidth;
      }
      return normalized;
    }
    normalizeOptions(options) {
      return deepMerge(deepClone(DEFAULT_OPTIONS), this.normalizePartialOptions(options));
    }
    getOptions() {
      return deepClone(this.options);
    }
    resetOptions() {
      this.options = deepClone(DEFAULT_OPTIONS);
      this.render();
    }
    /**
     * Start the real-time countdown timer loop
     */
    startCountdownTimer() {
      if (!this.options.priceScale.currentPrice?.showCountdown)
        return;
      const updateCountdown = () => {
        const now = Date.now();
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
    stopCountdownTimer() {
      if (this.countdownRafId !== null) {
        cancelAnimationFrame(this.countdownRafId);
        this.countdownRafId = null;
      }
    }
    restartCountdownTimer() {
      this.stopCountdownTimer();
      this.startCountdownTimer();
    }
    destroy() {
      this.stopCountdownTimer();
      window.removeEventListener("resize", this.handleResizeBound);
      this.eventManager.destroy();
      this.bgCanvas.remove();
      this.mainCanvas.remove();
      this.crosshair.destroy();
      this.renderer.destroy();
    }
    isAutoScrolling() {
      return this.eventManager.isAutoScrolling();
    }
    scrollToLatest() {
      this.eventManager.scrollToLatest();
    }
  };

  // src/index.ts
  function createChart(container, options) {
    return new Chart(container, options);
  }
  return __toCommonJS(src_exports);
})();
