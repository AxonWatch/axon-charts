import { ScalePane } from './ScalePane.js';
import { IChart, Bar } from '../types/index.js';
import type { ChartState } from '../utils/projection.js';
import { LAYOUT } from '../core/layout.js';
import { indexToX } from '../utils/projection.js';

/**
 * Volume bar sub-pane implementation.
 *
 * Only implements the required abstract methods from ScalePane.
 * Volume reads raw bar.volume directly (no computeValues needed).
 * All generic functionality (separator, grids, tooltip, axis labels,
 * current value line, zoom/pan, precision detection, compute cache) is provided
 * by the ScalePane base class.
 */
export class VolumeSubPane extends ScalePane {
  readonly id = 'volume';
  readonly label = 'Volume';

  constructor(chart: IChart) {
    super(chart);
  }

  getOptions() {
    return this.chart.options.volume || {};
  }

  renderContent(
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
  ): void {
    const { data, barWidth, w, axisWidth } = chart.state;
    const options = this.getOptions();
    const chartAreaWidth = w - axisWidth;
    const volUpColor = options.upColor || '#22c55e';
    const volDownColor = options.downColor || '#ef4444';

    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const bar = data[i];
      if (!bar || bar.volume == null) continue;

      const centerX = indexToX(i, chart.state);
      const candleWidth = Math.floor(barWidth * LAYOUT.CANDLE_GAP_RATIO);
      const x = centerX - candleWidth / 2;

      if (x + candleWidth < 0 || x > chartAreaWidth) continue;

      const volRatio = Math.max(0, Math.min(1, (bar.volume - visibleMin) / visibleRange));
      const volBarHeight = Math.max(1, volRatio * areaHeight);
      const y = areaTop + (areaHeight - volBarHeight);

      const isUp = bar.close >= bar.open;
      ctx.fillStyle = isUp ? volUpColor : volDownColor;
      ctx.fillRect(x, y, Math.max(1, candleWidth), volBarHeight);
    }
  }

  getLatestValue(chart: IChart): number | null {
    const { data } = chart.state;
    if (data.length === 0) return null;
    const lastBar = data[data.length - 1];
    return lastBar?.volume ?? null;
  }

  getMaxVisible(chart: IChart): number {
    const { data, barWidth, w, axisWidth } = chart.state;
    const firstVisibleIdx = Math.max(0, Math.ceil((-chart.state.offsetX) / barWidth - 1));
    const barsVisible = Math.ceil((w - axisWidth) / barWidth) + 2;
    const endIdx = Math.min(firstVisibleIdx + barsVisible, data.length);
    let maxVal = 0;
    for (let i = firstVisibleIdx; i < endIdx; i++) {
      const bar = data[i];
      if (bar && bar.volume != null && bar.volume > maxVal) maxVal = bar.volume;
    }
    return maxVal || 1;
  }

  getTooltipColor(bar: Bar): string {
    const isUp = bar.close >= bar.open;
    const options = this.getOptions();
    return isUp ? (options.upColor || '#22c55e') : (options.downColor || '#ef4444');
  }

  getTooltipValue(bar: Bar): number | null {
    return bar.volume ?? null;
  }

  getTooltipLabel(): string {
    return 'Volume:';
  }
}
