# Contributing to Axon Charts

Thank you for considering contributing! This document outlines the guidelines.

## Code of Conduct

Be respectful, constructive, and professional. This is an open-source project and we value every contributor.

## Development Setup

1. Clone the repo
2. `npm install`
3. `npm run build` — builds `dist/chart.js`
4. Open `test-settings-comprehensive.html` in a browser for manual testing

## Project Structure

```
src/
  index.ts          — Public entry point (exports createChart, Chart)
  types/index.ts    — All TypeScript interfaces and types
  core/             — Chart class, Renderer, DataManager, Layout constants
  ui/               — Crosshair overlay, Axes (grid + labels)
  interaction/      — EventManager (mouse/touch handling)
  utils/            — Projection, formatter, math, validation, merge utilities
  api/              — Public API classes (PriceScaleAPI, TimeScaleAPI, CrosshairAPI)
```

## Pull Request Process

1. Work on the `dev` branch
2. Ensure `npm run build` succeeds with no errors
3. Verify the test HTML page shows no console errors
4. Update docs if your change affects the public API or options

## Coding Standards

- TypeScript, ES2020 target, ES module format
- No external runtime dependencies
- Keep bundle size under 25KB gzipped
- All canvas rendering uses sub-pixel precision (no `Math.round` in coordinate calculations)
- New options must have validation in `src/utils/validation.ts`

## Testing

- Manual testing via `test-settings-comprehensive.html`
- For streaming: use the Tick Stream button (20 ticks/sec sim)
- Test edge cases: empty data, single bar, rapid appends, window resize

## License

By contributing, you agree that your contributions will be licensed under Apache-2.0.
