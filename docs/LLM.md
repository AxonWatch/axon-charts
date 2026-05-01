# LLM Integration Guide — Axon Charts

This document explains how to use Axon Charts with AI language models. The library is designed from the ground up for LLM-driven usage — every feature is callable with a simple, predictable interface.

---

## How an LLM Interacts with the Chart

There are three interaction modes:

| Mode | Direction | What It Does | Methods |
|------|-----------|-------------|---------|
| **Read** | Chart → LLM | The LLM reads chart state | `getContext()`, `getData()`, `getBars()` |
| **Write** | LLM → Chart | The LLM controls the chart | `execute()`, `setOptions()`, component APIs |
| **React** | Chart → LLM callbacks | The chart notifies the LLM | `onCrosshairMove()`, `onBarClick()` |

---

## 1. Reading Chart State

### getContext() — Structured JSON Export

```typescript
const ctx = chart.getContext();
```

Returns everything an LLM needs to reason about the current chart state:

```javascript
{
  "viewport": {
    "width": 800, "height": 400,
    "visibleRange": {
      "fromIndex": 9, "toIndex": 74,
      "fromTime": 1704067200000, "toTime": 1704153600000
    },
    "priceRange": { "min": 95.50, "max": 115.30 },
    "scales": { "pricePerPixel": 0.025, "timePerBar": 60000, "barWidth": 11 }
  },
  "state": {
    "totalBars": 5000,
    "isAutoScrolling": true
  },
  "visibleBars": [
    { "time": 1704067200000, "open": 100, "high": 105, "low": 98, "close": 103, "volume": 15000 },
    // ... all visible bars
  ],
  "latestBar": { "time": 1704153600000, "open": 112, "high": 113, "low": 110.5, "close": 112.8 }
}
```

**What the LLM can determine:**
- All visible OHLC candles with numeric values
- The exact price range shown on screen
- The time window (from/to timestamps)
- Total dataset size vs visible window
- Whether the chart is auto-scrolling (watching latest data)
- The current (latest) candle

### getData() / getBars() — Full Data Access

```typescript
const allData = chart.getData();        // Entire dataset
const last100 = chart.getBars(100);     // Last N bars
const range = chart.getBarsInRange(     // Bars between timestamps
  1704067200000, 1704153600000
);
```

### getBarAtTime() — Point Lookup

```typescript
const bar = chart.getBarAtTime(1704067200000);
// { time: 1704067200000, open: 100, high: 105, low: 98, close: 103 }
```

---

## 2. Controlling the Chart

### execute() — Universal Command

The `execute()` method accepts plain action objects. It routes to the correct API internally.

```typescript
// Mode and visibility
chart.execute({ action: 'setMode', target: 'priceScale', value: 'log' });
chart.execute({ action: 'setMode', target: 'crosshair', value: 'none' });
chart.execute({ action: 'setVisible', target: 'crosshair', value: false });

// Viewport
chart.execute({ action: 'scrollTo', params: [timestamp] });
chart.execute({ action: 'scrollTo', params: [timestamp, 'center'] });
chart.execute({ action: 'fitContent' });
chart.execute({ action: 'zoomIn', params: [1.5] });
chart.execute({ action: 'zoomOut', params: [2] });

// Options
chart.execute({
  action: 'setOptions',
  params: [{ grid: { vertLines: { show: false } } }]
});

// Read state
const ctx = chart.execute({ action: 'getContext' });
```

**Supported actions:**

| Action | Target | Value / Params |
|--------|--------|----------------|
| `setMode` | `'priceScale'`, `'crosshair'` | Mode string |
| `setVisible` | `'crosshair'` | `true` / `false` |
| `setShowLabels` | `'crosshair'` | `true` / `false` |
| `setShowTooltip` | `'crosshair'` | `true` / `false` |
| `scrollTo` | — | `[timestamp, position?]` |
| `fitContent` | — | — |
| `zoomIn` | — | `[factor?]` |
| `zoomOut` | — | `[factor?]` |
| `setOptions` | — | `[partialOptions]` |
| `getContext` | — | — |
| `getData` | — | — |
| `getBars` | — | `[count]` |

### Direct API Access

For more control, the component APIs are also available directly:

```typescript
chart.priceScale().setMode('logarithmic');
chart.timeScale().setVisibleRange(from, to);
chart.timeScale().fitContent();
chart.timeScale().scrollToTime(timestamp, 'center');
chart.crosshairAPI().setMode('magnet');
chart.setOptions({ grid: { show: false } });
```

---

## 3. Reacting to Chart Events

### Event Callbacks

```typescript
// User moves cursor over chart
chart.onCrosshairMove(({ bar, price, time, x, y }) => {
  console.log(`Bar at cursor: O=${bar.open} H=${bar.high} L=${bar.low} C=${bar.close}`);
  console.log(`Price at cursor: $${price}`);
});

// User clicks on a bar
chart.onBarClick(({ bar, index }) => {
  console.log(`Clicked bar #${index}: ${bar.symbol} $${bar.close}`);
});

// User pans or zooms
chart.onVisibleRangeChange(({ from, to }) => {
  console.log(`Now viewing: ${new Date(from)} to ${new Date(to)}`);
});

// Auto-scroll state changes
chart.onScrollLockChange((locked) => {
  console.log(locked ? 'Exploring history' : 'Watching live');
});
```

### Practical LLM Integration Pattern

```typescript
// 1. LLM reads the chart
const ctx = JSON.stringify(chart.getContext(), null, 2);

// 2. LLM sends a command
chart.execute({
  action: 'scrollTo',
  params: [1704067200000, 'center']
});

// 3. Chart fires events when user interacts
chart.onVisibleRangeChange((range) => {
  // Trigger re-read whenever viewport changes
  const updated = chart.getContext();
  sendToLLM(updated);
});
```

---

## Exported Utilities for LLM Coordinate Reasoning

```typescript
import { Projection } from 'axon-charts';

// Convert a bar index to screen X position
const x = Projection.indexToX(42, chart.state);

// Convert a price to screen Y position
const y = Projection.priceToY(105.50, chart.state);

// Convert screen Y back to price
const price = Projection.yToPrice(y, chart.state);

// Layout constants
import { LAYOUT } from 'axon-charts';
// LAYOUT.TOP_MARGIN, LAYOUT.BOTTOM_MARGIN, LAYOUT.RIGHT_GAP, etc.
```

---

## Screenshot for Vision LLMs

```typescript
// Get a base64 data URL (merges all three canvas layers)
const screenshot = chart.toDataURL('image/png');

// Send to vision-capable LLM
// The LLM can SEE the chart AND read the structured JSON
// for combined visual + quantitative analysis
```

---

## State Management Across Sessions

```typescript
// Save current chart state
const state = chart.saveState();

// Later, restore everything
const newChart = createChart('#container');
newChart.loadState(state);
```

The saved state includes: chart options, zoom level, scroll position, all bar data.

---

## Open Source vs Advanced Capabilities

| Capability | Open Source | Advanced |
|-----------|:-----------:|:--------:|
| Read chart state (getContext, getData) | ✅ | ✅ |
| Control chart (execute, setOptions) | ✅ | ✅ |
| Event callbacks (onCrosshairMove) | ✅ | ✅ |
| Screenshot capture | ✅ | ✅ |
| State save/restore | ✅ | ✅ |
| Trend / volatility helpers | — | ✅ |
| Support/resistance detection | — | ✅ |
| Heiken Ashi candle mode | — | ✅ |
| Pattern recognition | — | ✅ |

---

## Quick Reference for LLM Prompts

When instructing an LLM to use Axon Charts, include the following summary:

```
You have access to a chart instance. Use these methods:

READ:
  chart.getContext()         → JSON with visible bars, price range, scales
  chart.getData()            → full Bar[] array
  chart.getBars(N)           → last N bars
  chart.getBarAtTime(ts)     → single bar by timestamp

CONTROL:
  chart.execute({ action, target?, params?, value? })
    - setMode (target: 'priceScale'/'crosshair', value: 'linear'/'log')
    - scrollTo (params: [timestamp, position?])
    - fitContent, zoomIn, zoomOut (params: [factor?])
    - setVisible (target: 'crosshair', value: true/false)
    - setOptions (params: [{ ... }])

REACT:
  chart.onCrosshairMove(cb)           → fires on cursor move
  chart.onBarClick(cb)                → fires on bar click
  chart.onVisibleRangeChange(cb)      → fires on pan/zoom

All options are documented in the ChartOptions interface.
```

---

## Performance Considerations

- `getContext()` returns a new object on every call — cheap, no allocations beyond the object structure
- `execute()` is a thin routing layer — no performance overhead
- Event callbacks fire on every relevant interaction — keep handlers lightweight
- `toDataURL()` is the most expensive operation (canvas → base64) — call sparingly (e.g., debounce to every 500ms)
- `getBars()` returns a new array each call — the reference to the internal array is never exposed to prevent mutation
