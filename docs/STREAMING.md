# Streaming Price Data Guide

Axon Charts works with both pre-aggregated kline data and raw price tick streams — no special "mode" flag needed. The same `updateLastBar()` method handles both.

## How It Works

| Data Type | What You Send | What the Library Does |
|-----------|---------------|-----------------------|
| **Kline / OHLC** | Pre-closed candles `{time, open, high, low, close}` | Direct `updateLastBar()` — appends new candles, renders immediately |
| **Raw Tick Stream** | Individual `{price, timestamp}` | You maintain the current candle in memory, call `updateLastBar()` on every tick |

The `DataManager.updateLastBar()` method automatically detects whether the incoming bar belongs to a new time period (appends a new candle) or the current period (updates the visible high/low/close).

## Basic Streaming Pattern

```typescript
let currentCandle: Bar | null = null;
const TIMEFRAME_MS = 60000; // 1 minute

function onPriceTick(price: number, timestamp = Date.now(), volume = 0) {
  // Round timestamp to the start of the current candle period
  const candleStart = Math.floor(timestamp / TIMEFRAME_MS) * TIMEFRAME_MS;

  if (!currentCandle || currentCandle.time !== candleStart) {
    // Close the previous candle — push it as a completed bar
    if (currentCandle) {
      chart.appendBar(currentCandle);
    }
    // Open a new candle at the current price
    currentCandle = {
      time: candleStart,
      open: price,
      high: price,
      low: price,
      close: price,
      volume
    };
  } else {
    // Update the live candle
    currentCandle.high = Math.max(currentCandle.high, price);
    currentCandle.low = Math.min(currentCandle.low, price);
    currentCandle.close = price;
    currentCandle.volume = (currentCandle.volume || 0) + volume;
  }

  chart.updateLastBar(currentCandle);
}
```

## Performance: `updateLastBarFast()` for High-Frequency Streams

For tick streams with 10+ ticks/second, use `updateLastBarFast()` instead of `updateLastBar()`. It skips axis re-measurement, grid redraw, and full buffer re-render — only the last candle is re-drawn in the offscreen buffer, then composited to screen.

```typescript
// Fast path for every tick during live streaming
chart.updateLastBarFast(currentCandle);
```

**When a new candle period starts**, `updateLastBarFast()` automatically falls back to a full render (including auto-scroll).

**Periodically call `chart.render()`** to refresh axes/grid/price range, for example every 20 ticks, or once per second:

```typescript
let tickCount = 0;
function onPriceTick(price, timestamp) {
  // ... candle aggregation logic ...
  chart.updateLastBarFast(currentCandle);
  
  if (++tickCount % 20 === 0) {
    chart.render(); // Full render keeps axes/grid in sync
  }
}
```

## Performance Comparison

| Update Method | Operations per Call | Use When |
|--------------|-------------------|----------|
| `updateLastBar()` | Full render: price scale, all candles, grid, axes, current price line, watermark, viewport composition, crosshair | Data frequency < 5 updates/sec, or after candle close |
| `updateLastBarFast()` | Single candle re-draw + viewport composite only | High-frequency streams (10-1000 ticks/sec) |

## Complete Example

```typescript
const chart = AxonCharts.createChart('#container', {
  layout: { background: '#1a1a1a' },
  timeScale: { barSpacing: 11 }
});

let currentCandle: Bar | null = null;
const TIMEFRAME_MS = 60000;
let tickCount = 0;

const ws = new WebSocket('wss://api.example.com/trades?symbol=BTCUSDT');
ws.onmessage = (event) => {
  const trade = JSON.parse(event.data);
  const timestamp = trade.timestamp || Date.now();
  const price = parseFloat(trade.price);
  const volume = parseFloat(trade.quantity || 0);

  const candleStart = Math.floor(timestamp / TIMEFRAME_MS) * TIMEFRAME_MS;

  if (!currentCandle || currentCandle.time !== candleStart) {
    if (currentCandle) {
      chart.appendBar(currentCandle);
    }
    currentCandle = {
      time: candleStart,
      open: price,
      high: price,
      low: price,
      close: price,
      volume
    };
  } else {
    currentCandle.high = Math.max(currentCandle.high, price);
    currentCandle.low = Math.min(currentCandle.low, price);
    currentCandle.close = price;
    currentCandle.volume = (currentCandle.volume || 0) + volume;
  }

  // Fast path for every tick
  chart.updateLastBarFast(currentCandle);

  // Full render every 20 ticks
  if (++tickCount % 20 === 0) {
    chart.render();
  }
};
```

## Throttling

If the stream exceeds 100 ticks/second, consider throttling `updateLastBarFast()` to every 2-3 ticks:

```typescript
let tickCounter = 0;
ws.onmessage = (event) => {
  // ... candle aggregation ...
  if (++tickCounter % 3 === 0) {
    chart.updateLastBarFast(currentCandle);
  }
};
```

Or use a time-based throttle:

```typescript
let lastUpdate = 0;
ws.onmessage = (event) => {
  // ... candle aggregation ...
  const now = Date.now();
  if (now - lastUpdate > 50) { // max 20 updates/sec
    chart.updateLastBarFast(currentCandle);
    lastUpdate = now;
  }
};
```

## Initial History Loading

Always load historical kline data before starting the tick stream:

```typescript
// 1. Load history
const response = await fetch('https://api.example.com/klines?symbol=BTCUSDT&interval=1m&limit=300');
const bars = await response.json();
chart.setData(bars);

// 2. Start streaming
currentCandle = { ...bars[bars.length - 1] }; // Use last bar as starting point
const ws = new WebSocket('wss://api.example.com/trades?symbol=BTCUSDT');
```

## API Reference

- `chart.updateLastBar(bar)` — Full render. Handles both new candles (append) and live updates.
- `chart.updateLastBarFast(bar)` — Lightweight update. Re-draws only the last candle. Falls back to full render on new candle.
- `chart.appendBar(bar)` — Push a completed candle. Triggers auto-scroll.
- `chart.setData(bars)` — Replace all data. Use for initial history load.
- `chart.render()` — Full re-render including axes, grid, price scale.
