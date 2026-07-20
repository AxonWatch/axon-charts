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
    "id": "ax-a1b2c3", "version": "1.5.3", "totalBars": 5000, "isAutoScrolling": true,
    "market": { "baseAsset": "BTC", "quoteAsset": "USDT", "timeframe": "1m", "source": "Binance" }
  },
  "visibleBars": [ /* OHLCV bars visible on screen */ ],
  "latestBar": { "time": ..., "open": ..., "high": ..., "low": ..., "close": ..., "volume": ... },
  "subPanes": {
    "volume": { "show": true, "heightPercent": 0.2, "scale": 1, "offset": 0 },
    "rsi": {
      "show": true, "heightPercent": 0.15, "scale": 1, "offset": 0,
      "values": [52.3, 54.1, 56.7, ...],  // RSI values for visible bars (null where not yet defined)
      "latestValue": 56.7
    },
    "macd": {
      "show": true, "values": [0.523, 0.518, ...], "latestValue": 0.518
    }
  },
  "drawings": [
    {
      "id": "pos-1", "type": "position", "color": "#3b82f6",
      "text": null, "time": 1704067200000, "price": 42150.5,
      "time2": null, "price2": null,
      "data": { "side": "long", "qty": 0.5, "sl": 41800, "tp": 43000 }
    },
    {
      "id": "tl-1", "type": "trendline", "color": "#3b82f6",
      "text": "Support", "time": 1704067200000, "price": 42150,
      "time2": 1704153600000, "price2": 42500,
      "data": { "extend": "right", "lineStyle": "dashed" }
    }
  ],
  "overlays": {
    "sma-20": {
      "id": "sma-20", "type": "SMAOverlay",
      "options": { "period": 20, "color": "#3b82f6" },
      "values": [42150, 42155, 42160, ...],
      "latestValue": 42160
    },
    "ema-12": {
      "id": "ema-12", "type": "EMAOverlay",
      "options": { "period": 12, "color": "#f59e0b" },
      "values": [42148, 42152, ...],
      "latestValue": 42152
    },
    "bb-20-2": {
      "id": "bb-20-2", "type": "BollingerBandsOverlay",
      "options": { "period": 20, "numStdDev": 2, "color": "#3b82f6" },
      "values": [42150, 42155, ...],
      "latestValue": 42155
    }
  }
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
- **Sub-pane indicator values** (RSI, MACD, Stochastic, etc.) for the visible bars + latest value
- **All drawings** (positions, trendlines, boxes, etc.) with their anchors, colors, and type-specific data (side, qty, SL/TP, etc.)
- **All overlay indicators** (SMA, EMA, Bollinger Bands, VWAP, Ichimoku) with their computed values for the visible bars + latest value

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
  chart.addDrawing({ ... })   → persistent annotations (arrow, label, hline, vline, position, position_closed, order, trendline, box, fib_retracement, measure, text, highlighter, custom)
  chart.registerDrawingType(type, renderer) → add custom drawing type

  Position drawing example:
    chart.addDrawing({
      id: 'pos-1', type: 'position',
      time: 1704067200000, price: 42150.5, color: '#3b82f6',
      data: { side: 'long', qty: 0.5, sl: 41800, tp: 43000 }
    })
    → renders entry marker, dashed entry line, optional SL/TP lines,
      and a live PnL label on the right axis (updates every tick)

  Closed position example:
    chart.addDrawing({
      id: 'posc-1', type: 'position_closed',
      time: 1704067200000, price: 42150.5,
      time2: 1704153600000, price2: 42850.0,
      color: '#3b82f6', data: { side: 'long', qty: 0.5 }
    })
    → entry + exit markers, connector, realized PnL label (green/red)

  Order drawing example:
    chart.addDrawing({
      id: 'ord-1', type: 'order',
      time: 1704067200000, price: 42150.5,
      data: { side: 'long', qty: 0.5, kind: 'limit' }
    })
    → dashed line at order price + "BUY LIMIT 0.5 @ 42150.5" label

  Trendline example:
    chart.addDrawing({
      id: 'tl-1', type: 'trendline',
      time: ..., price: 42150, time2: ..., price2: 42500,
      color: '#3b82f6', text: 'Support',
      data: { extend: 'right', lineStyle: 'dashed' }
    })
    → 2-point line with optional extend (left/right/both) + end label

  Box example:
    chart.addDrawing({
      id: 'box-1', type: 'box',
      time: ..., price: 42800, time2: ..., price2: 42100,
      color: '#ef4444', text: 'Supply',
      data: { fill: 'rgba(239,68,68,0.12)', lineStyle: 'dashed' }
    })
    → 2-point rectangle (opposite corners) with fill + optional label

  Fib retracement example:
    chart.addDrawing({
      id: 'fib-1', type: 'fib_retracement',
      time: ..., price: 41800, time2: ..., price2: 42900,
      color: '#3b82f6', text: 'Fib Retracement'
    })
    → 7 horizontal levels (0/23.6/38.2/50/61.8/78.6/100%) with
      right-axis price labels; tier-colored green/amber/red

  Measure example:
    chart.addDrawing({
      id: 'meas-1', type: 'measure',
      time: ..., price: 42150, time2: ..., price2: 42850,
      color: '#3b82f6', data: { lineStyle: 'dashed' }
    })
    → connector line + 2-line label: "+700.0 (+1.66%)" / "10 bars"

  Text example:
    chart.addDrawing({
      id: 'note-1', type: 'text',
      time: ..., price: 42800, color: '#f59e0b',
      data: { lines: ['Earnings release', 'Q3 2026'] }
    })
    → multi-line annotation box (richer than 'label')

  Highlighter example:
    chart.addDrawing({
      id: 'hl-1', type: 'highlighter',
      time: ..., time2: ..., color: '#f59e0b', text: 'Earnings Q3',
      data: { fill: 'rgba(245,158,11,0.10)', lineStyle: 'dashed' }
    })
    → vertical band spanning full chart height between two times

REACT:
  chart.onCrosshairMove = fn     → fires on cursor move
  chart.onBarClick = fn          → fires on bar click
  chart.onVisibleRangeChange = fn → fires on pan/zoom
  chart.onDataUpdate = fn        → fires on data mutation
  chart.onCandleClose = fn       → fires once per candle close

EXPORT:
  chart.toDataURL()           → base64 PNG screenshot
  chart.toBlob()              → Blob (async)
  chart.saveState()           → full state JSON (options, data, viewport, drawings, overlays)
  chart.loadState(state)      → restore everything (accepts any 1.x schema version)
  chart.resetState(opts?)     → clear drawings + overlays (preserves options/data/viewport)
  migrateSnapshot(oldState)  → upgrade old snapshot to current schema
```

---

## Performance Considerations

- `getContext()` returns a new object on every call — cheap
- `execute()` is a thin routing layer — no overhead
- Event callbacks fire on every relevant interaction — keep handlers lightweight
- `toDataURL()` is the most expensive operation (canvas → base64) — debounce to every 500ms
- `getBars()` returns a new array each call — internal array never exposed
- `updateLastBarFast()` uses a lighter render path than `updateLastBar()` for high-frequency streams
