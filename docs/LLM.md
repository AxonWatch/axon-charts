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
    "id": "ax-a1b2c3", "version": "1.1.0", "totalBars": 5000, "isAutoScrolling": true,
    "market": { "baseAsset": "BTC", "quoteAsset": "USDT", "timeframe": "1m", "source": "Binance" }
  },
  "visibleBars": [ /* OHLCV bars visible on screen */ ],
  "latestBar": { "time": ..., "open": ..., "high": ..., "low": ..., "close": ..., "volume": ... },
  "subPanes": { "volume": { "show": true, "heightPercent": 0.2, "scale": 1, "offset": 0 } }
}
```

**What the LLM can determine:**
- All visible OHLC candles with numeric values
- The exact price range shown on screen
- The time window (from/to timestamps)
- Total dataset size vs visible window
- Whether the chart is auto-scrolling
- The current (latest) candle with volume
- All active sub-panes with their current scale/offset

**Note:** `context.exposeData` controls whether visible bars, latest bar, and sub-panes are returned. When `false` (default), only viewport metadata is returned — reduces token cost for agents that only need spatial reasoning.

### getData() / getBars() — Full Data Access

```typescript
const allData = chart.getData();        // Entire dataset (copy)
const last100 = chart.getBars(0, 100);  // Bars 0-99
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

The `execute()` method accepts typed action objects. It routes to the correct API internally.

```typescript
// Mode and visibility
chart.execute({ type: 'setPriceScale', mode: 'logarithmic' });
chart.execute({ type: 'setPriceScale', mode: 'percentage' });
chart.execute({ type: 'setCrosshair', mode: 'none' });
chart.execute({ type: 'setReverse', reverse: true });

// Viewport
chart.execute({ type: 'scrollToTime', time: timestamp });
chart.execute({ type: 'fitContent' });
chart.execute({ type: 'zoomIn', factor: 1.5 });
chart.execute({ type: 'setVisibleRange', from: 1704067200000, to: 1704153600000 });

// Sub-panes
chart.execute({ type: 'setSubPane', id: 'volume', show: true });
```

**Supported actions (discriminated union):**

```typescript
type ChartCommand =
  | { type: 'setVisibleRange'; from: number; to: number }
  | { type: 'scrollToTime'; time: number }
  | { type: 'zoomIn'; factor?: number }
  | { type: 'zoomOut'; factor?: number }
  | { type: 'fitContent' }
  | { type: 'setPriceScale'; mode: 'linear' | 'logarithmic' | 'percentage' }
  | { type: 'setCrosshair'; mode: 'normal' | 'magnet' | 'none' }
  | { type: 'setSubPane'; id: string; show: boolean }
  | { type: 'setReverse'; reverse: boolean };
```

### Direct API Access

```typescript
chart.priceScale().setMode('percentage');
chart.timeScale().setVisibleRange(from, to);
chart.timeScale().fitContent();
chart.timeScale().scrollToTime(timestamp, 'center');
chart.crosshairAPI().setMode('magnet');
chart.setOptions({ grid: { show: false } });
chart.setOptions({ volume: { show: true, heightPercent: 0.25 } });
chart.setOptions({ series: { type: 'heiken-ashi' } });
chart.setOptions({ series: { type: 'line', lineColor: '#FF6B35', showMarkers: true } });
```

### Drawing API

```typescript
// Add persistent annotations
chart.addDrawing({
  id: 'ann1', type: 'arrow_up',
  barIndex: 42, price: 105.50, color: '#22c55e', text: 'Breakout'
});

chart.addDrawing({
  id: 'sup1', type: 'hline',
  barIndex: 0, price: 95.00, color: '#ef4444'
});

// Remove or clear
chart.removeDrawing('ann1');
chart.clearDrawings();

// Read back
const drawings = chart.getDrawings();
```

---

## 3. Reacting to Chart Events

### Event Callbacks

```typescript
// User moves cursor over chart
chart.onCrosshairMove = ({ time, price, bar }) => {
  console.log(`At cursor: $${price}, bar O=${bar?.open}`);
};

// User clicks on a bar
chart.onBarClick = (bar, index) => {
  console.log(`Clicked bar #${index}: $${bar.close}`);
};

// User pans or zooms — visible range changed
chart.onVisibleRangeChange = ({ fromIndex, toIndex, fromTime, toTime }) => {
  console.log(`Now viewing bars ${fromIndex}-${toIndex}`);
};

// Auto-scroll state changes
chart.onScrollLockChange = (locked) => {
  console.log(locked ? 'Exploring history' : 'Watching live');
};

// Data updated (tick, bar, append)
chart.onDataUpdate = (bars) => {
  console.log(`Received ${bars.length} bar(s)`);
};

// Candle closed — finalized bar (new candle just opened)
chart.onCandleClose = (closedBar) => {
  console.log(`Closed: O=${closedBar.open} H=${closedBar.high} L=${closedBar.low} C=${closedBar.close}`);
};
```

### Practical LLM Integration Pattern

```typescript
// 1. LLM reads the chart
const ctx = JSON.stringify(chart.getContext(), null, 2);

// 2. LLM sends a command
chart.execute({ type: 'scrollToTime', time: 1704067200000 });

// 3. Chart fires events when user interacts
chart.onVisibleRangeChange = (range) => {
  const updated = chart.getContext();
  sendToLLM(updated);
};
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
```

---

## Screenshot for Vision LLMs

```typescript
// Get a base64 data URL (merges all canvas layers)
const screenshot = chart.toDataURL();

// Or get a Blob (async)
const blob = await chart.toBlob();

// Send to vision-capable LLM
// The LLM can SEE the chart AND read the structured JSON
// for combined visual + quantitative analysis
```

---

## State Management Across Sessions

```typescript
// Save current chart state (includes all options, data, and viewport)
const state = chart.saveState();

// Later, restore everything
const newChart = createChart('#container');
newChart.loadState(state);
```

The saved state includes: chart options, zoom level, scroll position, all bar data, volume sub-pane settings, and viewport geometry (offsetX, barWidth, priceScale, priceOffset).

---

## Streaming Data for LLM Monitoring

The chart supports high-frequency tick streams for live monitoring:

```typescript
// Fast path for every tick during live streaming
chart.updateLastBarFast(currentCandle);

// Periodically call chart.render() to refresh axes/grid every 20 ticks
```

See [STREAMING.md](./STREAMING.md) for detailed patterns and throttling strategies.

---

## Quick Reference for LLM Prompts

When instructing an LLM to use Axon Charts, include the following summary:

```
You have access to a chart instance. Use these methods:

READ:
  chart.getContext()         → JSON with visible bars, price range, scales
  chart.getData()            → full Bar[] array
  chart.getBars(N, count)    → range of bars
  chart.getBarAtTime(ts)     → single bar by timestamp

CONTROL:
  chart.execute({ type, ... })
    - { type: 'setPriceScale', mode: 'linear'|'logarithmic'|'percentage' }
    - { type: 'setCrosshair', mode: 'normal'|'magnet'|'none' }
    - { type: 'setReverse', reverse: boolean }
    - { type: 'scrollToTime', time: timestamp }
    - { type: 'fitContent' }
    - { type: 'zoomIn', factor?: number }
    - { type: 'zoomOut', factor?: number }
    - { type: 'setVisibleRange', from: number, to: number }
    - { type: 'setSubPane', id: string, show: boolean }

  chart.setOptions({ ... })   → any ChartOptions field
  chart.addDrawing({ ... })   → persistent annotations

REACT:
  chart.onCrosshairMove = fn     → fires on cursor move
  chart.onBarClick = fn          → fires on bar click
  chart.onVisibleRangeChange = fn → fires on pan/zoom
  chart.onDataUpdate = fn        → fires on data mutation
  chart.onCandleClose = fn       → fires once per candle close

EXPORT:
  chart.toDataURL()           → base64 PNG screenshot
  chart.toBlob()              → Blob (async)
  chart.saveState()           → full state JSON
  chart.loadState(state)      → restore everything
```

---

## Performance Considerations

- `getContext()` returns a new object on every call — cheap
- `execute()` is a thin routing layer — no overhead
- Event callbacks fire on every relevant interaction — keep handlers lightweight
- `toDataURL()` is the most expensive operation (canvas → base64) — debounce to every 500ms
- `getBars()` returns a new array each call — internal array never exposed
- `updateLastBarFast()` uses a lighter render path than `updateLastBar()` for high-frequency streams
