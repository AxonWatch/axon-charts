import { SubPane } from './SubPane.js';
import { IChart, Bar } from '../types/index.js';
import type { ChartState } from '../utils/projection.js';
import { LAYOUT } from '../core/layout.js';
import { deriveVisibleStartIdx, indexToX } from '../utils/projection.js';
import { calculateTimeStep } from '../utils/math.js';

/**
 * Abstract base for sub-panes that have their own independent Y-axis scale.
 *
 * Provides ready-to-use:
 * - Zoom/pan/dblclick/reset interaction (handleWheel, handleDrag, handleDblClick)
 * - Draggable separator (handleSeparatorDrag)
 * - Background fill, separator line, vertical/horizontal grids
 * - Axis labels with configurable precision detection
 * - Tooltip with label:value format
 * - Current value horizontal line + axis label
 * - LLM context exposure via getContextData()
 *
 * Concrete subclasses only implement:
 *   getOptions()     – which options block (chart.options.volume, etc.)
 *   renderContent()  – the actual visualization (bars, lines, etc.)
 *   formatValue()    – text formatting (e.g. "1.5K" or "42.5")
 *   getLatestValue() – current value for the horizontal reference line
 *   getMaxVisible()  – visible range max for Y-axis scaling
 *   getMinVisible()  – (optional, default 0) visible range min, override for negative-value indicators
 *   computeValues()  – (optional) compute once per render, cache in paneState.computedValues
 *   getTooltipColor(bar) – color for tooltip value text
 *   getTooltipLabel() – e.g. "Volume:" or "RSI:"
 */
export abstract class ScalePane implements SubPane {
  readonly separatorThreshold = 6;

  /** Set by events.ts on mousemove — changes separator highlight color */
  separatorHovered: boolean = false; // pixels for separator hit-testing

  // Internal scale state (zoom/pan + computed values cache)
  protected paneState = {
    scale: 1.0,
    offset: 0,
    detectedPrecision: null as number | null,
    lastDataLength: -1,
    /** Cached computed values from computeValues(). Reset on every render. */
    computedValues: null as number[] | null
  };

  /** External data injected by plugins (takes priority over computeValues) */
  protected externalValues: number[] | null = null;

  /**
   * Inject pre-computed values from external source (e.g., Web Worker plugin).
   * When set, computeValues() is not called — externalValues are used directly.
   */
  setData(values: number[]): void {
    this.externalValues = values;
  }

  /**
   * Compute indicator values for all bars. Called once per render() before renderContent().
   * Returns externalValues if set via setData(), otherwise runs internal computation.
   */
  protected computeValues(chart: IChart): number[] | null {
    if (this.externalValues) return this.externalValues;
    return null;
  }

  constructor(protected chart: IChart) {}

  // ── Abstract methods (must implement) ──────────────────────

  /** Unique identifier (e.g. 'volume', 'rsi') */
  abstract readonly id: string;
  /** Human-readable label (e.g. 'Volume', 'RSI') */
  abstract readonly label: string;
  /** Return the options sub-object (e.g. chart.options.volume) */
  abstract getOptions(): Record<string, any>;
  /** Draw the actual content (bars, lines, etc.) */
  abstract renderContent(
    ctx: CanvasRenderingContext2D,
    chart: IChart,
    subPaneTop: number,
    subPaneHeight: number,
    firstVisibleIdx: number,
    endIdx: number,
    visibleMin: number,
    visibleRange: number,
    areaHeight: number,
    areaTop: number
  ): void;
  /** Current value for the horizontal reference line */
  abstract getLatestValue(chart: IChart): number | null;
  /** Visible range max for Y-axis scaling */
  abstract getMaxVisible(chart: IChart): number;
  /** Visible range min for Y-axis scaling (default 0). Override for oscillators with negative values like MACD. */
  getMinVisible(chart: IChart): number { return 0; }
  /** Color for the tooltip value text (depends on bar direction) */
  abstract getTooltipColor(bar: Bar): string;
  /** Tooltip label prefix (e.g. "Volume:" or "RSI:") */
  abstract getTooltipLabel(): string;
  /** Value to display in tooltip (e.g. bar.volume or computed RSI) */
  abstract getTooltipValue(bar: Bar): number | null;

  // ── Shared implementations ─────────────────────────────────

  computeHeight(state: ChartState, options: any): number {
    if (!options?.show) return 0;
    const heightPercent = Math.max(0.05, Math.min(0.5, options.heightPercent ?? 0.2));
    return Math.round(state.h * heightPercent);
  }

  render(ctx: CanvasRenderingContext2D, chart: IChart, subPaneTop: number): void {
    const { w, h, data, barWidth, axisWidth } = chart.state;
    const subPaneHeight = this.computeHeight(chart.state, this.getOptions());
    const options = this.getOptions();

    if (!options?.show || subPaneHeight <= 0) return;
    if (data.length === 0) return;

    // Invalidate precision cache when data changes
    if (data.length !== this.paneState.lastDataLength) {
      this.paneState.detectedPrecision = null;
      this.paneState.lastDataLength = data.length;
    }

    const chartAreaWidth = w - axisWidth;

    // Fill sub-pane background (only axis area — chart area keeps grid lines visible)
    ctx.fillStyle = chart.options.layout.background ?? '#1e1e1e';
    ctx.fillRect(w - axisWidth, subPaneTop, axisWidth, subPaneHeight);

    // Separator line (full width including axis column)
    ctx.strokeStyle = this.separatorHovered ? '#4a9eff' : '#555';
    ctx.lineWidth = this.separatorHovered ? 2 : 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, subPaneTop);
    ctx.lineTo(w, subPaneTop);
    ctx.stroke();

    // Indicator label at the top-left of the sub-pane
    // e.g. "RSI(14)  56.7" — uses the tooltip label (minus colon) +
    // the current (latest) value for at-a-glance reading.
    if (options.show !== false && this.getTooltipLabel) {
      const labelText = this.getTooltipLabel().replace(/:$/, '');
      const latest = this.getLatestValue(chart);
      const displayText = (latest != null && !isNaN(latest))
        ? `${labelText}  ${this.formatValue(latest)}`
        : labelText;
      ctx.font = `${chart.options.layout.fontSize ?? 12}px ${chart.options.layout.fontFamily ?? 'system-ui'}`;
      ctx.fillStyle = chart.options.layout.textColor ?? '#aaa';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(displayText, 8, subPaneTop + 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Vertical axis border (matching main chart's axis border style)
    if (chart.options.layout.borderVisible !== false) {
      const borderColor = chart.options.layout.textColor ?? '#aaa';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(chartAreaWidth + 0.5, subPaneTop);
      ctx.lineTo(chartAreaWidth + 0.5, subPaneTop + subPaneHeight);
      ctx.stroke();
    }

    // Re-draw vertical grid lines through sub-pane — time-anchored, full width
    // Same time-boundary logic as the main chart grid for consistent alignment.
    const vertOpts = chart.options.grid.vertLines || {};
    if (chart.options.grid.show && vertOpts.show !== false) {
      ctx.strokeStyle = vertOpts.color ?? '#2a2a2a';
      ctx.lineWidth = vertOpts.width ?? 1;
      ctx.setLineDash([]);
      const step = Math.max(1, calculateTimeStep(barWidth) || 1);
      const interval = data.length > 1 ? data[1].time - data[0].time : 60000;
      const stepMs = step * interval;
      const firstGridIdx = Math.ceil((-chart.state.offsetX - 100) / barWidth);
      const lastGridIdx = Math.floor((chartAreaWidth - chart.state.offsetX + 100) / barWidth);
      const firstVirtualTime = data[0].time + (firstGridIdx * interval);
      const lastVirtualTime = data[0].time + (lastGridIdx * interval);
      const firstBoundary = Math.ceil(firstVirtualTime / stepMs) * stepMs;
      for (let t = firstBoundary; t <= lastVirtualTime; t += stepMs) {
        const virtualIndex = (t - data[0].time) / interval;
        const x = indexToX(virtualIndex, chart.state);
        if (x < -100 || x > chartAreaWidth + 100) continue;
        if (x >= 0 && x <= chartAreaWidth) {
          ctx.beginPath();
          ctx.moveTo(x, subPaneTop);
          ctx.lineTo(x, subPaneTop + subPaneHeight);
          ctx.stroke();
        }
      }
    }

    // Draw horizontal grid lines inside sub-pane
    const horzOpts = chart.options.grid.horzLines || {};
    if (chart.options.grid.show && horzOpts.show !== false) {
      ctx.strokeStyle = horzOpts.color ?? '#2a2a2a';
      ctx.lineWidth = horzOpts.width ?? 1;
      ctx.setLineDash([]);
      for (let row = 1; row <= 3; row++) {
        const gy = subPaneTop + (subPaneHeight / 4) * row;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(chartAreaWidth, gy);
        ctx.stroke();
      }
    }

    // Find visible range
    const firstVisibleIdx = deriveVisibleStartIdx(chart.state, data.length);
    const barsVisible = Math.ceil(chartAreaWidth / barWidth) + 2;
    const endIdx = Math.min(firstVisibleIdx + barsVisible, data.length);

    const maxVal = this.getMaxVisible(chart);
    const visibleMax = maxVal / this.paneState.scale;
    const visibleMin = this.getMinVisible(chart) + this.paneState.offset;
    const visibleRange = Math.max(1, visibleMax - visibleMin);

    // Compute indicator values once per render (cached in paneState.computedValues)
    this.paneState.computedValues = this.computeValues(chart);

    // Top gap for visual comfort
    const topGap = Math.max(12, Math.round(subPaneHeight * 0.12));
    const bottomGap = Math.max(4, Math.round(subPaneHeight * 0.04));
    const areaHeight = subPaneHeight - topGap - bottomGap;
    const areaTop = subPaneTop + topGap;

    // Draw the concrete content
    this.renderContent(ctx, chart, subPaneTop, subPaneHeight, firstVisibleIdx, endIdx, visibleMin, visibleRange, areaHeight, areaTop);

    // Draw axis labels (aligned with content area bounds)
    ctx.fillStyle = chart.options.layout.textColor || '#aaa';
    ctx.font = chart.options.layout.fontSize + 'px ' + chart.options.layout.fontFamily;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const labelPadding = LAYOUT.LABEL_OFFSET;
    const ticks = [
      { ratio: 1.0, label: this.formatValue(visibleMin + visibleRange) },
      { ratio: 0.75, label: this.formatValue(visibleMin + visibleRange * 0.75) },
      { ratio: 0.5,  label: this.formatValue(visibleMin + visibleRange * 0.5) },
      { ratio: 0.25, label: this.formatValue(visibleMin + visibleRange * 0.25) },
      { ratio: 0,    label: this.formatValue(visibleMin) }
    ];
    for (const tick of ticks) {
      const tickY = areaTop + (areaHeight * (1 - tick.ratio));
      ctx.fillText(tick.label, w - labelPadding, tickY);
    }
    ctx.textAlign = 'left';

    // Current value horizontal line and axis label (synced with main chart currentPrice.show/showLine)
    const showPriceLine = chart.options.priceScale.currentPrice?.show !== false;
    const showPriceLineOnly = chart.options.priceScale.currentPrice?.showLine !== false;
    const latestVal = this.getLatestValue(chart);
    if (latestVal != null && showPriceLine) {
      const curRatio = Math.max(0, Math.min(1, (latestVal - visibleMin) / visibleRange));
      const curY = areaTop + (areaHeight - curRatio * areaHeight);

      if (showPriceLineOnly) {
        ctx.strokeStyle = chart.options.layout.textColor || '#aaa';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(w, curY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = chart.options.layout.background ?? '#1e1e1e';
      ctx.fillRect(w - axisWidth, curY - 10, axisWidth, 20);
      ctx.strokeStyle = chart.options.layout.textColor || '#aaa';
      ctx.lineWidth = 1;
      ctx.strokeRect(w - axisWidth, curY - 10, axisWidth, 20);

      ctx.fillStyle = chart.options.layout.textColor || '#aaa';
      ctx.font = (chart.options.layout.fontSize ?? 12) + 'px ' + (chart.options.layout.fontFamily ?? 'system-ui');
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.formatValue(latestVal), w - LAYOUT.LABEL_OFFSET, curY);
      ctx.textAlign = 'left';
    }
  }

  renderTooltip(ctx: CanvasRenderingContext2D, chart: IChart, bar: Bar, subPaneTop: number, tooltipY: number): void {
    if (!this.getOptions()?.show) return;

    const color = this.getTooltipColor(bar);
    const label = this.getTooltipLabel();
    const rawValue = this.getTooltipValue(bar);
    const value = rawValue != null ? this.formatValue(rawValue) : '—';
    const text = `${label} ${value}`;

    ctx.font = chart.options.layout.fontSize + 'px ' + chart.options.layout.fontFamily;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';

    // Draw on the right side of the sub-pane (near the axis) to avoid
    // overlapping the indicator name label on the left
    const x = chart.state.w - chart.state.axisWidth - 8;
    ctx.fillStyle = chart.options.layout.textColor || '#aaa';
    ctx.fillText(text, x, tooltipY);
    ctx.textAlign = 'left';
  }

  renderAxisLabel(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, mouseY: number, subPaneTop: number, axisX: number): void {
    const { data, axisWidth, w } = chart.state;
    const subPaneHeight = this.computeHeight(chart.state, this.getOptions());

    const maxVal = this.getMaxVisible(chart);
    const visibleMax = maxVal / this.paneState.scale;
    const visibleMin = this.getMinVisible(chart) + this.paneState.offset;
    const visibleRange = Math.max(1, visibleMax - visibleMin);

    const topGap = Math.max(12, Math.round(subPaneHeight * 0.12));
    const bottomGap = Math.max(4, Math.round(subPaneHeight * 0.04));
    const areaHeight = subPaneHeight - topGap - bottomGap;
    const areaTop = subPaneTop + topGap;

    const ratio = 1 - (mouseY - areaTop) / areaHeight;
    const valueAtY = Math.max(0, Math.min(1, ratio)) * visibleRange + visibleMin;

    const labelHeight = 20;
    ctx.fillStyle = chart.options.layout.background ?? '#1e1e1e';
    ctx.fillRect(w - axisWidth, mouseY - labelHeight / 2, axisWidth, labelHeight);
    ctx.strokeStyle = chart.options.layout.textColor ?? '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(w - axisWidth, mouseY - labelHeight / 2, axisWidth, labelHeight);
    ctx.fillStyle = chart.options.layout.textColor ?? '#888';
    ctx.font = (chart.options.layout.fontSize ?? 12) + 'px ' + (chart.options.layout.fontFamily ?? 'system-ui');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.formatValue(valueAtY), w - LAYOUT.LABEL_OFFSET, mouseY);
  }

  protected formatValue(value: number): string {
    const precision = this.resolvePrecision();
    const abs = Math.abs(value);
    if (abs >= 1000000) return (value / 1000000).toFixed(precision) + 'M';
    if (abs >= 1000) return (value / 1000).toFixed(precision) + 'K';
    return value.toFixed(precision);
  }

  private resolvePrecision(): number {
    const options = this.getOptions();

    // 1. Explicit precision
    if (options?.precision !== null && options?.precision !== undefined) {
      return options.precision;
    }
    // 2. Derive from minMove
    if (options?.minMove != null && options.minMove > 0) {
      const minMoveStr = options.minMove.toString();
      const decimalIdx = minMoveStr.indexOf('.');
      if (decimalIdx !== -1) return minMoveStr.length - decimalIdx - 1;
      return 0;
    }
    // 3. Auto-detect from data (cached)
    if (this.paneState.detectedPrecision === null) {
      this.paneState.detectedPrecision = this.detectPrecisionFromData();
    }
    return this.paneState.detectedPrecision ?? 2;
  }

  private detectPrecisionFromData(): number | null {
    const { data } = this.chart.state;
    if (data.length === 0) return 2;
    let maxDecimals = 0;
    const sampleSize = Math.min(100, data.length);
    for (let i = 0; i < sampleSize; i++) {
      const bar = data[i];
      const val = this.getValueAtBar(bar);
      if (val != null) {
        const str = val.toString();
        const idx = str.indexOf('.');
        if (idx !== -1) maxDecimals = Math.max(maxDecimals, str.length - idx - 1);
      }
    }
    return maxDecimals > 0 ? maxDecimals : 2;
  }

  /**
   * Extract the pane's value from a bar.
   * Override if the value isn't bar.volume (e.g. RSI computes from bar).
   */
  protected getValueAtBar(bar: Bar): number | undefined {
    return this.getTooltipValue(bar) ?? undefined;
  }

  getContextData(): Record<string, any> {
    const opts = this.getOptions();
    return {
      show: opts?.show ?? false,
      heightPercent: opts?.heightPercent ?? 0.2,
      scale: this.paneState.scale,
      offset: this.paneState.offset
    };
  }

  handleWheel(chart: IChart, deltaY: number): boolean {
    this.paneState.scale *= (deltaY > 0 ? 0.87 : 1.15);
    this.paneState.scale = Math.max(1.0, Math.min(this.paneState.scale, 10));
    return true;
  }

  handleDrag(chart: IChart, deltaY: number): void {
    this.paneState.scale *= (1 - deltaY / (200 * 5));
    this.paneState.scale = Math.max(1.0, Math.min(this.paneState.scale, 10));
  }

  handleDblClick(chart: IChart): void {
    this.paneState.scale = 1.0;
    this.paneState.offset = 0;
  }

  handleSeparatorDrag(chart: IChart, deltaY: number, totalHeight: number): void {
    const opts = this.getOptions();
    if (!opts) return;
    const hPct = (opts.heightPercent ?? 0.2) - (deltaY / totalHeight);
    opts.heightPercent = Math.max(0.05, Math.min(0.5, hPct));
  }
}