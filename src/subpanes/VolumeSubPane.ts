import { SubPane } from './SubPane.js';
import { IChart, ChartState, Bar } from '../types/index.js';
import { LAYOUT } from '../core/layout.js';
import { indexToX, deriveVisibleStartIdx } from '../utils/projection.js';
import { calculateTimeStep } from '../utils/math.js';

/**
 * Volume bar sub-pane implementation
 */
export class VolumeSubPane implements SubPane {
  readonly id = 'volume';
  readonly label = 'Volume';
  readonly separatorThreshold = 6; // pixels for separator hit-testing

  // Private state (moved from chart.state)
  private state = {
    scale: 1.0,
    offset: 0
  };

  constructor(private chart: IChart) {}

  getOptions() {
    return this.chart.options.volume || {};
  }

  computeHeight(state: ChartState, options: any): number {
    if (!options?.show) return 0;
    const heightPercent = Math.max(0.05, Math.min(0.5, options.heightPercent ?? 0.2));
    return Math.round(state.h * heightPercent);
  }

  render(ctx: CanvasRenderingContext2D, chart: IChart, subPaneTop: number): void {
    const { w, h, data, barWidth, axisWidth, bottomMargin } = chart.state;
    const subPaneHeight = this.computeHeight(chart.state, this.getOptions());
    const options = this.getOptions();

    if (!options?.show || subPaneHeight <= 0) return;
    if (data.length === 0) return;

    const chartAreaWidth = w - axisWidth;
    const volUpColor = options.upColor || '#22c55e';
    const volDownColor = options.downColor || '#ef4444';

    // Fill sub-pane background (only axis area — chart area keeps grid lines visible)
    ctx.fillStyle = chart.options.layout.background;
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
    const vertOpts = chart.options.grid.vertLines || {};
    const drawVertLines = chart.options.grid.show && vertOpts.show !== false;
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
      const leftIdx = Math.max(0, Math.floor(-chart.state.offsetX / barWidth));
      const leftTime = refTime + (leftIdx - refIdx) * interval;
      const startSnapped = Math.floor(leftTime / stepTime) * stepTime;
      for (let t = startSnapped; t < refTime + stepTime; t += stepTime) {
        const virtualIdx = refIdx + (t - refTime) / interval;
        const x = indexToX(virtualIdx, chart.state);
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
    const horzOpts = chart.options.grid.horzLines || {};
    if (chart.options.grid.show && horzOpts.show !== false) {
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
    const firstVisibleIdx = deriveVisibleStartIdx(chart.state, data.length);
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

      const centerX = indexToX(i, chart.state);
      const candleWidth = Math.floor(barWidth * LAYOUT.CANDLE_GAP_RATIO);
      const x = centerX - candleWidth / 2;

      if (x + candleWidth < 0 || x > chartAreaWidth) continue;

      const volScale = this.state.scale;
      const volOffset = this.state.offset;
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
    const volScale = this.state.scale;
    const volOffset = this.state.offset;
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

  renderTooltip(ctx: CanvasRenderingContext2D, chart: IChart, bar: Bar, subPaneTop: number, tooltipY: number): void {
    if (!this.getOptions()?.show) return;

    const isUp = bar.close >= bar.open;
    const volUpColor = chart.options.volume?.upColor || '#22c55e';
    const volDownColor = chart.options.volume?.downColor || '#ef4444';
    const color = isUp ? volUpColor : volDownColor;

    const volLabel = 'Volume:';
    const volValue = bar.volume != null ? this.formatVolume(bar.volume) : '0';

    const x = 10; // LAYOUT.TOOLTIP_MARGIN_X
    const y = tooltipY;

    ctx.font = 'bold 12px system-ui';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // Label in neutral color
    ctx.fillStyle = '#888';
    ctx.fillText(volLabel, x, y);
    const labelWidth = ctx.measureText(volLabel).width;

    // Value in candle-direction color
    ctx.fillStyle = color;
    ctx.fillText(volValue, x + labelWidth + 5, y);
  }

  renderAxisLabel(ctx: CanvasRenderingContext2D, chart: IChart, barIndex: number, mouseY: number, subPaneTop: number, axisX: number): void {
    const { data, axisWidth, w } = chart.state;
    const subPaneHeight = this.computeHeight(chart.state, this.getOptions());

    // Compute volume value at cursor Y
    const maxVol = this.getMaxVisibleVolume(chart);
    const visibleVolMax = maxVol / this.state.scale;
    const visibleVolMin = Math.max(0, this.state.offset);
    const visibleRange = Math.max(1, visibleVolMax - visibleVolMin);

    const volTopGap = Math.max(4, Math.round(subPaneHeight * 0.1));
    const volAreaHeight = subPaneHeight - 2 - volTopGap;
    const volTop = subPaneTop + volTopGap;

    const ratio = 1 - (mouseY - volTop) / volAreaHeight;
    const volValue = Math.max(0, Math.min(1, ratio)) * visibleRange + visibleVolMin;

    // Draw label box
    const labelHeight = 20;
    ctx.fillStyle = chart.options.layout.background;
    ctx.fillRect(w - axisWidth, mouseY - labelHeight / 2, axisWidth, labelHeight);

    // Draw label border
    ctx.strokeStyle = chart.options.layout.textColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(w - axisWidth, mouseY - labelHeight / 2, axisWidth, labelHeight);

    // Draw label text (right-aligned with padding)
    ctx.fillStyle = chart.options.layout.textColor;
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.formatVolume(Math.round(volValue)), w - 5, mouseY);
  }

  private getMaxVisibleVolume(chart: IChart): number {
    const { data, barWidth, w, axisWidth } = chart.state;
    const firstVisibleIdx = deriveVisibleStartIdx(chart.state, data.length);
    const barsVisible = Math.ceil((w - axisWidth) / barWidth) + 2;
    const endIdx = Math.min(firstVisibleIdx + barsVisible, data.length);

    let maxVol = 0;
    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const bar = data[i];
      if (bar && bar.volume != null && bar.volume > maxVol) {
        maxVol = bar.volume;
      }
    }
    return maxVol || 1;
  }

  getContextData(): Record<string, any> {
    return {
      show: this.chart.options.volume?.show,
      heightPercent: this.chart.options.volume?.heightPercent,
      scale: this.state.scale,
      offset: this.state.offset
    };
  }

  handleWheel(chart: IChart, deltaY: number): boolean {
    const PRICE_SCROLL_FACTOR_OUT = 0.87;
    const PRICE_SCROLL_FACTOR_IN = 1.15;

    this.state.scale *= (deltaY > 0 ? PRICE_SCROLL_FACTOR_OUT : PRICE_SCROLL_FACTOR_IN);
    this.state.scale = Math.max(1.0, Math.min(this.state.scale, 10));
    return true;
  }

  handleDrag(chart: IChart, deltaY: number): void {
    const DRAG_SCALE_DIVISOR = 200;
    this.state.scale *= (1 - deltaY / (DRAG_SCALE_DIVISOR * 5));
    this.state.scale = Math.max(1.0, Math.min(this.state.scale, 10));
  }

  handleDblClick(chart: IChart): void {
    this.state.scale = 1.0;
    this.state.offset = 0;
  }

  handleSeparatorDrag(chart: IChart, deltaY: number, totalHeight: number): void {
    const hPct = chart.options.volume.heightPercent - (deltaY / totalHeight);
    chart.options.volume.heightPercent = Math.max(0.05, Math.min(0.5, hPct));
  }
}
