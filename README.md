     1|# Axon Charts
     2|
     3|**A fast, lightweight candlestick chart library optimized for AI-driven applications and LLM integration.**
     4|
     5|[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
     6|[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](package.json)
     7|[![Bundle Size](https://img.shields.io/badge/bundle%20size-24.9%20KB-brightgreen.svg)](dist/chart.js)
     8|
     9|## Overview
    10|
    11|Axon Charts is a high-performance, minimal-dependency candlestick charting library designed for modern web applications and AI agents. Built with a focus on:
    12|
    13|- ⚡ **Performance** — <8ms first render, <0.2ms tick updates
    14|- 🤖 **AI-First** — Native LLM integration with structured context export
    15|- 📦 **Lightweight** — Only 24.9KB gzipped (zero external dependencies)
    16|- 🎨 **Customizable** — 91 configuration options across 14 categories
    17|- 🔒 **Type-Safe** — Full TypeScript support with zero tsc errors
    18|
    19|## Features
    20|
    21|### Core Charting
    22|- ✅ 6 series types: candlestick, bar, line, area, heiken-ashi, hollow
    23|- ✅ Volume histogram sub-pane with independent Y-axis (ScalePane architecture)
    24|- ✅ Real-time updates with sub-millisecond rendering
    25|- ✅ Smooth pan and zoom (mouse + touch)
    26|- ✅ Multiple price scales (linear, logarithmic, percentage)
    27|- ✅ Crosshair with magnetic snapping, OHLC tooltip, full-date labels
    28|- ✅ Auto-scroll with scroll-lock detection
    29|- ✅ Market info header + auto-scaling watermark
    30|- ✅ Percentage mode with 0% reference line and smart formatting
    31|
    32|### Series Types
    33|- ✅ **Line** — polyline connecting close prices, independent lineColor, latest price pulse animation
    34|- ✅ **Area** — filled polyline with gradient, close markers, latest price marker
    35|- ✅ **Bar (OHLC)** — open notch + high-low stem + close tick
    36|- ✅ **Heiken-Ashi** — smoothed candle averages, single-compute architecture, separate HA price label
    37|- ✅ **Hollow** — trend-colored wick/body with specific rules
    38|- ✅ Runtime type switching via `series.type`
    39|
    40|### LLM & AI Integration
    41|- ✅ Structured context export (`getContext()`) with configurable data exposure
    42|- ✅ AI agent discovery via `window.__AXON_CHARTS__` global registry
    43|- ✅ Multi-chart support with per-chart IDs (`data-axon-charts-id`)
    44|- ✅ Stealth mode (`context.discoverable: false`) to hide from agents
    45|- ✅ Typed command execution (`execute()` with 9 command types)
    46|- ✅ Event callbacks (`onCrosshairMove`, `onBarClick`, `onVisibleRangeChange`, `onDataUpdate`)
    47|- ✅ Screenshot capture (`toDataURL`, `toBlob`)
    48|- ✅ State serialization (`saveState`, `loadState`)
    49|- ✅ Drawing API for persistent annotations
    50|
    51|### Developer Experience
    52|- ✅ Clean, intuitive API with 3 component APIs
    53|- ✅ Comprehensive configuration system (91 options across 14 categories)
    54|- ✅ Runtime option updates with validation
    55|- ✅ Zero external dependencies
    56|
    57|## Installation
    58|
    59|```bash
    60|npm install axon-charts
    61|```
    62|
    63|## Quick Start
    64|
    65|### HTML
    66|
    67|```html
    68|<!DOCTYPE html>
    69|<html>
    70|<head>
    71|  <script src="node_modules/axon-charts/dist/chart.js"></script>
    72|  <style>
    73|    #chart { width: 800px; height: 400px; }
    74|  </style>
    75|</head>
    76|<body>
    77|  <div id="chart"></div>
    78|  <script>
    79|    const chart = AxonCharts.createChart('#chart', {
    80|      layout: { background: '#1a1a1a', textColor: '#aaaaaa' },
    81|      grid: { vertLines: { color: '#2a2a2a' }, horzLines: { color: '#2a2a2a' } }
    82|    });
    83|
    84|    chart.setData([
    85|      { time: 1704067200000, open: 100, high: 110, low: 90, close: 105, volume: 15000 },
    86|      { time: 1704070800000, open: 105, high: 115, low: 100, close: 110, volume: 22000 },
    87|    ]);
    88|  </script>
    89|</body>
    90|</html>
    91|```
    92|
    93|### JavaScript (ES Modules)
    94|
    95|```javascript
    96|import { createChart } from 'axon-charts';
    97|
    98|const chart = createChart('#chart', { layout: { background: '#1a1a1a' } });
    99|chart.setData(data);
   100|```
   101|
   102|## Try It Live
   103|
   104|Check out the [interactive demo](html/demo.html) — explore all 91 settings in real-time.
   105|
   106|## API Reference
   107|
   108|### Core Methods
   109|
   110|```typescript
   111|// Create chart
   112|const chart = AxonCharts.createChart('#container', options);
   113|
   114|// Data operations
   115|chart.setData(bars: Bar[]): void
   116|chart.appendBar(bar: Bar): void
   117|chart.updateLastBar(bar: Bar): void
   118|chart.updateLastBarFast(bar: Bar): void   // High-frequency streaming
   119|
   120|// Lifecycle
   121|chart.resize(width?, height?): void
   122|chart.destroy(): void
   123|
   124|// Get context (for AI integration)
   125|const context = chart.getContext(): ChartContext
   126|
   127|// Screenshot
   128|chart.toDataURL(): string
   129|chart.toBlob(): Promise<Blob>
   130|
   131|// State management
   132|chart.saveState(): ChartState
   133|chart.loadState(state): void
   134|
   135|// LLM command execution
   136|chart.execute(command): void
   137|
   138|// Drawing API
   139|chart.addDrawing(drawing): void
   140|chart.getDrawings(): Drawing[]
   141|
   142|// Events
   143|chart.onCrosshairMove = fn
   144|chart.onBarClick = fn
   145|chart.onVisibleRangeChange = fn
   146|chart.onDataUpdate = fn
   147|```
   148|
   149|### Component APIs
   150|
   151|```typescript
   152|chart.priceScale().setMode('logarithmic' | 'percentage')
   153|chart.priceScale().setMargins({ top: 0.2, bottom: 0.1 })
   154|chart.priceScale().setReverse(true)
   155|
   156|chart.timeScale().setVisibleRange(fromTimestamp, toTimestamp)
   157|chart.timeScale().fitContent()
   158|chart.timeScale().zoomIn(1.5)
   159|
   160|chart.crosshairAPI().setMode('magnet')
   161|chart.crosshairAPI().setShowLabels(true)
   162|```
   163|
   164|### Configuration
   165|
   166|```typescript
   167|chart.setOptions({
   168|  layout: { background: '#1a1a1a', textColor: '#ffffff', fontSize: 14 },
   169|  grid: { show: true, vertLines: { color: '#333333' }, horzLines: { color: '#333333' } },
   170|  series: { type: 'line', lineColor: '#FF6B35', showMarkers: true },
   171|  crosshair: { mode: 'magnet', showLabels: true, showTooltip: true },
   172|  volume: { show: true, heightPercent: 0.2 },
   173|  market: { baseAsset: 'BTC', quoteAsset: 'USDT', show: true },
   174|  watermark: { text: 'AXON CHARTS', show: true, opacity: 0.05 }
   175|});
   176|```
   177|
   178|## Data Format
   179|
   180|```typescript
   181|interface Bar {
   182|  time: number;      // Timestamp in milliseconds
   183|  open: number;      // Open price
   184|  high: number;      // High price
   185|  low: number;       // Low price
   186|  close: number;     // Close price
   187|  volume?: number;   // Volume (optional, required for sub-pane)
   188|}
   189|```
   190|
   191|## Performance
   192|
   193|| Metric | Target | Actual |
   194||--------|--------|--------|
   195|| Minified bundle | <25 KB gzipped | **24.9 KB gzipped** ✅ |
   196|| First render (500 bars) | <16ms | ~8ms ✅ |
   197|| Live tick update | <2ms | **<0.2ms** 🚀 |
   198|| Mousemove overlay | <1ms | <0.3ms ✅ |
   199|| Memory (5000 bars) | <12 MB | ~4 MB ✅ |
   200|
   201|## Browser Support
   202|
   203|- ✅ Chrome 90+
   204|- ✅ Firefox 88+
   205|- ✅ Safari 14+
   206|- ✅ Edge 90+
   207|
   208|## License
   209|
   210|Apache-2.0 — See [LICENSE](LICENSE) file for details.
   211|
   212|## Links
   213|
   214|- **Demo:** [Interactive Settings](html/demo.html)
   215|- **Documentation:** [docs/INDEX.md](docs/INDEX.md)
   216|- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
   217|- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
   218|
   219|---
   220|
   221|**Built with ❤️ for the AI-driven trading community**
   222|