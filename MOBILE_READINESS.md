# Coven Compass mobile readiness

Mobile, replay, and layout checkpoints recorded November 18, 2026; combined-source verification tracked separately below.

## Current status and historical boundary

**Current source and package counts are generated** by `node scripts/verify-all.mjs` into [`tests/evidence/current.json`](tests/evidence/current.json) and checked by CI. Everything below is a dated record and is not updated with later changes.

**Combined source-level verification passed (2026-11-18 handoff-edition checkpoint).** The scalable-layout/crown source now incorporates replay and adaptive-mobile improvements from `07919b421df5457e778e1b1c6a73512c8f27ba73`. At that checkpoint the final combined suite passed **207 tests with zero failures, cancellations, or skips**; the crown check passed **84 view/size combinations** plus canonical digest/aperture/bounds/stable-node checks; and the static source checker passed. **Combined ZIP clean-extraction, rebuilding, and archive verification passed**, including the same source suite and crown checks in the extracted copy. The following evidence belongs to three earlier checkpoints:

| Checkpoint | Evidence | What it does not establish |
| --- | --- | --- |
| Layout/crown branch before this merge | 182 passing Node tests, 84 crown view/size combinations plus canonical checks, passing source checks and clean extraction/rebuild. | A passing combined suite or current browser acceptance. |
| Incoming replay/adaptive-mobile branch | 71 passing Node tests and 57 settled Chrome audits. | Browser acceptance of the combined lattice, crown, fit, and mobile replay layout. |
| Earlier mobile/navigation baseline | 51 passing Node tests and 72 settled Chrome audits, with separate supplemental checks. | Acceptance of either later branch or this merge. |

Browser QA for the current combined source is unavailable because of the prior browser URL-policy block. The incoming audit records its own source fingerprints; it is pre-this-combined-layout evidence, not a new browser run against the merged artifact. Current results belong in [current state and evidence](docs/handoff/01-current-state-and-evidence.md). Physical iPhone/Safari acceptance remains necessary for a production device claim. The Site remains a local simulation without a native iOS binary, daemon connection, persistent mission execution, or real authorization.

The overview retains compact paired placement, shared coordination corridors, and full/compact/tiny density modes. Full detail shows at most eight mission seals plus overflow; denser views show exact aggregates, with all missions available through search and drilldown. The Projects drawer provides project search and 8/16/32/64/128 sample presets; **Remove extra samples** preserves baseline and user-created Projects. Coven/project scope stays explicit. Measured stage changes from the adaptive dock must honor the same auto-fit policy: resize refits only in auto-fit mode and preserves manual framing. [Scalable layout guide](docs/handoff/15-scalable-atlas-layout.md)

The implementation adapts to viewport size and primary pointer type. It does not hard-code an iPhone model or assume that folding produces one particular CSS resolution. Mobile sheets apply through 1100 CSS pixels and on primary coarse-pointer devices.

## Interaction contract

| Surface | Expected behavior |
| --- | --- |
| Missions | Search mission, Project, or familiar; filter by Project and state; recover from no matches with Clear filters. |
| Detail exploration | Brief, Council, Tasks, and Agents use accessible tabs. Arrow keys, Home, and End move between sections. Previous/Next stays within the Project. |
| Familiar scope | Back to mission returns to the whole selected mission. |
| Agent scope | Selecting an agent reveals and focuses its information. Close agent details returns to its row. Live updates keep the same focused controls. |
| Return to browsing | All missions retains the query, filters, scroll position, and selected mission. |
| Browser navigation | Routes identify Project and mission together, section, familiar, and card/detail mode. Back/Forward and reload restore this state; transient navigation drawers close during route restoration. |
| Replay | Playback crosses mission opening and council-seating events. Project focus preserves playing/paused state and time. Live Projects share one timeline, including empty focused Projects; imported recordings keep their own extent and finish paused. A removed mission/familiar/agent is reconciled immediately. |
| Mobile workspace | Map, Missions, and Activity open existing surfaces. Replay and Go live remain reachable on the map. View expands the existing camera controls; Escape folds them without leaving the selected mission. |
| Adaptive views | Compact, short-landscape, and tablet arrangements use visible viewport geometry and measured header/dock heights. Rotation retains an explicit camera expansion and the original control/draft nodes. |
| 2D traversal | A direct drag pans without changing the viewing plane. |
| 3D traversal | Orbit changes yaw/pitch; Move pans. Orbit has a six-degree lower bound so a downward drag does not strand the user in 2D mode. The 2D control deliberately selects the flat plane. |
| Two-pointer traversal | Pan and pinch are calculated together around the moving centroid. Adding/removing a pointer rebases the gesture rather than jumping. |
| Scope, Fit, and Lock | Coven/project scope is explicit and does not switch at a zoom threshold. Fit restores the current scope using measured chrome-safe space and enables auto-fit; resize preserves a manually adjusted camera. Lock disables the seven camera actions and direct map gestures; Unlock remains available. |
| Mobile overlays | Only the top managed sheet is interactive. Tab wraps, Escape closes the top surface, and nested closes restore focus. A native Seal Lab dialog retains priority. |
| Typing | Editable text uses at least 16px mobile type. Composition guards preserve IME candidate keys. Drafts stay in their existing DOM nodes through viewport transitions. |
| Forms | Headers and primary actions stay outside the scrolling fields, preventing a sticky action bar from covering form controls. Empty Projects have a dismissible form and a persistent New mission action. |
| Source handoff | The desktop header opens the source package and guide. On mobile, the same link sits in the Projects drawer, leaving the primary mission controls clear. The handoff provides a direct return to Compass. |

The camera actions are folded behind View and use two rows on compact screens. The workspace dock yields to modal sheets and the keyboard; it restores the original controls to their desktop placement when leaving the mobile layout. Safe-area insets, visual viewport width/height, and viewport offsets position sheets around available screen space. The visual viewport keyboard heuristic is used for layout behavior; it is not a claim that every iOS keyboard has been reproduced in testing.

## Replay and adaptive views — incoming implementation

- A mission could render between its opening event and its first council seat. An empty seal signature incorrectly looked initialized, so rendering accessed missing SVG nodes and interrupted replay. Both the focused-project and overview constructors now initialize that state correctly.
- Changing the focused project reset playback to the live edge. Focus-only entry now preserves the shared cursor and playing/paused state; explicit trace import/reset remains a separate transition.
- Event-driven refreshes reset the previous frame timestamp. One frame owner now preserves elapsed replay time across events while camera smoothing uses its own bounded animation delta.
- Inactive projects could show later state than the replay cursor. Scrubbing, playback, jumps, live transitions, and retracing now seek the visible Projects consistently. Delayed reports are retained in the trace without advancing a replay that has not reached them.
- The mobile canvas relied on fixed height deductions and permanently exposed camera controls. The adaptive dock reuses the existing controls, folds camera actions on demand, and derives canvas height from available space. Compact, short-landscape, and tablet modes follow viewport shape rather than device names.
- The selected mission's floating notes could cover its summary actions. Mobile card mode now uses one compact summary; detailed council/task/request information stays in the existing detail sheets and Activity. Camera controls temporarily replace the summary without clearing selection.
- A scope-only toolbar resize changed the canvas after the camera had fitted it. Measured stage-height changes notify the camera about available space. In the combined contract, those notifications refit only in auto-fit mode and retain a manually adjusted camera. Focus fallback selects a visible mobile Missions action instead of the hidden desktop header action.

### Historical incoming browser evidence — before the combined layout

The [incoming pre-combination audit record](tests/evidence/replay-mobile-layout-audits.json) contains **57 successful settled Chrome audits**, with diagnostic failures and their later fixes retained separately. There are 56 mobile/tablet audits across the 17 mobile viewport sizes listed in the matrix below, plus one 1280×800 desktop reference. The coverage includes overview, focused project, playing replay, expanded camera controls, mission browser, mission details, compact summary, and conversation drafts. It does not claim every combination of surface and size was exercised.

All recorded mobile audits found no document horizontal overflow, no fully visible enabled HTML control below 44×44 CSS pixels, and no occluded center among those controls. Every recorded primary control was fully visible and reachable. The harness excludes SVG marks and controls outside their scroll region; very short views can scroll vertically. Desktop fine-pointer targets retain desktop sizing.

Observed interactions included playback across mission opening/seating and project changes, continued playback while browsing missions, reaching the live edge, scrubbing to the start, and Go live returning to the end. Conversation draft text survived 320×568, 390×360, 852×393, and 1024×768 transitions. Camera expansion persisted through resizing. Escape restored the selected mission summary; Back to project focused the visible mobile Missions action. Scope changes refitted the overview after the measured stage height changed. The repository-only capture `tests/evidence/replay-mobile-320.jpg` records that workspace and is excluded from the handoff.

The record includes application source fingerprints from the incoming branch before this merge; they do not identify or validate the combined artifact. These are real historical Chrome CSS viewport checks, not physical-device, Safari, native keyboard, VoiceOver, or multitouch certification. The earlier 72-audit matrix and supplemental checks below document the preceding layout separately.

## What the historical mobile review found and fixed

- Mission browsing had no unified search/filter surface or durable mission-level navigation route.
- Detail/familiar/agent transitions could remove the focused control or reveal new content below the visible sheet.
- Periodic refreshes could rebuild focused agent details.
- An empty Project's automatic New mission form could trap mobile navigation because it could not close.
- Project editing attempted to focus an input while its sheet was still inert.
- Crossing a desktop/mobile breakpoint could dismiss the mission drawer while preserving only its query.
- The narrow traversal toolbar hid Fit and Lock in horizontal overflow.
- Tablet landscape switched to small desktop targets too early.
- Message actions depended on hover and could overlap message metadata.
- Some form disclosures, Broadcast, removal controls, and Seal Lab controls were smaller than the mobile hit-target criterion.
- Legacy keyboard/wheel camera paths did not synchronize navigation state and the new dock.
- Mission search and several editable surfaces lacked complete composition-key guards.
- The one-pointer map handler could not handle pinch/pan transitions reliably; the replacement tracks pointer identity, cancellation, bounds, and camera lock.

## Historical incoming source regression record

Before combination with the layout/crown branch, `node --test tests/*.test.cjs` passed **71/71** tests for the incoming replay/adaptive-mobile follow-up. These are historical per-file counts, not the combined total:

| File | Tests | Scope |
| --- | ---: | --- |
| `tests/presentation.test.cjs` | 7 | Scope visibility, familiar filtering, replay model changes, and retained seal geometry. |
| `tests/navigation.test.cjs` | 11 | Route parsing/formatting, malformed links, repeated mission IDs across Projects, and stale selection cleanup. |
| `tests/mobile-interactions.test.cjs` | 13 | Pointer transitions, centroid anchoring, pan/orbit bounds, lock, orbit recovery, viewport offsets, and keyboard geometry. |
| [tests/mobile-ui.test.cjs](tests/mobile-ui.test.cjs) | 14 | Portals, nested overlays, focus restoration, Tab/IME handling, viewport scheduling, native-dialog priority, original-node workspace controls, adaptive modes, header resize, and camera Escape. |
| [tests/mobile-focus.test.cjs](tests/mobile-focus.test.cjs) | 1 | Returning from mission scope chooses a visible mobile, desktop, or map focus target. |
| `tests/mission-interactions.test.cjs` | 11 | Empty-Project recovery, form focus order, explicit agent reveal, stable agent DOM/focus, and disappearing actions. |
| [tests/replay-clock.test.cjs](tests/replay-clock.test.cjs) | 9 | Project focus, playing/paused position, elapsed frame timing, shared live extent, empty Projects, recording/live completion, and frame recovery. |
| [tests/replay-render.test.cjs](tests/replay-render.test.cjs) | 3 | Actual focused/overview seal rendering before seating; event progression, closure, and backward seeks. |
| [tests/replay-emission.test.cjs](tests/replay-emission.test.cjs) | 2 | Delayed inactive reports preserve playing or paused replay until the cursor advances or Go live is selected. |

These execute real extracted functions or shared modules with DOM facades and numeric inputs. They do not provide a browser layout engine or emulate iOS.

The preceding pass also recorded standalone JavaScript syntax checks, inline-script compilation, static asset/ID checks, CSS structural checks, and `git diff --check`. No non-extension application errors were observed in that pass's final inspected Chrome interaction logs. Those results apply to its recorded revision.

## Historical verified evidence — earlier mobile baseline

### Historical regression suite

The pre-layout mobile pass ran `node --test tests/*.test.cjs` and recorded **51/51** tests. These are historical counts for that checkpoint, not the current source-suite total:

| File | Tests | Scope |
| --- | ---: | --- |
| `tests/presentation.test.cjs` | 7 | Scope visibility, familiar filtering, replay model changes, and retained seal geometry. |
| `tests/navigation.test.cjs` | 11 | Route parsing/formatting, malformed links, repeated mission IDs across Projects, and stale selection cleanup. |
| `tests/mobile-interactions.test.cjs` | 13 | Pointer transitions, centroid anchoring, pan/orbit bounds, lock, orbit recovery, viewport offsets, and keyboard geometry. |
| `tests/mobile-ui.test.cjs` | 9 | Portals, nested overlays, focus restoration, Tab/IME handling, viewport scheduling, and native-dialog priority. |
| `tests/mission-interactions.test.cjs` | 11 | Empty-Project recovery, form focus order, explicit agent reveal, stable agent DOM/focus, and disappearing actions. |

These execute real extracted functions or shared modules with DOM facades and numeric inputs. They do not provide a browser layout engine or emulate iOS.

At that pre-layout checkpoint, standalone JavaScript syntax checks, inline-script compilation, static asset/ID checks, CSS structural checks, and `git diff --check` also passed. No non-extension application errors were observed in the Chrome logs inspected during that historical interaction run.

### Historical rendered layout matrix

The historical record contains **72 settled Chrome audits**: four core surfaces at 17 mobile/tablet sizes, three desktop reference audits, and one final Project-form audit. Before measuring, the harness waited two animation frames for responsive portals and viewport variables to settle. These audits precede the current scalable-layout refinement.

| Family | CSS viewport sizes |
| --- | --- |
| Compact and standard phones | 320×568, 360×640, 375×667, 390×844, 402×874, 430×932 |
| Duo-oriented stress sizes | 466×678, 626×890, 890×626, 678×466 |
| Split-width layouts | 320×626, 600×800 |
| Tablets | 768×1024, 834×1194, 1024×768 |
| Short landscape | 852×393 |
| Constrained height | 390×360 |
| Desktop reference | 1280×800 |

The four core surfaces were the Coven overview, mission browser, mission Brief, and conversation. All **69 recorded mobile/tablet audits** reported:

- No document horizontal overflow.
- No fully visible enabled HTML control smaller than 44×44 CSS pixels.
- No occluded center among those fully visible controls.

All overview camera controls, including Fit and Lock, were reachable at each mobile size. Desktop fine-pointer references retain their smaller desktop controls; they are not counted as failures against the mobile target criterion.

The harness excludes hidden/inert content, content inside closed disclosures, SVG map marks, disabled controls, and controls outside their scroll region. It checks geometry and hit testing, not all accessibility semantics, contrast ratios, device performance, or every application state. A reduced-height iframe is a layout stress test, **not** an emulated iOS keyboard.

After integrating a concurrent source-handoff revision, the merged header was rechecked at 320×568, 390×844, 760×600, 768×1024, 1024×768, 852×393, and the 1280×800 desktop reference. No header overlap, document overflow, or unreachable primary controls was observed. The mobile Projects drawer's handoff link also measured 44px high and remained reachable at 320×568 and 390×844. These supplemental checks are recorded separately from the original 72-audit matrix.

The handoff landing page, guide navigation, and readiness chapter also passed the visible-control audit at 320×568 after enlarging their mobile navigation links. Return to Atlas, browser Back through the handoff, and the readiness chapter anchor were exercised. A separate desktop header check with Psyche docked and the map reduced to 780px found no overlap or unreachable header controls. The supplemental record contains 12 full layout audits plus that targeted desktop header check.

### Historical browser interaction checks

Observed directly in Chrome at the pre-layout checkpoint:

1. Search, no-result recovery, row keyboard selection, section keyboard navigation, familiar drill-down, Previous/Next, and return to retained mission search.
2. Mission detail heading focus; agent detail reveal; Close returning to the original agent row.
3. Conversation Tab wrapping, minimizing/reopening, and nested return to the invoking mission control.
4. Draft text containing accented characters, Japanese text, and emoji surviving phone/landscape/unfolded/tablet/desktop transitions. This verifies text retention, not a real Japanese IME session.
5. Dormant Project → Close → New mission; dismiss/reopen with retained text; switching to another Project.
6. Form fields and actions remaining unobstructed at 390×360, 890×626, and 320×568; expanded brief options remained reachable.
7. Project Edit focusing Name after activation and returning to Edit on close.
8. Back closing an open mission drawer and restoring the previous mission; Forward and reload restoring the next mission and section.
9. Legacy bookmark formats (since removed, 2026-11-19) and missing-mission fallback.
10. Replaying before a selected mission existed removed the inspector, cleared selection, and announced the reason.
11. Direct 2D pan preserved projected geometry; 3D orbit changed geometry and recovered from its lower bound; locked drag left the camera unchanged and disabled the other seven dock controls.
12. Keyboard tilt updated the 2D/3D control state, and keyboard zoom into the overview updated the URL.
13. Seal Lab opened above mission details on desktop, stayed open while resizing to mobile, and returned focus to mission details after Escape. Its controls measured at least 44px at 390×844, 320×568, 852×393, and 390×360; no internal horizontal overflow was observed.

The zoom-driven overview/route observation in item 12 describes the historical behavior. The current explicit Coven/project scope contract in [guide 15](docs/handoff/15-scalable-atlas-layout.md) supersedes that positioning/navigation assumption and requires a fresh interaction check.

### Historical evidence files

- [Incoming replay/adaptive-mobile audits and fingerprints](tests/evidence/replay-mobile-layout-audits.json) — before this combined layout.
- [Recorded layout audits](tests/evidence/layout-audits.json)
- [Merged header and handoff checks](tests/evidence/merged-layout-audits.json)
- [Source fingerprints](tests/evidence/source-fingerprints.json)
- Repository-only replay capture: `tests/evidence/replay-mobile-320.jpg` — excluded from the exported handoff.
- Repository-only overview capture: `tests/evidence/map-390.jpg` — excluded from the exported handoff.
- Repository-only mission capture: `tests/evidence/mission-390.jpg` — excluded from the exported handoff.

The JSON fingerprints identify the historical mobile-matrix source commit `9c7be88ca6797ef45a95764e2944653a399ee5c4` and the subsequent handoff merge checkpoint `8eb108515b45a22bef5826fe2d4888845bace63a`. The supplemental checks cover that merged header and handoff. They do not fingerprint or accept the newer layout, crown, viewport, density, sample controls, or incoming replay changes. The replay/mobile audit carries a separate fingerprint set for its incoming branch; that set also predates the combined source. The current export's manifest and checksums identify delivered bytes; they do not transform historical browser evidence into current acceptance.

The preserved captures are Chrome CSS viewport renders, not iPhone captures. JSON audit and provenance records remain in the export; browser JPGs remain in the repository only.

## iPhone Duo assumptions and acceptance boundary

Apple's published specifications list an outside display of 1398×2034 physical pixels and an inside display of 1878×2670 physical pixels. The Duo-oriented stress sizes above divide these by an **assumed** 3× ratio. Apple’s cited specifications do not establish the Safari CSS viewport or device-pixel ratio used by this test. Treat these presets as useful shape tests, not exact device profiles.

Apple describes transitions among folded/unfolded use, portrait/landscape, and Split View. The implementation handles ordinary viewport/pointer changes and retains the same DOM nodes; actual folding and multitasking events must still be exercised on hardware.

### Physical-device release acceptance

These cases remain **unverified**. They are the next acceptance gate for a production device claim, not failures observed in the historical browser run.

| Case | Pass criterion |
| --- | --- |
| Actual Duo display geometry | Record `innerWidth/innerHeight`, visual viewport dimensions/offsets, DPR, orientation, and safe areas on both displays; repeat the core flows at those observed sizes. |
| Fold/unfold with active work | Mission, familiar, tab, filters, draft text, caret, and scroll context remain coherent through display transitions. No sheet remains inert or offscreen. |
| Split View resizing | Drag through supported pane widths, including the smallest permitted width; controls stay reachable and the active sheet retains focus. |
| Software keyboard | Open/dismiss normal and emoji keyboards, rotate while typing, switch fields, select text, and use predictive text. Input and primary action stay visible without page jumps or input zoom. |
| Real IME and dictation | Japanese/Chinese composition, candidate arrows, Escape, hardware Return, and dictation do not prematurely submit, dismiss, or move focus. |
| Multi-touch | Two-finger pinch plus translation, adding/removing fingers, pointer cancellation, interruption, and pinch at zoom limits remain stable. Single-finger page/sheet scrolling is distinct from map manipulation. |
| Safari navigation gestures | Edge Back/Forward and reload restore the intended route without an obscuring drawer or abandoned focus. |
| VoiceOver | Rotor order, selected tabs, live announcements, nested sheets, form labels/errors, agent reveal, and focus return are usable without sight. |
| Text and accessibility settings | Larger Text/page zoom, Reduce Motion, and Increase Contrast preserve reading, hit targets, and task completion at short heights. |
| Sustained use | Exercise repeated gestures, long conversation history, mission switches, and background/foreground recovery; record frame pacing, memory, thermal behavior, and battery impact. No device performance claim has been made from the current checks. |

No physical iPhone, Safari/WebKit run, on-screen iOS keyboard, actual folding hardware, VoiceOver session, or native application packaging evidence is established by this handoff. Historical browser captures and source-fixture success must not substitute for that evidence.

## Reproduce the checks

Run the current source suite and crown check; record their actual outcomes rather than copying the historical test total:

```sh
node scripts/check-source.mjs
node --test tests/*.test.cjs
node scripts/test-atlas-crown.mjs
```

When permitted browser access is available, start `sites-preview` from the checkout following the Sites workflow. Temporarily copy `tests/mobile-qa.html` to `dist/__mobile-qa.html`, open that exact preview page, choose a preset, perform the user interaction, and select **Audit visible layout**. The harness does not click or type inside the Site. Its iframe remains loaded during resizing so draft and selection retention can be checked. These are reproduction instructions for an available, authorized browser environment; they do not bypass the current policy block or imply a new browser run occurred.

Remove `dist/__mobile-qa.html` before packaging. Only the Site itself belongs in the deployed static directory. Keep the source harness and evidence in `tests/`.

## Primary references

- [Apple — iPhone Duo technical specifications](https://www.apple.com/iphone-duo/specs/): physical display dimensions; no CSS viewport/DPR claim inferred as fact.
- [Apple — iPhone Duo](https://www.apple.com/iphone-duo/): display/orientation transitions and Split View use cases.
- [Apple Human Interface Guidelines — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons): touch-target and interaction guidance. The web audit uses a 44×44 CSS-pixel criterion, while Apple's native guidance is expressed in points.
- [WebKit — New WebKit Features in Safari 13](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/): Pointer Events and VisualViewport background. API availability is not evidence that this Site has passed physical Safari acceptance.
