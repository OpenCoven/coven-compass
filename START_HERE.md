# Getting started with Compass

See the [README](README.md) to run the map locally and [AGENTS.md](AGENTS.md) for the contributor workflow.

## Where to make a change

| Change | Editable source | Focused check |
| --- | --- | --- |
| Project and mission navigation | `dist/mission-navigation.js`, `dist/atlas-ui.js`, and their app bindings in `dist/index.html` | `node --test tests/navigation.test.cjs tests/mission-interactions.test.cjs` |
| Map placement and camera | `src/atlas-layout.ts`, `dist/atlas-viewport.js` | `node --test tests/atlas-layout.test.cjs tests/atlas-viewport.test.cjs` |
| Mobile controls and focus | `dist/mobile-ui.js`, `dist/mobile-interactions.js`, `dist/atlas.css` | `node --test tests/mobile-*.test.cjs` |

## Migrating a module to TypeScript

Atlas layout, crown rendering and annotation placement are authored in `src/atlas-layout.ts`, `src/atlas-crown.ts` and `src/atlas-presentation.ts`. The browser and Node tests consume their generated classic scripts in `dist/`. From the repository root, install the pinned development compiler once and run the following after editing a typed module.

```sh
npm --prefix src ci
npm --prefix src run build
node scripts/verify-all.mjs --check
```

Migrate one module with its callers. Start with pure helpers such as viewport geometry, then the simulation fold and navigation codec. Place a `// @generated from src/<module>.ts` comment immediately before the first emitted statement so verification can detect orphaned scripts. Type the inputs, outputs and existing browser globals, preserve CommonJS exports used in tests, and commit the generated script beside the source change. For the inline application, extract one responsibility at a time behind a typed API and verify its browser interaction before moving the next one. Serving a checkout requires only the files in `dist/`.
