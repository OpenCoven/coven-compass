# Getting started with Compass

See the [README](README.md) to run the map locally and [AGENTS.md](AGENTS.md) for the contributor workflow.

## Next contributor task

Review how a mission Brief records success under [#35](https://github.com/OpenCoven/coven-compass/issues/35). Nova coordinates the existing [draft PR #44](https://github.com/OpenCoven/coven-compass/pull/44). Val owns the Compass inspector fields, Psyche owns evaluation policy, and Coven owns retry and acceptance authority.

1. In a separate worktree at the draft head, run `node --test tests/brief-*.test.cjs`. Follow one candidate through a failed first attempt, a retry and a changed candidate. Check that cumulative limits carry forward and that a stale grade or an uncertain prior effect prevents acceptance.
2. Record the exact draft revision and the field or receipt for each transition on [the existing review thread](https://github.com/OpenCoven/coven-compass/pull/44#issuecomment-7151241388). The next acceptance step is for each owner to link their adopted fields and source revision. Nova can then reconcile the draft with current main and test those bindings against the owner’s receipt.

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
