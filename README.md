# Axon Charts

**A fast, lightweight candlestick chart library optimized for AI-driven applications and LLM integration.**

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](package.json)
[![Bundle Size](https://img.shields.io/badge/bundle%20size-17%20KB-brightgreen.svg)](dist/chart.js)

## Overview

Axon Charts is a high-performance, minimal-dependency candlestick charting library designed for modern web applications. Built with a focus on:

- ⚡ **Performance** - <8ms first render, <0.2ms tick updates
- 🤖 **AI-First** - Native LLM integration with structured context export
- 📦 **Lightweight** - Only 17KB minified (no external dependencies)
- 🎨 **Customizable** - Comprehensive configuration API
- 🔒 **Type-Safe** - Full TypeScript support

## Features

### Core Charting
- ✅ Candlestick charts with OHLCV data
- ✅ Real-time updates with sub-millisecond rendering
- ✅ Smooth pan and zoom (mouse + touch)
- ✅ Multiple price scales (linear/logarithmic)
- ✅ Crosshair with magnetic snapping
- ✅ Auto-scroll with scroll-lock detection

### Developer Experience
- ✅ Clean, intuitive API
- ✅ Comprehensive configuration system
- ✅ Component APIs (priceScale, timeScale, crosshair)
- ✅ Runtime option updates
- ✅ Input validation with clear error messages
- ✅ Zero dependencies (except build tools)

### AI Integration
- ✅ Structured context export (`getContext()`)
- ✅ Exposed projection utilities
- ✅ One-liner data operations
- ✅ Designed for LLM reasoning

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
      layout: {
        background: '#1a1a1a',
        textColor: '#aaaaaa'
      },
      grid: {
        show: true,
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' }
      }
    });

    // Load data
    chart.setData([
      { time: 1704067200000, open: 100, high: 110, low: 90, close: 105 },
      { time: 1704070800000, open: 105, high: 115, low: 100, close: 110 },
      // ... more bars
    ]);

    // Real-time update
    chart.updateLastBar({ time: Date.now(), open: 110, high: 120, low: 108, close: 115 });
  </script>
</body>
</html>
```

### JavaScript (ES Modules)

```javascript
import { createChart } from 'axon-charts';

const chart = createChart('#chart', {
  layout: { background: '#1a1a1a' }
});

chart.setData(data);
```

## API Reference

### Core Methods

```typescript
// Create chart
const chart = AxonCharts.createChart('#container', options);

// Data operations
chart.setData(bars: Bar[]): void
chart.appendBar(bar: Bar): void
chart.updateLastBar(bar: Bar): void
chart.render(): void

// Lifecycle
chart.resize(width?: number, height?: number): void
chart.destroy(): void

// Get context (for AI integration)
const context = chart.getContext(): ChartContext
```

### Component APIs

```typescript
// Price Scale API
chart.priceScale().setMode('logarithmic')
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
  layout: {
    background: '#1a1a1a',
    textColor: '#ffffff',
    fontSize: 14
  },
  grid: {
    show: true,
    vertLines: { color: '#333333', width: 1 },
    horzLines: { color: '#333333', width: 1 }
  },
  crosshair: {
    mode: 'magnet',
    showLabels: true,
    showTooltip: true
  }
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
  volume?: number;   // Volume (optional)
}
```

## Options

All options are optional with sensible defaults:

```typescript
{
  // Layout
  layout: {
    width: number | 'auto',
    height: number | 'auto',
    background: string,
    textColor: string,
    fontSize: number,
    fontFamily: string
  },

  // Grid
  grid: {
    show: boolean,
    vertLines: { show, color, width },
    horzLines: { show, color, width }
  },

  // Price Scale
  priceScale: {
    mode: 'linear' | 'logarithmic',
    scaleMargins: { top: number, bottom: number },
    priceFormat: { type, precision, minMove }
  },

  // Time Scale
  timeScale: {
    rightOffset: number,
    barSpacing: number,
    minBarSpacing: number,
    maxBarSpacing: number,
    visible: boolean
  },

  // Crosshair
  crosshair: {
    mode: 'normal' | 'magnet' | 'none',
    showLabels: boolean,
    showTooltip: boolean,
    vertLine: { color, width, style },
    horzLine: { color, width, style }
  },

  // Behavior
  behavior: {
    dragToZoom: boolean,
    scrollToZoom: boolean,
    pinchToZoom: boolean,
    panOnMouseDrag: boolean,
    dragPriceScale: boolean,
    autoScroll: boolean
  }
}
```

## Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Minified bundle | <25 KB | **17 KB** ✅ |
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

Apache-2.0 - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please see our contributing guidelines.

## Changelog

### v1.0.0 (2025-04-29)
- 🎉 Initial release as Axon Charts
- ✅ Complete Phase 1: Core rendering engine
- ✅ Complete Phase 1.5: Settings & configuration
- ✅ 3 component APIs (priceScale, timeScale, crosshair)
- ✅ Runtime configuration with validation
- ✅ Comprehensive grid styling
- ✅ Log/linear price scales
- ✅ All behavior flags implemented

## Acknowledgments

Originally developed as Kybos Core, now rebranded as Axon Charts with Apache 2.0 licensing for open-source community use.

## Links

- **Documentation:** [Full docs](docs/)
- **GitHub:** [axon-charts/axon-charts](https://github.com/axon-charts/axon-charts)
- **Issues:** [Bug reports](https://github.com/axon-charts/axon-charts/issues)

---

**Built with ❤️ for the AI-driven trading community**
