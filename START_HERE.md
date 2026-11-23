# Getting started with Compass

See the [README](README.md) to run the map locally and [AGENTS.md](AGENTS.md) for the contributor workflow.

## Next contributor task

Returning from a Project to a Coven with 128 Projects exceeded the [100 ms desktop budget](docs/map-performance.md#november-23-integrated-drawer). Take this work on [#40](https://github.com/OpenCoven/coven-compass/issues/40).

1. **Reproduce.** Start from current main in a separate worktree. Run the [six-cell browser workload](docs/map-performance.md#reproduction), then `python3 scripts/check-overview-budget.py <matrix-directory>`. Retain the first failed cell and its renderer profile.
2. **Compare.** The maintainer’s local candidate `c710b307ffca1d09117574882e887d13981d4c7f` batches label measurements and reuses the overview fit in `dist/index.html`. Compare it with its original base `64ad9db` and port the measured changes. If the candidate is absent from your clone, use the new baseline to identify the slow path and request the patch on #40.
3. **Qualify.** Run two complete candidate matrices. Check Project selection, keyboard focus, compact task captions and Trace replay in Chromium and WebKit. Link the revisions, ranges and profiles on #40 before requesting merge.

For a different lane, use the [implementation plan’s issue and owner table](docs/handoff/05-implementation-plan.md#current-work-and-acceptance). For a code change, find the editable source below, run its focused check, then run `node scripts/verify-all.mjs` and `node scripts/verify-all.mjs --check`. Serve `dist/` and exercise the changed interaction in a browser.

## Where to make a change

| Change | Editable source | Focused check |
| --- | --- | --- |
| Project and mission navigation | `dist/mission-navigation.js`, `dist/atlas-ui.js`, and their app bindings in `dist/index.html` | `node --test tests/navigation.test.cjs tests/mission-interactions.test.cjs` |
| Map placement and camera | `src/atlas-layout.ts`, `src/atlas-viewport.ts` | `node --test tests/atlas-layout.test.cjs tests/atlas-viewport.test.cjs` |
| Mobile controls and focus | `dist/mobile-ui.js`, `dist/mobile-interactions.js`, `dist/atlas.css` | `node --test tests/mobile-*.test.cjs` |

## Migrating a module to TypeScript

The simulation model, atlas layout, crown rendering, annotation placement and viewport geometry are authored in `src/simulation-model.ts`, `src/atlas-layout.ts`, `src/atlas-crown.ts`, `src/atlas-presentation.ts` and `src/atlas-viewport.ts`. The browser and Node tests consume their generated classic scripts in `dist/`. From the repository root, install the pinned development compiler once and run the following after editing a typed module.

```sh
npm --prefix src ci
npm --prefix src run build
node scripts/verify-all.mjs --check
```

Migrate one module with its callers. The navigation codec in `dist/mission-navigation.js` is a candidate for a future migration. Its route and replay behavior is covered by `tests/navigation.test.cjs`. Place a `// @generated from src/<module>.ts` comment immediately before the first emitted statement so verification can detect orphaned scripts. Type the inputs, outputs and existing browser globals, preserve CommonJS exports used in tests, and commit the generated script beside the source change. For the inline application, extract one responsibility at a time behind a typed API and verify its browser interaction before moving the next one. Serving a checkout requires only the files in `dist/`.
