# API Reference — Axon Charts v1.0.0

This document provides the complete API surface for the Axon Charts library. The library exposes an `AxonCharts` global (when loaded via script tag) or named exports (when used as an ES module).

---

## Core API

### `createChart(container, options?)`

Creates a new chart instance attached to a DOM element.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `container` | `HTMLElement \| string` | required | DOM element or CSS selector string |
| `options` | `Partial<ChartOptions>` | `{}` | Chart configuration (all fields optional) |

**Returns:** `Chart` instance

```typescript
// HTML script tag
const chart = AxonCharts.createChart('#chart', { /* options */ });

// ES module
import { createChart } from 'axon-charts';
const chart = createChart('#chart', { /* options */ });
```

---

### `Chart` Instance Methods

#### Data Operations

```typescript
chart.setData(bars: Bar[]): void
```
Replaces all chart data with a new set of bars. Validates the first and last bar.

```typescript
chart.appendBar(bar: Bar): void
```
Appends a new completed bar to the end. Auto-scrolls to latest if enabled.

```typescript
chart.updateLastBar(bar: Bar): void
```
Updates the last (current/live) bar. If the timestamp doesn't match, appends a new bar instead.

```typescript
chart.updateLastBarFast(bar: Bar): void
```
High-frequency tick update (10-1000 ticks/sec). Skips axis/grid/buffer redraw — only re-draws the last candle. Falls back to full render on new candle. See docs/STREAMING.md.

```typescript
chart.render(): void
```
Manually triggers a full re-render of the chart.

#### Viewport

```typescript
chart.resize(width?: number, height?: number): void
```
Resizes the chart to specified dimensions, or reads container size if omitted.

**Smart Resize Behavior:**
- If **auto-scroll is enabled** — anchors to the latest candle
- If **auto-scroll is disabled** — preserves the visible center point
- Re-entrant calls prevented via `isResizing` guard
- `ResizeObserver` and `window.resize` events both handled with deduplication

```typescript
chart.getContext(): ChartContext
```
Returns a structured JSON object with current viewport state, visible bars, price range, and scale info. Designed for LLM reasoning:

```javascript
{
  viewport: {
    width, height, rightGap,
    visibleRange: { fromIndex, toIndex, fromTime, toTime },
    priceRange: { min, max },
    scales: { pricePerPixel, timePerBar, barWidth }
  },
  state: { totalBars, isAutoScrolling },
  visibleBars: Bar[],
  latestBar: Bar
}
```

```typescript
chart.scrollToLatest(): void
```
Snaps the viewport to show the latest candle at the right edge.

```typescript
chart.isAutoScrolling(): boolean
```
Returns `true` if the viewport is currently tracking the latest candle.

#### Lifecycle

```typescript
chart.destroy(): void
```
Cleanly destroys the chart: stops countdown timer, removes all event listeners, disconnects ResizeObserver, removes canvas elements, nulls references.

```typescript
chart.onScrollLockChange?: (locked: boolean) => void
```
Callback invoked when auto-scroll state changes (locked/unlocked).

#### Configuration

```typescript
chart.setOptions(options: Partial<ChartOptions>): void
```
Updates chart options at runtime using deep merge. Validates all inputs before applying.

**Side-effect cascade:**

| Option changed | Effect |
|----------------|--------|
| `timeScale.barSpacing` | Buffer recreation + full render |
| `timeScale.rightOffset` | State update + render |
| `timeScale.visible` | Render |
| `timeScale.minBarSpacing` / `maxBarSpacing` | Stored in options (enforced in events.ts) |
| `priceScale.mode` | State update + render |
| `priceScale.priceFormat` | PriceFormatter recreate + render |
|| `priceScale.reverse` | State update + render |
| `priceScale.currentPrice` | Countdown timer restart + render |
| `layout.width` / `height` | Full resize |
| `layout.background` / `textColor` / `fontSize` / `fontFamily` | Render |
| `layout.padding` | State update + render |
| `grid.*` | Render |
| `crosshair.*` | Crosshair overlay redraw (no full render) |
| `behavior.*` | No immediate update — flags read directly on next event |
| `volume.*` | State update + buffer recreation + render |
| `market.*` | Render (crosshair overlay) |
| `watermark.*` | Render (bg canvas) |
| `series.*` | Render (candle colors) |

```typescript
chart.getOptions(): Readonly<ChartOptions>
```
Returns a deep-cloned snapshot of current options.

```typescript
chart.resetOptions(): void
```
Resets all options to factory defaults and re-renders.

---

## Component APIs

### `chart.priceScale()`

Controls the Y-axis price scale. **Type:** `PriceScaleAPI`

```typescript
chart.priceScale().setMode('linear' | 'logarithmic'): void
chart.priceScale().getMode(): 'linear' | 'logarithmic'
chart.priceScale().setMargins({ top: number, bottom: number }): void
chart.priceScale().getMargins(): { top: number; bottom: number }
chart.priceScale().setReverse(reverse: boolean): void
chart.priceScale().getReverse(): boolean
chart.priceScale().setOptions(options: Partial<ChartOptions['priceScale']>): void
chart.priceScale().getOptions(): PriceScaleOptions
```

---

### `chart.timeScale()`

Controls the X-axis time scale. **Type:** `TimeScaleAPI`

#### Range & Zoom

```typescript
chart.timeScale().setVisibleRange(from: number, to: number): void
chart.timeScale().getVisibleRange(): { from: number; to: number }
chart.timeScale().fitContent(): void
chart.timeScale().zoomIn(factor?: number, x?: number): void
chart.timeScale().zoomOut(factor?: number, x?: number): void
```

#### Scrolling

```typescript
chart.timeScale().scrollToTime(timestamp: number, position?: 'left' | 'center' | 'right'): void
```
- `'right'` (default): Places bar at right edge
- `'center'`: Centers the bar in viewport
- `'left'`: Places bar at left edge

#### Coordinate Mapping

```typescript
chart.timeScale().getCoordinate(timestamp: number): number | null
chart.timeScale().getBarIndex(x: number): number | null
chart.timeScale().getBarAtTime(timestamp: number): Bar | null
```

#### Bar Spacing

```typescript
chart.timeScale().setBarSpacing(px: number): void
chart.timeScale().getBarSpacing(): number
```

#### Options

```typescript
chart.timeScale().setOptions(options: Partial<ChartOptions['timeScale']>): void
chart.timeScale().getOptions(): TimeScaleOptions
```

---

### `chart.crosshairAPI()`

Controls the crosshair overlay. **Type:** `CrosshairAPI`

#### Mode

```typescript
chart.crosshairAPI().setMode('normal' | 'magnet' | 'none'): void
chart.crosshairAPI().getMode(): 'normal' | 'magnet' | 'none'
chart.crosshairAPI().setVisible(visible: boolean): void
chart.crosshairAPI().isVisible(): boolean
```

**Modes:**
- `'none'` — Crosshair completely hidden
- `'magnet'` — Crosshair snaps to the nearest bar center
- `'normal'` — Crosshair follows mouse freely (no snap)

#### Labels & Tooltip

```typescript
chart.crosshairAPI().setShowLabels(show: boolean): void
chart.crosshairAPI().getShowLabels(): boolean
chart.crosshairAPI().setShowTooltip(show: boolean): void
chart.crosshairAPI().getShowTooltip(): boolean
```

#### Line Styling

```typescript
chart.crosshairAPI().setVerticalLine(options: { color?: string; width?: number; style?: 'solid' | 'dashed' }): void
chart.crosshairAPI().setHorizontalLine(options: { color?: string; width?: number; style?: 'solid' | 'dashed' }): void
chart.crosshairAPI().setOptions(options: Partial<ChartOptions['crosshair']>): void
chart.crosshairAPI().getOptions(): CrosshairOptions
```

---

## Options Reference

### `ChartOptions` Interface

All options are optional with sensible defaults.

```typescript
interface ChartOptions {
  // === Layout ===
  layout?: {
    width?: number | 'auto';        // default: 'auto'
    height?: number | 'auto';       // default: 'auto'
    background?: string;            // default: '#1a1a1a'
    textColor?: string;             // default: '#aaaaaa'
    fontSize?: number;              // default: 12 (1-72)
    fontFamily?: string;            // default: 'system-ui'
    padding?: { top?: number;       // default: 40
                right?: number;     // default: 60
                bottom?: number;    // default: 35
                left?: number };    // default: 10
  };

  // === Grid ===
  grid?: {
    show?: boolean;                 // default: true
    vertLines?: { show?: boolean; color?: string; width?: number };
    horzLines?: { show?: boolean; color?: string; width?: number };
  };

  // === Series (Candle Colors) ===
  series?: {
    upColor?: string;               // default: '#22c55e'
    downColor?: string;             // default: '#ef4444'
  };

  // === Price Scale ===
    reverse?: boolean;             // default: false (true = inverted, high at bottom)
  priceScale?: {
    mode?: 'linear' | 'logarithmic';  // default: 'linear'
    scaleMargins?: { top?: number; bottom?: number };  // 0-1 range
    priceFormat?: { type?, precision?, minMove?, formatter? };
    currentPrice?: {
      showCountdown?: boolean;     // default: true
      countdownColor?: string;     // default: 'rgba(255,255,255,0.8)'
    };
  };

  // === Time Scale ===
  timeScale?: {
    visible?: boolean;              // default: true
    timeVisible?: boolean;          // default: true
    secondsVisible?: boolean;       // default: false
    showFullDate?: boolean;         // default: true ("Fri 03 Jan'26 17:55")
    rightOffset?: number;           // default: 80
    barSpacing?: number;            // default: 11
    minBarSpacing?: number;         // default: 4
    maxBarSpacing?: number;         // default: 1000
  };

  // === Crosshair ===
  crosshair?: {
    mode?: 'normal' | 'magnet' | 'none';  // default: 'magnet'
    showLabels?: boolean;           // default: true
    showTooltip?: boolean;          // default: true
    vertLine?: { color?, width?, style? };
    horzLine?: { color?, width?, style? };
  };

  // === Right-Click Context Menu ===
  menu?: {
    enabled?: boolean;              // default: true
  };

  // === Behavior ===
  behavior?: {
    dragToZoom?: boolean;           // default: true
    scrollToZoom?: boolean;         // default: true
    pinchToZoom?: boolean;          // default: true
    panOnMouseDrag?: boolean;       // default: true
    dragPriceScale?: boolean;       // default: true
    autoScroll?: boolean;           // default: true
  };

  // === Data ===
  data?: {
    maxBars?: number;               // default: 5000
    autoCleanup?: boolean;          // default: true
  };

  // === Market Info ===
  market?: {
    show?: boolean;                 // default: false
    baseAsset?: string;             // default: 'BTC'
    quoteAsset?: string;            // default: 'USDT'
    timeframe?: string;             // default: '1m'
    source?: string;                // default: ''
  };

  // === Watermark ===
  watermark?: {
    show?: boolean;                 // default: false
    text?: string;                  // default: '' (pair fallback)
    color?: string;                 // default: '#ffffff'
    fontSize?: number | null;       // default: null (auto-scale)
    opacity?: number;               // default: 0.07
    rotate?: boolean;               // default: false (horizontal). true = -45 diagonal
  };

  // === Volume Sub-Pane ===
  volume?: {
    show?: boolean;                 // default: false
    upColor?: string;               // default: '#22c55e'
    downColor?: string;             // default: '#ef4444'
    heightPercent?: number;         // default: 0.2 (20%, range 0.05-0.5)
    precision?: number | null;    // default: null (auto-detect from data)
    minMove?: number | null;       // default: null (infer precision from minMove)
  };

  // === Init-Only ===
  devicePixelRatio?: number;        // default: window.devicePixelRatio
}
```

### `Bar` Data Format

```typescript
interface Bar {
  time: number;       // Timestamp in milliseconds
  open: number;       // Open price
  high: number;       // High price
  low: number;        // Low price
  close: number;      // Close price
  volume?: number;    // Optional volume
}
```

---

## Legacy / Deprecated Options

These are accepted for backward compatibility but mapped to the hierarchical structure:

| Legacy Option | Maps to | Status |
|---------------|---------|--------|
| `width` | `layout.width` | Supported |
| `height` | `layout.height` | Supported |
| `colors.background` | `layout.background` | Supported |
| `colors.text` | `layout.textColor` | Supported |
| `colors.grid` | `grid.vertLines.color` + `grid.horzLines.color` | Supported |
| `colors.up` | (direct) Bullish candle color | Supported |
| `colors.down` | (direct) Bearish candle color | Supported |
| `rightGap` | `timeScale.rightOffset` | Supported |
| `autoScroll` | `behavior.autoScroll` | Supported |
| `baseBarWidth` | `timeScale.barSpacing` | Supported |
| `timeframe` | *(none)* | Accepted but never read |
| `maxBars` | `data.maxBars` | Supported |

---

## Quick Examples

```typescript
// Create with hierarchical options
const chart = createChart('#container', {
  layout: { background: '#1a1a1a', textColor: '#ffffff' },
  grid: { vertLines: { color: '#333', width: 1 } },
  crosshair: { mode: 'magnet', showTooltip: true }
});

// Set data
chart.setData([
  { time: 1704067200000, open: 100, high: 110, low: 95, close: 105, volume: 15000 },
  { time: 1704070800000, open: 105, high: 112, low: 100, close: 108, volume: 22000 }
]);

// Use component APIs
chart.priceScale().setMode('logarithmic');
chart.timeScale().fitContent();
chart.crosshairAPI().setMode('normal');

// Add volume sub-pane
chart.setOptions({ volume: { show: true, heightPercent: 0.25 } });

// Market header
chart.setOptions({ market: { baseAsset: 'BTC', quoteAsset: 'USDT', timeframe: '1m', source: 'Binance', show: true } });

// Watermark
chart.setOptions({ watermark: { text: 'AXON CHARTS', show: true, opacity: 0.05 } });

// LLM integration
const context = chart.getContext();
chart.execute({ type: 'scrollToTime', time: 1704067200000 });
chart.execute({ type: 'setCrosshair', mode: 'none' });
chart.execute({ type: 'setReverse', reverse: true });

// Events
chart.onCrosshairMove(({ time, price, bar }) => {
  console.log(`At cursor: $${price}`);
});

// Streaming
chart.updateLastBarFast({ time: Date.now(), open: 105, high: 108, low: 104, close: 107, volume: 5000 });
```

---

## Volume Sub-Pane API

The volume sub-pane displays a histogram below the main chart with its own Y-axis.

### Configuration
```typescript
chart.setOptions({
  volume: {
    show: true,             // Toggle visibility
    upColor: '#22c55e',     // Green for up bars
    downColor: '#ef4444',   // Red for down bars
    heightPercent: 0.2      // 20% of chart height (0.05-0.5)
  }
});
```

### Interaction
- **Scroll wheel** on sub-pane axis: zoom volume Y-scale (1x-10x)
- **Drag** on sub-pane axis: adjust volume scale (up = zoom out, down = zoom in)
- **Double-click** on sub-pane axis: reset zoom/offset to defaults
- **Draggable separator**: click within 6px of separator line and drag up/down to resize
- **Volume tooltip**: shows at top-left of sub-pane with K/M formatting

### Notes
- Bars are colored per candle direction using the same up/down colors as candles
- Crosshair spans full chart height including sub-pane
- Vertical grid lines align with main chart via same `calculateTimeStep()` function
- Data must include `volume` field on Bar objects (optional, defaults to 0)
