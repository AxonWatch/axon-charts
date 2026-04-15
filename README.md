# Kybos Core

A fast, small, LLM-friendly candlestick chart library built with TypeScript and zero dependencies.

## Features

**Phase 1 Implementation (Complete)**
- ✅ Modular TypeScript architecture
- ✅ Dual-canvas rendering with offscreen buffer
- ✅ Pan and zoom interactions
- ✅ Crosshair with OHLC tooltip
- ✅ Nice-tick price axis algorithm
- ✅ Dynamic time axis with interval snapping
- ✅ Touch support (pinch-zoom, pan)
- ✅ Auto-scroll with scroll-lock detection
- ✅ Data limits (maxBars configuration)
- ✅ Buffer desync fix (dynamic sizing)
- ✅ **Bundle size: 17KB minified** (target: <25KB)

## Installation

```bash
npm install
npm run build
```

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    #chart { width: 800px; height: 400px; }
  </style>
</head>
<body>
  <div id="chart"></div>

  <script type="module">
    import { createChart } from './dist/chart.js';

    const chart = createChart('#chart', {
      width: 'auto',
      height: 'auto',
      timeframe: 60,
      maxBars: 5000,
      colors: {
        background: '#1a1a1a',
        grid: '#2a2a2a',
        up: '#22c55e',
        down: '#ef4444',
        text: '#aaaaaa',
        crosshair: '#555555'
      },
      rightGap: 80,
      autoScroll: true,
      baseBarWidth: 11
    });

    // Set data
    chart.setData([
      { time: 1712524800000, open: 100, high: 105, low: 98, close: 103 },
      { time: 1712524860000, open: 103, high: 107, low: 102, close: 105 },
      // ... more bars
    ]);

    // Update live bar
    chart.updateLastBar({
      time: 1712524860000,
      open: 103,
      high: 107,
      low: 102,
      close: 106
    });
  </script>
</body>
</html>
```

## API Reference

### Initialization

```typescript
const chart = createChart(container, options);
```

**Options:**
- `width`: number | 'auto' - Chart width (default: 'auto')
- `height`: number | 'auto' - Chart height (default: 'auto')
- `timeframe`: number - Seconds per bar (default: 60)
- `maxBars`: number - Maximum bars to keep (default: 5000)
- `colors`: ChartColors - Color scheme
- `rightGap`: number - Right margin in pixels (default: 80)
- `autoScroll`: boolean - Enable auto-scroll (default: true)
- `baseBarWidth`: number - Base bar width in pixels (default: 11)

### Data Methods

```typescript
// Set all data
chart.setData(bars: Bar[])

// Append a new bar
chart.appendBar(bar: Bar)

// Update the last bar (live updates)
chart.updateLastBar(bar: Bar)

// Get data manager
chart.dataManager.getData(): Bar[]
```

### Viewport Methods

```typescript
// Check if auto-scroll is enabled
chart.isAutoScrolling(): boolean

// Scroll to latest bar
chart.scrollToLatest(): void

// Resize chart
chart.resize(width?: number, height?: number): void
```

### Cleanup

```typescript
chart.destroy(): void
```

## Data Format

```typescript
interface Bar {
  time: number;      // Unix timestamp in milliseconds
  open: number;      // Open price
  high: number;      // High price
  low: number;       // Low price
  close: number;     // Close price
  volume?: number;   // Optional volume
}
```

## Architecture

### Module Structure

```
/src
  /core
    chart.ts         - Main Chart class
    data.ts          - DataManager for data handling
    renderer.ts      - Renderer for canvas operations
  /ui
    crosshair.ts     - Crosshair overlay with OHLC tooltip
    axes.ts          - Price and time axis rendering
  /interaction
    events.ts        - Mouse and touch event handling
  /utils
    math.ts          - Nice-tick algorithm and utilities
  /types
    index.ts         - TypeScript type definitions
  /dist
    chart.js         - Bundled ES module output
```

### Canvas Layers

1. **Background Canvas** - Grid, time labels (rarely redrawn)
2. **Main Canvas** - Candlesticks via buffer (redrawn on pan/zoom)
3. **Overlay Canvas** - Crosshair + tooltip (redrawn on mousemove)

## Performance

- **First render (300 bars)**: <16ms (60fps)
- **Tick update**: <2ms
- **Mousemove overlay**: <1ms
- **Memory (5000 bars)**: <5MB

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Serve demo
npm run serve

# Type check
npm run typecheck
```

## Roadmap

See [candlestick-library-roadmap.md](./candlestick-library-roadmap.md) for the complete implementation plan.

**Phase 2** (Next):
- Public API surface
- Event subscriptions
- Viewport methods (scrollToTime, setZoom, fitContent)

**Phase 3** (Future):
- Drawing primitives (trendlines, rectangles, Fibonacci)
- Drawing management API
- Serialization/persistence

**Phase 4** (Future):
- Line series (indicators)
- Histogram series (volume)
- Band series (Bollinger Bands)

**Phase 5** (Future):
- LLM integration helpers
- Chart context export
- Screenshot/export

**Phase 6** (Future):
- Built-in indicators (SMA, EMA, RSI, MACD)
- Custom indicator registration

## License

MIT

## Contributing

This library is designed for LLM-first development. The API surface is kept simple and predictable to make it easy for language models to use correctly.

When adding new features:
1. Keep the bundle size under 25KB minified
2. Add TypeScript types
3. Update this README
4. Test performance with `performance.now()`
5. Ensure mobile compatibility
