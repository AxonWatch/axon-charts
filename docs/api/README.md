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
chart.render(): void
```
Manually triggers a full re-render of the chart.

#### Viewport

```typescript
chart.resize(width?: number, height?: number): void
```
Resizes the chart to specified dimensions, or reads container size if omitted.

**Smart Resize Behavior:**
- If **auto-scroll is enabled** — anchors to the latest candle (always visible after resize)
- If **auto-scroll is disabled** (user is exploring historical data) — preserves the visible center point
- Re-entrant calls are prevented via `isResizing` guard
- `ResizeObserver` and `window.resize` events are both handled, with deduplication

```typescript
chart.getContext(): ChartContext
```
Returns a structured JSON object with current viewport state, visible bars, price range, and scale info. Designed for LLM reasoning:

```typescript
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
| `priceScale.currentPrice` | Countdown timer restart + render |
| `layout.width` / `height` | Full resize |
| `layout.background` / `textColor` / `fontSize` / `fontFamily` | Render |
| `grid.*` | Render |
| `crosshair.*` | Crosshair overlay redraw (no full render) |
| `behavior.*` | No immediate update — flags read directly on next event |

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
// Set scale mode (linear or logarithmic)
chart.priceScale().setMode('linear' | 'logarithmic'): void

// Get current scale mode
chart.priceScale().getMode(): 'linear' | 'logarithmic'

// Set top/bottom padding as percentage (0-1)
chart.priceScale().setMargins({ top: number, bottom: number }): void

// Get current margins
chart.priceScale().getMargins(): { top: number; bottom: number }

// Apply multiple price scale options at once
chart.priceScale().setOptions(options: Partial<ChartOptions['priceScale']>): void

// Get current price scale options
chart.priceScale().getOptions(): PriceScaleOptions
```

**Note:** `setMargins()` is accepted by the API but currently doesn't affect rendering — the DataManager uses a hardcoded padding ratio. The API exists for future implementation and type compatibility.

---

### `chart.timeScale()`

Controls the X-axis time scale. **Type:** `TimeScaleAPI`

#### Range & Zoom

```typescript
// Set visible time range
chart.timeScale().setVisibleRange(from: number, to: number): void

// Get current visible timestamps
chart.timeScale().getVisibleRange(): { from: number; to: number }

// Fit all data into view
chart.timeScale().fitContent(): void

// Zoom in (makes bars wider)
chart.timeScale().zoomIn(factor?: number, x?: number): void

// Zoom out (makes bars narrower)
chart.timeScale().zoomOut(factor?: number, x?: number): void
```

#### Scrolling

```typescript
// Scroll to a specific timestamp
chart.timeScale().scrollToTime(timestamp: number, position?: 'left' | 'center' | 'right'): void
```

- `'right'` (default): Places bar at right edge (standard behavior)
- `'center'`: Centers the bar in viewport
- `'left'`: Places bar at left edge

#### Coordinate Mapping

```typescript
// Get screen X for a timestamp (returns pixel or null)
chart.timeScale().getCoordinate(timestamp: number): number | null

// Get bar index at a screen X position
chart.timeScale().getBarIndex(x: number): number | null

// Get bar OHLC data by timestamp
chart.timeScale().getBarAtTime(timestamp: number): Bar | null
```

#### Bar Spacing

```typescript
// Set bar width directly (clamped to min/max)
chart.timeScale().setBarSpacing(px: number): void

// Get current bar width
chart.timeScale().getBarSpacing(): number
```

#### Options

```typescript
// Apply time scale options
chart.timeScale().setOptions(options: Partial<ChartOptions['timeScale']>): void

// Get current time scale options
chart.timeScale().getOptions(): TimeScaleOptions
```

---

### `chart.crosshairAPI()`

Controls the crosshair overlay. **Type:** `CrosshairAPI`

#### Mode

```typescript
// Set crosshair mode
chart.crosshairAPI().setMode('normal' | 'magnet' | 'none'): void

// Get current mode
chart.crosshairAPI().getMode(): 'normal' | 'magnet' | 'none'

// Show/hide crosshair
chart.crosshairAPI().setVisible(visible: boolean): void

// Check if visible
chart.crosshairAPI().isVisible(): boolean
```

**Modes:**
- `'none'` — Crosshair completely hidden
- `'magnet'` — Crosshair snaps to the nearest bar center
- `'normal'` — Crosshair follows mouse freely (no snap to bar center)
- `'magnet'` — Crosshair snaps to nearest bar

#### Labels & Tooltip

```typescript
// Show/hide axis labels (price + time)
chart.crosshairAPI().setShowLabels(show: boolean): void

// Check if labels are enabled
chart.crosshairAPI().getShowLabels(): boolean

// Show/hide OHLC tooltip
chart.crosshairAPI().setShowTooltip(show: boolean): void

// Check if tooltip is enabled
chart.crosshairAPI().getShowTooltip(): boolean
```

#### Line Styling

```typescript
// Set vertical crosshair line options
chart.crosshairAPI().setVerticalLine(options: { color?: string; width?: number; style?: 'solid' | 'dashed' }): void

// Set horizontal crosshair line options
chart.crosshairAPI().setHorizontalLine(options: { color?: string; width?: number; style?: 'solid' | 'dashed' }): void

// Apply multiple crosshair options at once
chart.crosshairAPI().setOptions(options: Partial<ChartOptions['crosshair']>): void

// Get current crosshair options
chart.crosshairAPI().getOptions(): CrosshairOptions
```

---

## Options Reference

### `ChartOptions` Interface

All options are optional with sensible defaults.

```typescript
interface ChartOptions {
  layout?: {
    width?: number | 'auto';     // default: 'auto'
    height?: number | 'auto';    // default: 'auto'
    background?: string;         // default: '#1a1a1a'
    textColor?: string;          // default: '#aaaaaa'
    fontSize?: number;           // default: 12 (1-72)
    fontFamily?: string;         // default: 'system-ui'
  };

  grid?: {
    show?: boolean;              // default: true
    vertLines?: {
      show?: boolean;            // default: true
      color?: string;            // default: '#2a2a2a'
      width?: number;            // default: 1
    };
    horzLines?: {
      show?: boolean;            // default: true
      color?: string;            // default: '#2a2a2a'
      width?: number;            // default: 1
    };
  };

  priceScale?: {
    mode?: 'linear' | 'logarithmic';  // default: 'linear'
    scaleMargins?: { top?: number; bottom?: number };  // 0-1 range
    priceFormat?: {
      type?: 'price' | 'volume' | 'percent' | 'custom';
      precision?: number;
      minMove?: number;
      formatter?: (price: number) => string;
    };
    currentPrice?: {
      showCountdown?: boolean;   // default: true
      countdownColor?: string;   // default: 'rgba(255,255,255,0.8)'
    };
  };

  timeScale?: {
    visible?: boolean;           // default: true
    rightOffset?: number;        // default: 80
    barSpacing?: number;         // default: 11
    minBarSpacing?: number;      // default: 4
    maxBarSpacing?: number;      // default: 1000
  };

  crosshair?: {
    mode?: 'normal' | 'magnet' | 'none';  // default: 'magnet'
    showLabels?: boolean;        // default: true
    showTooltip?: boolean;       // default: true
    vertLine?: {
      color?: string;            // default: '#555555'
      width?: number;            // default: 1
      style?: 'solid' | 'dashed';  // default: 'dashed'
    };
    horzLine?: {
      color?: string;            // default: '#555555'
      width?: number;            // default: 1
      style?: 'solid' | 'dashed';  // default: 'dashed'
    };
  };

  behavior?: {
    dragToZoom?: boolean;        // default: true
    scrollToZoom?: boolean;      // default: true
    pinchToZoom?: boolean;       // default: true
    panOnMouseDrag?: boolean;    // default: true
    dragPriceScale?: boolean;    // default: true
    autoScroll?: boolean;        // default: true
  };

  data?: {
    maxBars?: number;            // default: 5000
  };

  // Legacy shortcuts (mapped into hierarchical structure)
  colors?: {
    background?: string;
    grid?: string;
    up?: string;
    down?: string;
    text?: string;
    crosshair?: string;
  };
  width?: number | 'auto';
  height?: number | 'auto';
  rightGap?: number;
  autoScroll?: boolean;
  baseBarWidth?: number;
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
| `width` | `layout.width` | Fully supported |
| `height` | `layout.height` | Fully supported |
| `colors.background` | `layout.background` | Fully supported |
| `colors.text` | `layout.textColor` | Fully supported |
| `colors.grid` | `grid.vertLines.color` + `grid.horzLines.color` | Fully supported |
| `colors.up` | *(direct)* Bullish candle color | Fully supported |
| `colors.down` | *(direct)* Bearish candle color | Fully supported |
| `rightGap` | `timeScale.rightOffset` | Fully supported |
| `autoScroll` | `behavior.autoScroll` | Fully supported |
| `baseBarWidth` | `timeScale.barSpacing` | Fully supported |
| `timeframe` | *(none)* | Accepted but never read |
| `maxBars` | `data.maxBars` | Init-only |

---



### Planned Options (v1.0.1)

These will be added in the next release:

```typescript
// Toggle custom right-click menu (default: true)
crosshair?: {
  // ... existing options ...
  rightClickMenu?: boolean;   // When false, suppresses right-click menu
}

// Full date in crosshair time label (default: true)
timeScale?: {
  // ... existing options ...
  showFullDate?: boolean;     // When true: "Fri 03 Jan'26 17:55"
}

// Market info label (in-chart, top-left)
market?: {
  show?: boolean;             // default: false
  baseAsset?: string;         // e.g. 'BTC'
  quoteAsset?: string;        // e.g. 'USDT'
  timeframe?: string;         // e.g. '1m', '4H', '1d'
  source?: string;            // e.g. 'Binance'
}

// Watermark overlay (auto-scaling)
watermark?: {
  show?: boolean;             // default: false
  text?: string;              // default: '' (empty = pair fallback)
  color?: string;             // default: '#ffffff'
  fontSize?: number | null;   // default: null (auto-scale to ~30% chart width)
  opacity?: number;           // default: 0.07
  alignment?: 'left' | 'center' | 'right';  // default: 'center'
}
```

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
  { time: 1704067200000, open: 100, high: 110, low: 95, close: 105 },
  { time: 1704070800000, open: 105, high: 112, low: 100, close: 108 }
]);

// Use component APIs
chart.priceScale().setMode('logarithmic');
chart.timeScale().fitContent();
chart.crosshairAPI().setShowLabels(false);

// Live update
setInterval(() => {
  chart.updateLastBar({
    time: Date.now(),
    open: 105, high: 115, low: 102, close: 112
  });
}, 1000);

// Get context for AI
const ctx = chart.getContext();
console.log(`Visible: ${ctx.state.totalBars} bars, ${ctx.visibleBars.length} on screen`);