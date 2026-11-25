# AGENTS.md: working in coven-compass

Coven Compass is a buildless, dependency-free static Site (`dist/`) that maps Projects, missions, and familiars. **It is a local simulation.** It doesn't connect to a Coven daemon, run agents, or grant authority. The integration plan in `docs/handoff/` is a proposal, not a contract.

People reading this: Val owns the repo and merges. Nova coordinates and routes work. Familiars such as Sage (research) and Cody (Claude Code, implementation) take lanes.

## One command

```bash
npm --prefix src ci                  # install the pinned verification compiler once per checkout
node scripts/verify-all.mjs           # run before every commit; writes tests/evidence/current.json
node scripts/verify-all.mjs --check   # checks the checkout and fails on stale evidence
sh scripts/verify-checkout.sh         # same command (wrapper kept from #6)
```

Verification checks the public site, source, Node suite, and crown. Use Node.js 24 and Python 3.10+. Preview locally with `python3 -m http.server 8000 --bind 127.0.0.1 --directory dist`.

Commit any regenerated `tests/evidence/current.json`. GitHub Actions is disabled. The [security policy](SECURITY.md#public-repository-protections) lists the required merge check.

## Where to make a change

Choose an issue from the [contributor entry point](START_HERE.md#next-contributor-task). Run the focused check for the editable source below, then run `verify-all` before committing.

| Change | Edit | Focused check |
| --- | --- | --- |
| Project form and mission inspector | `dist/index.html` | `node --test tests/mission-interactions.test.cjs`, then exercise the form in a desktop and a narrow browser |
| Routes and mission browser | `dist/mission-navigation.js`, `dist/atlas-ui.js`, and their bindings in `dist/index.html` | `node --test tests/navigation.test.cjs tests/navigation-notice.test.cjs tests/mission-interactions.test.cjs` |
| Coven Needs review queue and shared Psyche confirmation | `dist/review-queue.js`, `dist/review-queue-ui.js`, `requestConfirmation` in `dist/index.html` | `node --test tests/review-queue.test.cjs`. Run `scripts/review-queue-qa.mjs` and `scripts/inbox-event-qa.mjs` from the external Playwright install with the preview URL and engine (`chromium` or `webkit`). |
| Map and camera | `src/atlas-layout.ts`, `src/atlas-viewport.ts` | `node --test tests/atlas-layout.test.cjs tests/atlas-viewport.test.cjs` |
| Projects drawer and Trace | `dist/atlas-ui.js`, `dist/atlas.css`, Trace in `dist/index.html` | Run `scripts/project-drawer-qa.mjs` and `scripts/trace-panel-qa.mjs` beside external Playwright with the preview URL and engine (`chromium` or `webkit`). For row activation, run `scripts/project-selection-qa.mjs` with the URL, engine and `pointer` or `controls`. |
| Mobile controls and focus | `dist/mobile-ui.js`, `dist/mobile-interactions.js`, `dist/atlas.css` | `node --test tests/mobile-*.test.cjs` |
| Map keyboard focus (one Tab stop, arrow keys inside) | `dist/map-focus.js`, `atlasFocusable` in `dist/index.html` | `node --test tests/map-focus.test.cjs`, then Tab through the map in a browser |
| Simulation fold (what an event does to the world) | `src/simulation-model.ts` | `node --test tests/simulation-model.test.cjs tests/replay-*.test.cjs tests/approval-replay.test.cjs` |
| Projection sources (`?source=`) | `dist/projection-source.js`, `dist/fixtures/`, the guard at the top of the inline script in `dist/index.html` | `node --test tests/projection-source.test.cjs` |
| Brief success policy (proposal, #35) | `dist/brief-policy.js` (model), `dist/brief-policy-view.js` and `dist/brief-policy.css` (panel in the inspector's Brief tab and in `?source=fixture&scenario=brief-…`), `dist/brief-policy-editor.js` (success criteria in New mission and Edit brief), `dist/fixtures/brief-policy-cases.json`, [chapter 16](docs/handoff/16-brief-success-profile.md) | `node --test tests/brief-policy.test.cjs tests/brief-fixtures.test.cjs tests/brief-policy-view.test.cjs tests/brief-policy-editor.test.cjs` |

Keep `tests/fixtures/` (the pinned baseline) and the dated audits in `tests/evidence/` as historical evidence.

## Invariants (never break)

1. **It's a simulation.** Nothing may silently fall back to sample data, fake an acknowledgement, or show a success the browser generated itself. A future real-data mode must say when it's stale, disconnected, or unavailable.
2. **Decisions D01–D12 belong to their owners** ([register](docs/handoff/11-open-decisions.md)). You may record a proposal or evidence. Never mark a decision accepted. Keep *proposed*, *accepted by owner*, *implemented*, and *verified* separate.
3. **No live daemon transport.** D03 is unresolved: the daemon's loopback TCP listener is unauthenticated and sends no CORS headers, so a static page can't safely reach it.
4. **No outward actions without explicit authorization.** That means no deploys or Site publishes, no edits to other OpenCoven repos, and no messages outside GitHub. Linked issues are how you reach other repos.
5. **Report evidence exactly:** command, exit code, and counts. List skipped checks as skipped. Don't loosen a test or gate just to get to green.
6. **Vocabulary:** *Projects contain Castles.* The map's enclosure is a **Project**. A **Castle** is a bounded, hosted place where a Project's work runs and its results come back, with exactly one execution owner (Val's definition, 2026-11-19, recorded in [D01](docs/handoff/11-open-decisions.md)). `coven-host` provides a Castle's folder surface and `coven-castles` checks whether a sandbox is fit to back one. A Project has zero or more Castles. A Castle is never the Project and keeps its own ID, so don't reintroduce "Castle" for the enclosure, and don't treat a Castle's folder path or `castle.json` as a Project identity. Project IDs: in the long term the Coven daemon issues them; for the pilot, Cave's registry does, as `{ source: "cave", ref }` (Val, 2026-11-22, [D01](docs/handoff/11-open-decisions.md)). Multi-root Projects and cross-Project missions are still open.

7. **Compass is strictly 2D.** The map, Seal lab, icons, previews and responsive views share an upright drawing plane. Use position, size, outlines, fill, arcs and labels to encode meaning. Pan and zoom are the only camera movements. Adding perspective, orbit, tilt, extrusion, depth shading or a 3D renderer requires Val’s explicit override of this restriction in the issue or PR before implementation. Cite that decision when changing this invariant and its source check. There is no runtime override.

## Generated files: never hand-edit

| File | Generated by | Source of truth |
| --- | --- | --- |
| `tests/evidence/current.json` | `scripts/verify-all.mjs` | the site, test and crown runs |

**Counts live in one place.** Current numbers belong only in `current.json`. Dated historical numbers belong only in [chapter 01](docs/handoff/01-current-state-and-evidence.md) and [MOBILE_READINESS.md](MOBILE_READINESS.md). `check-source` fails if a count of tests, audits, crown combinations, or package files appears anywhere else, so link to those files instead.

## File map

| Path | What it is |
| --- | --- |
| `dist/index.html` | Sample traces, `seek`/`emit` (selection, camera, effects), scene build/sync/projection, seal renderer, replay loop. The main application entry point. |
| `src/simulation-model.ts` | The simulation model: a pure fold over a trace (`newWorld`, `apply`, `advance`, `append`, `summarize`). No DOM or timers; the page injects its constants. |
| `dist/atlas-ui.js`, `dist/atlas.css` | Header, project search and sample presets, mission browser, drawer, familiar chips |
| `src/atlas-layout.ts` | Pure geometry: paired project placement, corridors, gates, bounded mission packing |
| `src/atlas-viewport.ts` | Measured safe-area fit |
| `src/atlas-crown.ts` | Canonical flat Psyche crown and aperture. Build its classic script for the browser. |
| `dist/mission-navigation.js` | Route codec (`#/project/<name>[/mission/<id>…]`), replay selection reconciliation |
| `dist/projection-source.js`, `dist/fixtures/` | **The projection seam.** `?source=simulation` (the default) or `?source=fixture&scenario=…`. Every source implements `read() → Projection`. Add a live adapter here, never inside the simulation. |
| `dist/brief-policy.js` | **Proposal model for #35.** A pure evaluation of a Brief's success policy (required conditions, rubric, cumulative limits) against evidence-bound evaluations. It returns the next permitted action and never "accepted". |
| `dist/brief-policy-editor.js` | The success criteria editor in New mission and Edit brief. It edits `brief.success` only; Save stays with the page and is blocked while the criteria don't validate. |
| `dist/brief-policy-view.js`, `dist/brief-policy.css` | The success policy panel, shared by the inspector and the synthetic fixture view. It keeps proposal, execution, quality qualification and accepted completion apart. |
| `dist/mobile-ui.js`, `dist/mobile-interactions.js` | Adaptive dock, portals, focus, gestures, visual viewport |
| `dist/map-focus.js` | Roving tabindex for map items: the map is one Tab stop, and arrow keys, Home and End move between Projects, gates, familiars, missions and agents |
| `dist/seal-lab.js`, `dist/semantic-map.css` | Isolated seal explorer; scope-specific scene visibility |
| `tests/*.test.cjs` | Node tests using DOM facades; `tests/fixtures/` pins the v2 reference source |
| `tests/evidence/` | `current.json` (generated) and historical JSON audits |
| `scripts/` | `verify-all.mjs`, `check-source.mjs`, `test-atlas-crown.mjs`, `scan-secrets.py` |
| `docs/handoff/` | Architecture, plan, acceptance, security, decisions: the editable doc source |
| `docs/discovery/` | Dated discovery records, including the original pinned packet and the reviewed summary. Preserve the original evidence. |
| `examples/` | Inert conceptual JSON, not wire schemas |

For a function-level map of `dist/index.html`, see [chapter 01 §4](docs/handoff/01-current-state-and-evidence.md#4-source-map-for-an-implementer).

## Evidence and status vocabulary

- **Evidence level:** `static` | `unit` | `browser` | `daemon` | `packaged CLI` | `remote Host`. verify-all establishes `static` and `unit` only. Browser evidence comes from `scripts/browser-qa.mjs` (headless Chromium, run outside verify-all; see its header). The [mission discovery report](tests/evidence/browser-qa-2026-11-20-mission-discovery.json) records the tested Git revision, keyboard journeys, compact-label control and fixture checks. Physical keyboards, screen readers, real touch and Safari remain separate qualification work under #39.
- **Check the 2D restriction in a browser.** With the external Playwright install described in `scripts/browser-qa.mjs`, copy `scripts/plan-qa.mjs` to the same directory and run `node plan-qa.mjs http://127.0.0.1:18433/` against the local preview. This exercises legacy preferences, input, camera controls and the Seal lab.
- **Reproduce mission discovery.** Use Node 24 and the external Playwright 1.48.2 Chromium installation described at the top of `scripts/browser-qa.mjs`. Serve the candidate’s `dist/`, copy that runner into the Playwright directory, and run `node browser-qa.mjs http://127.0.0.1:18433/ ./shots ./qa.json <candidate-sha> --keyboard-only`. The report records Tab counts, focused controls, inspector return and permalink reload. The runner opens Trace → Load a recording and supplies its own eight-mission JSON Lines file. It tests the focused label at the same zoom before and after removing its two focus selectors in a disposable page. Omit `--keyboard-only` to exercise projection fixtures and replay as well.
- **Verify a served revision.** From the checkout, run `node scripts/verify-served.mjs https://coven-compass.vercel.app/ <deployed-sha>` to compare the public root and every tracked file under `dist/` with Git. Then use that URL and SHA in the browser command above and omit `--keyboard-only` for the full journey.
- **Measure map performance.** Use the [browser workload and rerun instructions](docs/map-performance.md) for first-load timings, verified interaction traces and repeated navigation at a pinned revision.
- **Packet status:** `implemented` | `verified` | `proposed` | `blocked` | `unknown`.
- **Completion record:** every PR or handoff ends with the exact record in [document 10](docs/handoff/10-agent-task-prompts.md#required-completion-record).

## How work flows (from issues #1–#3)

1. **Claim it.** Comment on the issue that you're taking it and name the branch, for example "Claiming this — Cody (Claude Code) is picking up …".
2. **Branch** `compass/<topic>` off `main`. Make one bounded change per branch. If a PR depends on another open PR, stack it (base it on that branch) and say so in the body.
3. **Open a PR against `main`. Don't merge it; Val merges.** In the body include what changed, any deliberate departures from the brief, the commands with their results, what wasn't checked, and the completion record. A PR closes an issue only when Val approves.
4. **Out-of-brief work gets its own branch and PR.** If you find uncommitted edits you didn't make, don't commit or discard them. Report them with timestamps and ask. When Val decides to discard, keep a backup patch outside the repo.
5. **Read-only lanes** (discovery, research) cite the exact pinned revision of every repo they read. They deliver files with sha256 digests and a receipt id (for example `RESEARCH-YYYYMMDD-TOPIC`). They mark recommendations as proposals, not owner decisions.
6. **Status comments** say plainly what's merged, open, committed, or pending, so another agent can pick up the work.

## Where to read next

- [START_HERE.md](START_HERE.md): contributor quick start
- [docs/handoff/05-implementation-plan.md](docs/handoff/05-implementation-plan.md): phases W01–W14
- [docs/handoff/09-security-and-authority.md](docs/handoff/09-security-and-authority.md): authority boundaries
- [docs/handoff/15-scalable-atlas-layout.md](docs/handoff/15-scalable-atlas-layout.md): layout, crown, and presentation contract

Run `scripts/project-preview-qa.mjs` using the same external Playwright installation as `scripts/browser-qa.mjs`. Serve `dist/`, copy the script beside that installation, and run `node project-preview-qa.mjs http://127.0.0.1:8000/` to exercise Coven previews and task inspection on desktop and portrait layouts. The test imports its own recording with unstaffed tasks. It follows a Project from the overview through its task inspector, filtered mission search and focus return, then opens an invalid permalink.

## Secret checks

Install the clone-local hooks with `python3 scripts/install-secret-hooks.py` before working on branches. See [SECURITY.md](SECURITY.md) for the staged-index, full-history, production build and regression commands. Review a suspected exposure privately and report only the rule and object identifier.

Edit the simulation model, layout, crown, viewport and annotation-placement modules under `src/`. Their matching scripts under `dist/` are generated. Run `npm --prefix src ci`, `npm --prefix src run build` and `npm --prefix src run check` when changing typed modules, then run the usual site verification.
