# Contributing to Axon Charts

Thank you for considering contributing! This document outlines the guidelines.

## Code of Conduct

Be respectful, constructive, and professional. This is an open-source project and we value every contributor.

## Development Setup

1. Clone the repo
2. `npm install`
3. `npm run build` -- builds `dist/chart.js`
4. Open `html/demo.html` in a browser for manual testing

## Project Structure

```
src/              -- Source code (index.ts, core, ui, series, subpanes, utils, api)
docs/             -- Public documentation
  INDEX.md        -- Docs navigation
  SETTINGS.md     -- Options reference (91 options)
  api/README.md   -- API surface reference
  LLM.md          -- LLM integration guide
  EXAMPLES.md     -- Agent integration patterns
  STREAMING.md    -- Streaming patterns
html/             -- GitHub Pages hosted files (demos, examples, docs viewer)
.guide/           -- Internal planning docs (not part of the npm package)
```

## Pull Request Process

1. Work on the `dev` branch
2. Ensure `npm run build` succeeds with no errors
3. Verify `html/demo.html` shows no console errors
4. Update docs if your change affects the public API or options

## Coding Standards

- TypeScript, ES2020 target, ES module format
- No external runtime dependencies
- Keep bundle size minimal (currently ~24.9KB gzipped)
- All canvas rendering uses sub-pixel precision (no `Math.round` in coordinate calculations)
- New options must have validation in `src/utils/validation.ts`
- New public API additions must be declared in the `IChart` interface in `src/types/index.ts`

## Testing

- Manual testing via `html/demo.html`
- For streaming: use the Tick Stream button (20 ticks/sec sim)
- Test edge cases: empty data, single bar, rapid appends, window resize
- Verify TypeScript: `npx tsc --noEmit`

## Documentation

All public-facing documentation lives in `docs/`. Internal planning and research goes in `.guide/`.
When adding a new feature, update the relevant docs file:
- New option -> `docs/SETTINGS.md`
- New public method -> `docs/api/README.md`
- New LLM-facing capability -> `docs/LLM.md`

## License

By contributing, you agree that your contributions will be licensed under Apache-2.0.
