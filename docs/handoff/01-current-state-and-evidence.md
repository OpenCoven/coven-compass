# Current state and evidence

## 1. Checkpoint and provenance

The baseline for this handoff is **Coven Castles · Orchestration Atlas, private Site version 3** (renamed Coven Compass on 2026-11-19; see [D01](11-open-decisions.md)), published from commit `d7b6f1e655140036cca49f31687131352162de13` on 18 November 2026.

The export adds documentation, portable test fixtures, packaging/checking utilities, a Handoff link/reader, mission-navigation/mobile changes, and the scalable layout, viewport, density, sample-control, and crown refinement. The combined source also incorporates replay/adaptive-mobile work from `07919b421df5457e778e1b1c6a73512c8f27ba73`. It is not a byte-for-byte export of the older v3 commit or either pre-combination branch. `HANDOFF_MANIFEST.json` identifies the baseline and inventories the exported files; `CHECKSUMS.sha256` records their bytes. A publication receipt, when recorded, identifies its particular artifact and must not be inferred from an earlier checkpoint.

This source grew from the supplied Coven Castles v27 prototype. “v27” is the inherited prototype name; **Site version 3** is the publication checkpoint. They are distinct version systems.

## 2. Status vocabulary

| Label | Meaning here |
| --- | --- |
| Implemented — prototype | Present in the packaged simulation source |
| Verified — unit | Executed in Node fixtures with a limited DOM facade |
| Observed — publication image | Visible in the generated preview for the exact saved Site version |
| Specified constraint | Supplied by the owner as an architectural requirement |
| Proposed | Recommended design or implementation sequence requiring canonical mapping and acceptance |
| Unknown / unverified | No current repository, packaged-runtime, remote-host, or security evidence was established |

Do not convert any one label into another. A prototype UI event is not a daemon receipt; a unit fixture is not a real-host test; a publication image is not keyboard or mobile acceptance.

## 3. Implemented behavior

The application is buildless HTML, CSS, SVG, and JavaScript. The scene/UI source is joined by the pure layout and viewport helpers and the canonical crown renderer listed below. It has no bundled application framework or npm dependency graph. The inherited optional Google Fonts request has system-font fallbacks.

The simulation starts with four Projects, seven missions, and 114 delegated agents. It supports Project/mission selection, familiar highlighting, detailed tasks and agent rows, synthetic event replay, locally simulated decisions and Psyche conversations, adjustable familiar presentation, and an isolated Seal lab. Activity may change with the simulation clock. Browser display preferences do not constitute durable mission or identity state.

The simplified map uses one representation for all overview projects. It shows familiar groups inside a project, and individual agent dots only for the selected mission. Pending decision counts sit on project boundaries. The Projects drawer overlays the map, and familiar chips sit beneath it. These relationships are presentation behavior, not permission boundaries implemented by a backend.

The current refinement is **implemented; combined source-level verification passed**. It uses uniform four-corner overview Projects, aspect-aware paired placement, shared coordination corridors ending at inward gates, and full/compact/tiny density modes. At full detail, each overview Project has at most eight mission seals plus overflow; compact/tiny views use exact aggregates. The complete mission collection remains available through search and drilldown. Explicit Coven/project scope is separate from zoom; measured chrome-safe fitting refits on resize only in auto-fit mode. The scene crown extrudes the exact canonical silhouette without replacing flat UI marks. [Guide 15](15-scalable-atlas-layout.md)

The Project browser adds project search and 8/16/32/64/128 sample presets. Reset removes only generated `layoutDemo` additions, preserving baseline and user-created Projects; existing project counts may exceed a requested preset. The previous cosmetic 16-Project and 12-mission creation caps are removed. Presets and bounded geometry tests do not establish production capacity or unlimited browser performance.

The combined mobile workspace reuses the original replay and camera controls in Map, Missions, Activity, and View surfaces. Shared live replay preserves elapsed time and playing/paused state across project focus changes, while imported recordings keep their own extent. Delayed reports do not force a replay to the live edge. Visible chrome is measured after the current HUD/manifest structure is updated; keyboard visibility, camera lock, and manual framing constrain refit. Selection cleanup during replay restores the saved camera and its auto-fit policy. These are local presentation/replay semantics, not a daemon clock or durable execution state. [Combined integration guidance](15-scalable-atlas-layout.md)

## 4. Source map for an implementer

| File / function | Current responsibility | Integration implication |
| --- | --- | --- |
| `dist/index.html`: sample traces, `newWorld`, `apply`, `seek`, `emit` | Generates and reduces local sample events | Keep as fixture/demo mode; do not route real mutations through this reducer as if it were authoritative |
| `layoutOf`, `worldOf`, `missionXY`, `targetOf` | Stable display positions and gate locations | Map canonical IDs into stable view coordinates; coordinates must never grant capability or ownership |
| `dist/atlas-layout.js` | Aspect-aware paired overview placement, reserved rectangles, shared corridors, inward gates, and bounded mission packing | Pure presentation geometry; do not reinterpret route topology as canonical task dependencies |
| `dist/atlas-viewport.js` and scene fit integration | Fit projected bounds to measured safe space | Keep auto-fit and manual camera state separate from explicit scope and operational state |
| `dist/atlas-crown.js` | Exact canonical crown faces and sampled extrusion walls | Decorative scene relief; no change to familiar identity, mission progress, or flat UI marks |
| `dist/mobile-ui.js` and scene viewport callbacks | Adaptive dock, original-node portals, measured stage space, keyboard state, focus, and modal ownership | Refit only the visible interactive scene; preserve manual camera policy and existing control state |
| `dist/index.html`: replay loop, `seek`, and `emit` | Shared local replay cursor, elapsed playback, event application, and delayed-report retention | Keep sample replay separate from canonical execution time, persistence, and operation receipts |
| `atlasSnapshot` | Derives navigation and familiar totals from sample worlds | Wrapped by the simulation `ProjectionSource` in `dist/projection-source.js`. A read-only canonical adapter implements the same `read()` interface; the fixture source is the first non-simulation implementation |
| `dist/projection-source.js`, `dist/fixtures/` | Explicit `?source=` mode selection; simulation and fixture sources; a standalone view with fresh/stale/reconciling/unavailable states | The plug-in point for a live adapter once D01/D03/D04 are decided. A non-simulation mode never boots the simulation |
| `buildScene`, `sync`, `project`, `applySel` | Constructs SVG, reconciles it, projects geometry, and applies local selection/filter state | Retain presentation logic while separating canonical data from local view state |
| `atlasSyncOverviewMissions` | Adds/removes overview seals as mission IDs change | Preserve reconciliation across snapshot replacement, event replay, and pagination/completeness changes |
| `sealOf`, `buildSeal`, `drawSeal` | Computes and draws mission seal measurements/state | Preserve meanings; use canonical progress/limit evidence instead of inferring success from visual height |
| `select`, `atlasOpenProject`, `atlasOverview` | Local focus/navigation | Safe client state; never an execution authorization |
| `setNeeds`, `flashAsk`, local decision handlers | Simulated review flow | Production path must call the canonical authenticated proposal/decision interface and reconcile receipts |
| `dist/atlas-ui.js` | Header, project search/sample presets, mission browser, drawer, familiar chips, Handoff entry | Keep low-trust UI responsibilities explicit and retain full scoped collections outside miniature limits |
| `dist/seal-lab.js` | Isolated specimen exploration using the actual seal renderer | Remain visibly separate from real project status |
| `tests/presentation.test.cjs` | Seven targeted presentation and geometry tests | Continue running after adapter extraction; add actual integration tests in the owning repositories |

This is a navigation aid, not a promise that similarly named functions exist in any production OpenCoven repository.

## 5. Verified baseline evidence

### Current evidence: generated, not hand-written

Current counts live in one file, [`tests/evidence/current.json`](../../tests/evidence/current.json). `node scripts/verify-all.mjs` runs the static source checker, the Node suite, the crown check, a handoff build, ZIP verification, and the source/test/crown/manifest checks in a clean extraction of the built ZIP, then writes the counts it measured. CI runs `node scripts/verify-all.mjs --check` on every pull request and fails if that file is stale. `--report PATH` adds the commit, runtimes, time, and per-step results for one run; CI uploads that report as a workflow artifact. Evidence level: static + unit only.

### Browser QA — 2026-11-19 (headless Chromium)

`scripts/browser-qa.mjs` ran at commit `b3970fd` in headless Chromium 130.0.6723.31 (Playwright 1.48.2, installed outside the repository) against `python3 -m http.server`. It made **201 browser checks, 201 passed, 0 failed** ([record](../../tests/evidence/browser-qa-2026-11-19.json)):

- **Simulation mode**, both default and `?source=simulation`, at 1440×900, 390×844 and 844×390. The map renders and the settled fit keeps every Project in the stage. A Project opens from the Projects drawer, and a mission opens from the mission browser (the mobile dock's Missions on phones) with its inspector visible. Replay starts and moves the cursor. Seal lab opens and closes. The mobile dock shows on phones and is hidden on desktop. No console errors, page errors or failed requests (Google Fonts excluded).
- **Every `?source=fixture` scenario, and `?source=live`**, at the same sizes. The simulation never boots: `#app` is hidden and the Atlas header is not mounted. The state label and message match each scenario. The Projects table is present with the right row count, or absent. There's no horizontal page scroll and no clipped table.

The run found one bug, in the fixture table layout at phone width, which was fixed in `b3970fd` before the recorded run. Screenshots stay outside the repository. This is browser-engine evidence. It **does not establish** Safari, physical devices, real multi-touch, keyboard-only use, screen readers, or daemon behavior.

Everything after this subsection is a **dated historical record**. It keeps its counts as recorded and is not updated with later changes. Other documents link here or to `current.json` instead of repeating counts, and `scripts/check-source.mjs` enforces that.

At the v3 checkpoint, seven Node tests passed with zero failures or skips. They cover mission insertion/removal across replay without a wall-count change; hidden agents before selection; selected-mission agents, reserved places, gate links and gate decisions; familiar filters within projects; local/global selection consistency; unchanged seal logic; and all six seal states across three detail tiers after normalizing the ground origin.

`sealOf`, `buildSeal`, and `drawSeal` matched the earlier v2 source at `494a08f6bf10c9a0606c82e86821fed8a253f066`. The meaningful presentation change set the shared ground plane to zero. The bundled `tests/fixtures/v2-index.html` is extracted from that exact source path and commit; `baseline.json` records its digest. The test loader verifies the fixture before comparison, without requiring `.git`.

JavaScript syntax, linked static assets, unique static IDs, CSS delimiters, and patch whitespace were also checked. The generated publication image for saved v3 was visually inspected and showed the simplified Coven overview. That observation did not exercise controls or demonstrate responsive behavior.

At the v3 checkpoint, native browser access was blocked by browser URL policy. No workaround was used. Browser focus, touch, keyboard, responsive layout, and dynamic browser interactions were unverified in that historical record.

### Historical mission-navigation and mobile pass — before scalable layout

The pre-layout mobile pass ran `node --test tests/*.test.cjs` and recorded **51/51 tests passing**. [MOBILE_READINESS.md](../../MOBILE_READINESS.md) documents that historical navigation, gesture, overlay, and mission-interaction coverage, 72 settled Chrome layout audits, and observed browser flows. Those results supplement the v3 baseline but do not verify the current scalable-layout changes or establish native iOS, daemon, or production integration acceptance.

`tests/evidence/source-fingerprints.json` records the historical mobile-matrix commit `9c7be88ca6797ef45a95764e2944653a399ee5c4` and merged handoff checkpoint `8eb108515b45a22bef5826fe2d4888845bace63a`. The newer source must be assessed against its own manifest/revision and current test outputs. JSON audit/provenance records remain in the export; historical browser JPGs remain in the repository only and are excluded from the handoff.

The handoff's validation tooling records checks at the source/package level. The runtimes used to prepare and check it are Node.js `v24.22.1` and Python `3.12.14`. The tools require Python 3.10 or newer; other Python versions were not executed in this environment.

### Historical incoming replay/adaptive-mobile checkpoint

The incoming branch at `07919b421df5457e778e1b1c6a73512c8f27ba73` recorded **71 passing Node tests** and **57 settled Chrome audits**, including 56 mobile/tablet checks across 17 viewport sizes and one desktop reference. [Its JSON audit](../../tests/evidence/replay-mobile-layout-audits.json) preserves source fingerprints, diagnostic failures, successful retests, and interaction notes. This is evidence from before the combined layout; it does not establish browser acceptance of the merged lattice, crown, fit, and adaptive dock. Its repository-only replay JPG is excluded from the handoff.

### Combined layout, replay, and adaptive mobile — 2026-11-18 handoff-edition checkpoint

At the 2026-11-18 handoff edition, the final combined suite passed **207 tests with zero failures, cancellations, or skips**. This includes merge-boundary regressions for nested mobile HUD measurement, hidden chrome, modal-inspector exclusion, HUD creation before fit, keyboard-resize guards, and restoration of a manual camera after replay selection cleanup. The dedicated crown check passed **84 view/size combinations** plus canonical digest, aperture, bounds, and stable-node checks. The static checker passed: **3 HTML files, 22 JavaScript files, 1 inline script, 6 CSS files, 7 JSON files, 22 Markdown files, and 155 local references** at that recorded run. **Combined clean-extraction, rebuilding, and package verification passed**, as detailed below. Commands used:

```sh
node scripts/check-source.mjs
node --test --test-reporter=tap tests/*.test.cjs
node scripts/test-atlas-crown.mjs
```

The layout sweep covers selected project counts through 128 (0, 1, 2, 4, 8, 12, 24, 64, and 128) as bounded geometry cases. Mission-packing integration covers every integer count from 0 through 128. These are not load or production benchmarks. At this 2026-11-18 checkpoint, browser QA was unavailable because of the prior browser URL-policy block; see the 2026-11-19 browser QA record above for the later run. No workaround was used, and neither historical Chrome evidence nor source-only checks establish visual, keyboard, touch, or responsive acceptance of this refinement. Locally generated SVG specimens illustrate source geometry, not browser rendering or interaction. [Remaining layout acceptance](15-scalable-atlas-layout.md)

### Combined standalone export verification — 18 November 2026

The combined ZIP was extracted into `/workspace/scratch/c8f0b8aaa2a0/atlas-merged-clean-fq8gch1w/Coven_Castles_Atlas_Handoff_2026-11-18` without `.git` metadata. The following checks ran from that extracted root. The local run log is `/workspace/scratch/c8f0b8aaa2a0/layout-merged-clean-validation.txt`.

| Command or inspection | Recorded combined result |
| --- | --- |
| `python3 scripts/verify-handoff.py .` | Passed: 67 files, 65 payload entries, 66 SHA-256 checks; paths and inventory verified. |
| `node --test --test-reporter=tap tests/*.test.cjs` | 207 passed; zero failed, cancelled, or skipped. |
| `node scripts/test-atlas-crown.mjs` | Passed 84 view/size combinations, exact canonical digest, aperture, bounds, finite geometry, and stable-node checks. |
| `node scripts/check-source.mjs` | Passed: 3 HTML files, 22 JavaScript files, 1 inline script, 6 CSS files, 7 JSON files, 22 Markdown files, and 155 local references. |
| `python3 scripts/build-handoff.py --output /workspace/scratch/c8f0b8aaa2a0/atlas-merged-clean-fq8gch1w/rebuilt.zip` | Rebuilt the complete ZIP and generated reader from extracted source. |
| `python3 scripts/verify-handoff.py /workspace/scratch/c8f0b8aaa2a0/atlas-merged-clean-fq8gch1w/rebuilt.zip` | Passed CRC, paths, inventory, and hashes; 67 files, 65 payload entries, 66 SHA-256 checks. |
| Handoff navigation inspection | All 198 local landing-page/reader links and chapter anchors resolved. |
| Export exclusions | No browser images, Git metadata, `node_modules`, or recursive generated ZIP; historical JSON evidence retained. |

This verifies standalone source portability and package integrity for the combined checkpoint. It does not establish browser layout, physical-device behavior, daemon integration, or production performance. The earlier branch/package records below remain separate historical evidence.

### Historical layout/crown standalone export — before this combination

A fresh extraction of the layout/crown package before the replay/adaptive-mobile merge, without `.git`, passed the following checks. These counts and package results are historical; the combined ZIP requires its own run:

| Command or inspection | Result |
| --- | --- |
| `python3 scripts/verify-handoff.py .` | Passed: 62 files, 60 payload entries, 61 SHA-256 checks; extracted paths and inventory verified. |
| `node scripts/check-source.mjs` | Passed: HTML/JS/CSS syntax and structure, JSON, and local source/document references. |
| `node --test tests/*.test.cjs` | 182 passed; zero failed, cancelled, or skipped. |
| `node scripts/test-atlas-crown.mjs` | Passed canonical digest, 84 view/size cases, aperture, finite geometry, bounds, and stable-node checks. |
| `python3 scripts/build-handoff.py --output /workspace/scratch/c8f0b8aaa2a0/layout-handoff-rebuilt.zip` | Rebuilt the full ZIP and 23-chapter reader from extracted source. |
| `python3 scripts/verify-handoff.py /workspace/scratch/c8f0b8aaa2a0/layout-handoff-rebuilt.zip` | Passed CRC, paths, inventory, and digests. |
| Handoff navigation inspection | All 193 local landing-page/reader links and chapter anchors resolved in the deployable tree. |
| Export exclusion inspection | No browser JPG/PNG/WebP evidence, Git metadata, dependency tree, or recursive generated ZIP was included. Historical JSON evidence remains labeled as historical. |

The local geometry specimen was rendered and visually inspected with exact Project, route, fit, and crown code at four and 128 projects, at 24° and 45°. It uses assumed chrome rectangles and synthetic names, omits mission seals/totals, and is source geometry evidence only. It is not a browser capture and does not establish browser typography, keyboard, touch, or device acceptance.

These checks established independent unpacking, validation, and rebuilding for that pre-combination package. They do not establish the current combined package. Production adapter, daemon, authority, and device acceptance remain separate work.

### Historical standalone export verification — 18 November 2026

The archive was extracted into a fresh directory with no `.git` metadata. The following commands ran from the extracted `Coven_Castles_Atlas_Handoff_2026-11-18` root. They require no network, npm installation, or application build.

| Command | Recorded result |
| --- | --- |
| `python3 scripts/verify-handoff.py .` | Exit 0; the extracted file inventory, paths, and all SHA-256 checks passed. |
| `node scripts/check-source.mjs` | Exit 0; current HTML/JS/CSS structure, JSON, and local Markdown references passed. |
| `node --test tests/presentation.test.cjs` | Exit 0; seven passed, zero failed, cancelled, or skipped. The pinned fixture loaded without Git history. |
| `python3 scripts/build-handoff.py --output /workspace/scratch/c8f0b8aaa2a0/handoff-qa-initial-rebuilt.zip` | Exit 0; the extracted source rebuilt a complete handoff ZIP and static guide. |
| `python3 scripts/verify-handoff.py /workspace/scratch/c8f0b8aaa2a0/handoff-qa-initial-rebuilt.zip` | Exit 0; the rebuilt archive passed CRC, path, inventory, and digest checks. |

In the Site checkout, `git diff --check` passed. A separate static HTML pass resolved all local handoff navigation, download, and chapter-anchor targets in the deployable tree. The archive intentionally excludes itself and its download sidecar; the local Download button becomes available after rebuilding the package. The guide and Atlas remain included and usable without that rebuild.

The package verifier checks integrity relative to the supplied manifest; it does not authenticate the publisher. Source checks parse code and references; they are not a browser or security assessment. The final archive carries its own exact file inventory and checksums. A fresh export timestamp means a rebuild can have a different ZIP digest without a source-content change.

## 6. Explicitly not established

- No canonical production repository checkout or current repository API inventory was established for Coven, Castles, Psyche, SDK, CLI, Build, Threads, Runtimes, SPAR, or Memory in this handoff task.
- No daemon was paired, no authenticated principal session was created, and no real model or agent execution was dispatched.
- No production lease, fencing, replay protection, authorization verification, resource enforcement, receipt persistence, cancellation, crash recovery, or folder synchronization was exercised.
- No packaged CLI/native app or remote-host interoperability was tested.
- No UI selection, example JSON, command intent, or plan proposal is a permission grant.

## 7. The next evidence-producing slice

Inventory the current canonical repositories and contracts, record exact revisions and owners, then show one real Project in read-only mode. Prove correct familiar root/revision binding, mission/task/attempt mapping, pending decisions, stale/disconnected behavior, and snapshot/event reconciliation. The first operational slice follows only after the authenticated request/receipt and refusal paths are mapped and tested.

Use the [binding inventory](templates/canonical-binding-inventory.csv) to turn every placeholder into an inspected symbol or an explicit gap. Preserve a gap as a gap; do not fill it with a new service merely to make the demonstration look live.
