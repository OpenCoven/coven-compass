# Getting started with Compass

See the [README](README.md) to run the map locally and [AGENTS.md](AGENTS.md) for the contributor workflow.

## Next contributor task

**Ready now · Mission navigation.** The route codec in `dist/mission-navigation.js` is the next standalone TypeScript migration candidate. Check the open PRs for an existing claim. Start with `npm --prefix src ci` and `node --test tests/navigation.test.cjs tests/navigation-notice.test.cjs tests/mission-interactions.test.cjs` on clean main. Use the [migration instructions below](#migrating-a-module-to-typescript) to preserve the browser and CommonJS entry points. Exercise a mission permalink, reload, Back, and focus return in both browser engines before proposing the change.

**Highest-priority owner decision · Read one real Project.** The Cave and Coven owners must confirm whether a dedicated single-Project registry satisfies the pilot’s read scope or identify the supported Project-scoped operation. The packed SDK exercise and exact question are on [#36](https://github.com/OpenCoven/coven-compass/issues/36#issuecomment-7151283426). Compass can already demonstrate empty, partial and unavailable observations via `?source=fixture&scenario=empty`, `partial`, or `disconnected`. Serve the checkout and run the [external browser runner](scripts/browser-qa.mjs) with `--projection-only`, then repeat with `--webkit` and separate output paths.

For the remaining Brief policy, Castle association and device work, consult the [implementation plan’s issue and owner table](docs/handoff/05-implementation-plan.md#current-work-and-acceptance). It links the current evidence and the next step for each owner. The [contributor instructions](AGENTS.md#one-command) list the full pre-commit checks, and the [security policy](SECURITY.md#public-repository-protections) identifies the required merge check.

## Where to make a change

The [editable source and focused check table](AGENTS.md#where-to-make-a-change) covers navigation, mobile, the simulation, projection sources and the map. Generated browser scripts are listed alongside their source modules.

## Verify a clean checkout

Use Node 24 and Python 3.10+. From an isolated checkout of the revision under review, install the local secret hooks and pinned compiler, then run the check that leaves the checkout clean.

```sh
python3 scripts/install-secret-hooks.py
npm --prefix src ci
node scripts/verify-all.mjs --check
```

Serve `dist/` with `python3 -m http.server 18433 --bind 127.0.0.1 --directory dist`. If that port is busy, choose a free port and use it in both the server and runner commands. From the checkout, run `node scripts/verify-served.mjs http://127.0.0.1:18433/ <commit>` before capturing browser evidence. Install the browser tools outside the repository using the [browser runner setup](scripts/browser-qa.mjs). Record the served revision, browser engine, runner mode, exit code and report location.

## Migrating a module to TypeScript

The simulation model, atlas layout, crown rendering, annotation placement and viewport geometry are authored in `src/simulation-model.ts`, `src/atlas-layout.ts`, `src/atlas-crown.ts`, `src/atlas-presentation.ts` and `src/atlas-viewport.ts`. The browser and Node tests consume their generated classic scripts in `dist/`. From the repository root, install the pinned development compiler once and run the following after editing a typed module.

```sh
npm --prefix src ci
npm --prefix src run build
node scripts/verify-all.mjs --check
```

Migrate one module with its callers. The navigation codec in `dist/mission-navigation.js` is a candidate for a future migration. Its route and replay behavior is covered by `tests/navigation.test.cjs`. Place a `// @generated from src/<module>.ts` comment immediately before the first emitted statement so verification can detect orphaned scripts. Type the inputs, outputs and existing browser globals, preserve CommonJS exports used in tests, and commit the generated script beside the source change. For the inline application, extract one responsibility at a time behind a typed API and verify its browser interaction before moving the next one. Serving a checkout requires only the files in `dist/`.
