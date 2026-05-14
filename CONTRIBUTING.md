     1|# Contributing to Axon Charts
     2|
     3|Thank you for considering contributing! This document outlines the guidelines.
     4|
     5|## Code of Conduct
     6|
     7|Be respectful, constructive, and professional. This is an open-source project and we value every contributor.
     8|
     9|## Development Setup
    10|
    11|1. Clone the repo
    12|2. `npm install`
    13|3. `npm run build` — builds `dist/chart.js`
    14|4. Open `html/demo.html` in a browser for manual testing
    15|
    16|## Project Structure
    17|
    18|```
    19|src/              — Source code (index.ts, core, ui, series, subpanes, utils, api)
    20|docs/             — Public documentation
    21|  INDEX.md        — Docs navigation
    22|  SETTINGS.md     — Options reference
    23|  api/README.md   — API surface reference
    24|  LLM.md          — LLM integration guide
    25|  EXAMPLES.md     — Agent integration patterns
    26|  STREAMING.md    — Streaming patterns
    27|.guide/           — Internal planning docs (not public)
    28|```
    29|
    30|## Pull Request Process
    31|
    32|1. Work on the `dev` branch
    33|2. Ensure `npm run build` succeeds with no errors
    34|3. Verify the test HTML page shows no console errors
    35|4. Update docs if your change affects the public API or options
    36|
    37|## Coding Standards
    38|
    39|- TypeScript, ES2020 target, ES module format
    40|- No external runtime dependencies
    41|- Keep bundle size under 25KB gzipped
    42|- All canvas rendering uses sub-pixel precision (no `Math.round` in coordinate calculations)
    43|- New options must have validation in `src/utils/validation.ts`
    44|
    45|## Testing
    46|
    47|- Manual testing via `html/demo.html`
    48|- For streaming: use the Tick Stream button (20 ticks/sec sim)
    49|- Test edge cases: empty data, single bar, rapid appends, window resize
    50|
    51|## License
    52|
    53|By contributing, you agree that your contributions will be licensed under Apache-2.0.
    54|