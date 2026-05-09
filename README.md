# Axon Charts

**A fast, lightweight candlestick chart library optimized for AI-driven applications and LLM integration.**

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](package.json)
[![Bundle Size](https://img.shields.io/badge/bundle%20size-21.8%20KB-brightgreen.svg)](dist/chart.js)

## Overview

Axon Charts is a high-performance, minimal-dependency candlestick charting library designed for modern web applications and AI agents. Built with a focus on:

- ⚡ **Performance** — <8ms first render, <0.2ms tick updates
- 🤖 **AI-First** — Native LLM integration with structured context export
- 📦 **Lightweight** — Only 21.8KB gzipped (zero external dependencies)
- 🎨 **Customizable** — 85 configuration options across 13 categories
- 🔒 **Type-Safe** — Full TypeScript support

## Features

### Core Charting
- ✅ Candlestick charts with OHLCV data
- ✅ Volume histogram sub-pane with independent Y-axis (ScalePane architecture)
- ✅ Real-time updates with sub-millisecond rendering
- ✅ Smooth pan and zoom (mouse + touch)
- ✅ Multiple price scales (linear, logarithmic, percentage)
- ✅ Crosshair with magnetic snapping, volume tooltip, full-date labels
- ✅ Auto-scroll with scroll-lock detection
- ✅ Market info header + auto-scaling watermark
- ✅ Percentage mode with 0% reference line and smart formatting

### Sub-Pane Architecture (ScalePane)
- ✅ `ScalePane` abstract class — ready for RSI, MACD, and custom indicators
- ✅ Draggable separator with 6px hit zone and ns-resize cursor
- ✅ Independent Y-axis with zoom/pan and double-click reset
- ✅ `computeValues()` hook — computation cached once per render
- ✅ `getMinVisible()` override for oscillators with negative values
- ✅ Precision auto-detection with explicit and minMove overrides
- ✅ Auto-exposed via `getContext()` for LLM consumption

### Developer Experience
- ✅ Clean, intuitive API
- ✅ Comprehensive configuration system (85 options across 13 categories)
- ✅ Component APIs (priceScale, timeScale, crosshair)
- ✅ Runtime option updates with validation
- ✅ Zero external dependencies

### AI Integration
- ✅ Structured context export (`getContext()`) with configurable data exposure
- ✅ AI agent discovery via `window.__AXON_CHARTS__` global registry
- ✅ Multi-chart support with per-chart IDs (`data-axon-charts-id`)
- ✅ Stealth mode (`context.discoverable: false`) to hide from agents
- ✅ Typed command execution (`execute()`)
- ✅ Event callbacks (`onCrosshairMove`, `onBarClick`, `onVisibleRangeChange`)
- ✅ Screenshot capture (`toDataURL`, `toBlob`)
- ✅ State serialization (`saveState`, `loadState`)

## Installation

```bash
npm install axon-charts
```

## Quick Start

### HTML

```html
<!DOCTYPE html>
<html>
<head>
  <script src="node_modules/axon-charts/dist/chart.js"></script>
  <style>
    #chart { width: 800px; height: 400px; }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    const chart = AxonCharts.createChart('#chart', {
      layout: { background: '#1a1a1a', textColor: '#aaaaaa' },
      grid: { vertLines: { color: '#2a2a2a' }, horzLines: { color: '#2a2a2a' } }
    });

    chart.setData([
      { time: 1704067200000, open: 100, high: 110, low: 90, close: 105, volume: 15000 },
      { time: 1704070800000, open: 105, high: 115, low: 100, close: 110, volume: 22000 },
    ]);
  </script>
</body>
</html>
```

### JavaScript (ES Modules)

```javascript
import { createChart } from 'axon-charts';

const chart = createChart('#chart', { layout: { background: '#1a1a1a' } });
chart.setData(data);
```

## Try It Live

Check out the [interactive demo](demo.html) — explore all 85 settings in real-time.

## API Reference

### Core Methods

```typescript
// Create chart
const chart = AxonCharts.createChart('#container', options);

// Data operations
chart.setData(bars: Bar[]): void
chart.appendBar(bar: Bar): void
chart.updateLastBar(bar: Bar): void
chart.updateLastBarFast(bar: Bar): void   // High-frequency streaming
chart.render(): void

// Lifecycle
chart.resize(width?, height?): void
chart.destroy(): void

// Get context (for AI integration)
const context = chart.getContext(): ChartContext

// Screenshot
chart.toDataURL(): string
chart.toBlob(): Promise<Blob>

// State management
chart.saveState(): ChartState
chart.loadState(state): void

// LLM command execution
chart.execute(command): void

// Events
chart.onCrosshairMove(cb): void
chart.onBarClick(cb): void
chart.onVisibleRangeChange(cb): void
```

### Component APIs

```typescript
// Price Scale API
chart.priceScale().setMode('logarithmic' | 'percentage')
chart.priceScale().setMargins({ top: 0.2, bottom: 0.1 })

// Time Scale API
chart.timeScale().setVisibleRange(fromTimestamp, toTimestamp)
chart.timeScale().fitContent()
chart.timeScale().zoomIn(1.5)

// Crosshair API
chart.crosshairAPI().setMode('magnet')
chart.crosshairAPI().setShowLabels(true)
```

### Configuration

```typescript
chart.setOptions({
  layout: { background: '#1a1a1a', textColor: '#ffffff', fontSize: 14 },
  grid: { show: true, vertLines: { color: '#333333' }, horzLines: { color: '#333333' } },
  crosshair: { mode: 'magnet', showLabels: true, showTooltip: true },
  volume: { show: true, heightPercent: 0.2 },
  market: { baseAsset: 'BTC', quoteAsset: 'USDT', show: true },
  watermark: { text: 'AXON CHARTS', show: true, opacity: 0.05 }
});
```

## Data Format

```typescript
interface Bar {
  time: number;      // Timestamp in milliseconds
  open: number;      // Open price
  high: number;      // High price
  low: number;       // Low price
  close: number;     // Close price
  volume?: number;   // Volume (optional, required for sub-pane)
}
```

## Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Minified bundle | <25 KB gzipped | **21.8 KB gzipped** ✅ |
| First render (500 bars) | <16ms | ~8ms ✅ |
| Live tick update | <2ms | **<0.2ms** 🚀 |
| Mousemove overlay | <1ms | <0.3ms ✅ |
| Memory (5000 bars) | <12 MB | ~4 MB ✅ |

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## License

Apache-2.0 — See [LICENSE](LICENSE) file for details.

## Links

- **Demo:** [Interactive Settings](demo.html)
- **Documentation:** [Full docs](docs.html)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Built with ❤️ for the AI-driven trading community**
