# Getting started with Compass

See the [README](README.md) to run the map locally and [AGENTS.md](AGENTS.md) for the contributor workflow.

## Next contributor task

Under [#35](https://github.com/OpenCoven/coven-compass/issues/35), Nova’s next task is to obtain the producer’s mapping for one graded attempt. Ask the Psyche policy owner to identify the adopted evaluator, policy revision and binding to the candidate and sealed evidence. Record the source revision and conformance example on the [D13–D15 review thread](https://github.com/OpenCoven/coven-compass/pull/44#issuecomment-7151241388). The [remaining acceptance checklist](https://github.com/OpenCoven/coven-compass/issues/35#issuecomment-7157111627) names the Compass and Coven decisions and the receipt required for closure.

To exercise the local workflow, open **Missions → New mission → Customize** and add success criteria. Save the Brief, change its rubric or attempt limit, then reload the tab and open **History** to inspect the original revision. For a graded example, open `?source=fixture&scenario=brief-missing-evidence`. The rubric passes while a required condition remains unknown. Run `node --test tests/brief-*.test.cjs tests/mission-interactions.test.cjs` and follow the [cross-browser instructions](docs/handoff/16-brief-success-profile.md#reload-and-replay).

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
