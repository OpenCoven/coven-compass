# Scalable 2D Atlas layout

Compass displays a local simulation on a flat map. This guide describes the layout, navigation and detail rules for desktop and narrow viewports.

The inspected implementation surfaces are [`atlas-layout.js`](../../dist/atlas-layout.js), [`atlas-viewport.js`](../../dist/atlas-viewport.js), [`atlas-crown.js`](../../dist/atlas-crown.js), and the surrounding [scene](../../dist/index.html) and [UI adapter](../../dist/atlas-ui.js). These presentation helpers remain separate from authoritative orchestration state. This guide supersedes earlier overview positioning and zoom-driven scope assumptions. Read it alongside the [visual contract](08-visual-and-interaction-contract.md), [ownership map](02-architecture-and-ownership.md), and [security and authority requirements](09-security-and-authority.md).

## 1. What the geometry means

| Representation | Meaning | Constraint |
| --- | --- | --- |
| Project outline | One project in the Coven overview | Connect the scope to its coordination route and show its mission total. |
| Mission count inside a Project | Exact known mission total in that Project | Enter the Project or use the searchable mission browser for individual seals and details. |
| Central crown badge | Psyche coordinates the displayed scope | Use the same canonical silhouette at every size. |
| Shared branch corridor | A readable coordination connection from Psyche to a project | Shared segments do not assert execution order, dependencies, network connectivity, or shared permissions. |
| Inward-facing Project gate | Where that project's coordination route meets its enclosure | The direction is geometric. North, east, south, and west do not create authorization categories. |
| Position in the lattice | A stable presentation slot | Nearness to Psyche does not imply importance, ownership, scheduling priority, or stronger authority. |

All overview Projects use the same enclosure vocabulary, including the currently selected project. Selecting a project elsewhere must not unexpectedly substitute its full internal scene into the overview. Familiar colors and glyphs retain their existing identity-recognition role; selection and urgency remain separate signals. Exact familiar roots and revisions belong to the verified data binding, never to color or shape. [Visual contract](08-visual-and-interaction-contract.md)

## 2. Compact placement for a changing project count

The layout helper accepts an ordered collection of unique project keys. It reserves a central hub and fills nearby lattice cells in opposite pairs. This produces a compact arrangement with balanced space around Psyche, including when the project count is odd. It avoids enlarging a single ring every time a project is added. The usable aspect ratio influences which nearby cells are selected: a wide canvas favors horizontal space, while a narrow canvas makes greater use of vertical space. [Layout source](../../dist/atlas-layout.js)

Overview Projects show a miniature of their missions inside a flat outline. In Project scope, mission rings surround the central Psyche badge. Connections meet the edge of each symbol. Enter a mission to inspect its familiars, tasks and agents.

Each cell reserves the complete Project-and-label rectangle, not just the outline. The gaps between those rectangles are routing corridors. Routes leave the hub boundary, share suitable corridor segments, and make their final approach through the destination's inward-facing cardinal gate. A route may enter its own destination rectangle; it must not pass through another project's reserved space. The renderer must respect the helper's `maxCornerRadius` when rounding a branch, because excessive rounding can consume the reserved clearance.

At unchanged geometric options, appending keys preserves existing node positions. That guarantee depends on preserving caller order. Reordering keys, inserting an item earlier in the order, changing the available aspect ratio, or changing reserved dimensions can legitimately produce a different layout. Keep a stable project ordering at the adapter boundary; do not sort on rapidly changing agent counts or progress every frame. Filtering should retain spatial context where practical, and a change of project membership must remain distinguishable from a presentation rearrangement.

“N-many” means that placement is data-driven and has no hardcoded four-project or sixteen-project scenario. It does **not** promise unlimited rendering performance. Finite geometry, DOM cost, text legibility, interaction targets, and device limits still constrain useful detail. At dense counts, favor compact summaries, search, and project drilldown. The renderer releases offscreen miniature details while keeping the Project controls available for navigation and search.

Within a visible Project, the Coven map previews mission rings, familiar branches and task ownership as space permits. Small enclosures use an exact count. The Projects drawer lists the first mission names alongside each total. Project names appear when the projected enclosure is wide enough and remain available to assistive technology, the Projects drawer, and hover or focus. Density uses separate entry and exit thresholds to reduce flicker during zoom. At compact sizes, the boundary square marks a pending decision and the Project label and drawer provide the exact count. The larger badge has its own review target when there is room.

### Explore larger Covens without removing user projects

The Projects drawer provides project-name search, sample presets and a custom Project total. Presets add or remove only generated layout samples to approach the requested total. Existing baseline and user-created Projects are preserved; if that existing collection is already larger than a preset, the actual total remains larger. **Remove extra samples** removes only entries marked `layoutDemo`, rather than resetting the user's project collection. These are local simulation controls, not operations on external projects.

The former cosmetic sixteen-Project and twelve-mission creation caps have been removed. Mission resource bounds and protected decision/brief rules retain their separate semantics; removal of presentation creation caps grants no additional authority. The eight-seal overview cap still bounds presentation, and the supplied 128-Project preset remains a composition example rather than a system capacity limit or performance result. [Sample controls and implementation](../../dist/atlas-ui.js)

## 3. Eight seals, an honest remainder, and the full collection

`missionPacking(count, options)` supplies a bounded overview arrangement: up to eight seal slots and, when needed, one additional overflow slot. It returns `total`, `visible`, `hidden`, the visible positions, the overflow position/count, and a suitable seal radius. The helper does not change mission priority, state, progress, or the source collection. Caller order determines which missions occupy the visible slots. [Packing implementation](../../dist/atlas-layout.js)

A Project with thirteen missions can show eight miniature rings and a +5 remainder. In Project view, a shaded capsule beside each mission groups its recorded tasks by familiar color. A cog represents one task even before an agent is assigned. Up to three cogs appear beside the ring, followed by an exact overflow count. Activate the capsule to read every task name and its assignments. Mission titles wrap at word boundaries. A long word can shorten with an ellipsis and its full name remains accessible.

Keep the complete known Project total separate from the number matching an active filter. Preserve readable council segments and show exact assigned and working counts in mission details. [Seal limits](08-visual-and-interaction-contract.md)

The prototype can calculate exact totals from its complete in-memory fixtures. A production adapter may receive a partial page or unavailable count. In that case, retain coverage and freshness information and show an unknown or qualified total. Do not calculate an apparently complete `+N` from an incomplete page, and do not turn unavailable missions into a zero-mission dormant Project. Search and drilldown give access to the known collection. Show its coverage separately.

## 4. Scope and camera are separate controls

The interface needs an explicit **Coven** scope and an explicit **project** scope. Scope determines the collection, relationships, navigation context, and available details. Camera zoom determines how large that chosen scope appears. A zoom threshold must not silently change one scope into the other.

Opening a Project changes scope. Panning and zooming frame the selected scope. The overview control returns to Coven.

Maintain an explicit auto-fit mode rather than inferring it from the current zoom factor. Initial entry and an intentional Fit action may enable auto-fit. A manual camera adjustment should preserve the user's framing. A resize may refit the scene only while auto-fit is active; it must not reset a manually chosen camera simply because a drawer, inspector, or viewport changed size. If an explicit scope change establishes a new framing, make that navigation behavior consistent and test it separately from resize handling.

Fit includes the visible badge and label bounds in both scopes.

### Measure the usable canvas

Fit the projected content into the area actually available after visible chrome is accounted for. This includes the header, bottom familiar controls, and any inspector or panel that occludes the scene. Use measured rectangles and label extents rather than assuming a fixed screen size or compensating with a global scale constant.

The world-coordinate layout bounds include reserved Project rectangles, routes, hub, and padding. The camera layer additionally owns projection, screen-space labels, and chrome-safe insets. A label that remains fixed in screen pixels cannot be treated as if it always scales with the world. Reserve its measured space when fitting, and recompute when relevant typography or visible chrome changes. Handle a temporarily zero-sized viewport without generating invalid camera coordinates.

Use resize observation to update available dimensions, then apply the auto-fit policy. Coalesce repeated measurement changes into one presentation update. Preserve manual framing and avoid a measurement loop in which changing the camera repeatedly changes the dimensions being measured. This is presentation state; it must never write orchestration or identity state.

### Adaptive workspace, keyboard, and replay integration

The mobile dock moves the existing replay and camera controls into Map, Missions, Activity, and View surfaces. Reusing those DOM nodes preserves their event handlers, draft/control state, and single replay owner. Compact, short-landscape, and tablet arrangements derive stage height from the visible viewport and measured header/dock space. Returning to desktop restores the controls to their existing positions. [Mobile implementation](../../dist/mobile-ui.js)

Update the lead-card structure before a queued fit measures it. Crossing the compact breakpoint can replace a manifest with a nested mobile HUD, so fitting against the previous structure produces incorrect safe space. Reserve the rendered HUD where it actually sits, and exclude CSS-hidden, DOM-hidden, or non-rendered chrome. A full mobile modal inspector obscures an inert map and is excluded from canvas-fit reservations; ordinary visible nonmodal inspector space still participates. The existing camera-dock and familiar-control observers cover popup closure and other size notifications without introducing a separate observer or camera owner.

Keyboard state is checked both when viewport changes arrive and inside the queued fit callback. A callback queued before the keyboard opens must not reframe the map while the user types. After it closes, automatic fitting resumes only if auto-fit remains enabled and the camera is unlocked. A manual camera adjustment continues to suppress incidental resize fitting.

The shared live replay cursor is separate from the camera. Project focus preserves playback time and playing/paused state; imported recordings retain their own extent and finish paused. Event-driven refreshes preserve elapsed replay time while camera smoothing uses its own bounded delta. All visible live Projects seek the shared cursor, and delayed reports remain in the trace without advancing replay prematurely. This is local demonstration playback, not authoritative execution time or a daemon event log.

When replay removes a selected mission, selection reconciliation restores the saved camera position **and its saved auto-fit policy**. Restoring zoom/pan alone would allow a later resize to erase the user's manual framing. Keep this cleanup distinct from an explicit Fit or scope-navigation action. The combined regression suite covers these interaction boundaries through source functions and DOM facades; browser rendering and physical keyboard behavior remain separate acceptance work. [Scene and replay integration](../../dist/index.html) · [Integration tests](../../tests/atlas-integration.test.cjs)

## 5. Flat presentation is a product restriction

Compass draws the map, badges, rings, previews and Seal lab on a single upright plane. The canonical lavender crown and its aperture identify Psyche at every scale. A familiar’s glyph, color and label are stable when selected. The inspector exposes exact counts and progress.

Introducing a third dimension requires Val’s explicit override of the 2D-only restriction in the issue or PR before implementation. Cite that decision and update the product invariant, source guard and rendered acceptance checks together. Preferences, imported recordings and navigation routes cannot enable a different renderer. [Contributor instructions](../../AGENTS.md)

## 6. Integrate through existing owners

The following boundaries are supplied architecture requirements, not claims that production repositories have been inspected or integrated. [Canonical ownership](02-architecture-and-ownership.md)

| Component | Integration responsibility |
| --- | --- |
| Coven Host | Present the existing workspace/project arrangement and discover its canonical bindings. Folder location and synced files do not create daemon authority. |
| Coven | Retain daemon authority, durable state, sessions, runtime execution, and authoritative transitions. A layout snapshot is never a writable substitute. |
| Psyche | Supply canonical task, lane, lease, approval, receipt, retry, and recovery semantics. Visual routes do not add dependency edges to that model. |
| Coven Compass | Derive the human-readable scope, geometry, summaries, selection, and navigation from authorized projections. Keep camera and layout state local to presentation. |
| Cave | Reuse the presentation adapter and geometry where appropriate, while preserving production oversight, accessibility, freshness, and decision behavior. |
| Psyche Build | Reuse the same canonical projection mapping for coding missions and lanes. Do not introduce a separate scheduler or approval implementation to support this map. |
| Coven CLI | Query and request actions through existing canonical bindings. Do not create a second persistence store or control plane to synchronize with the visualization. |
| SDK / Brand / UI | Provide existing public bindings, approved identity assets/tokens, and reusable presentation specimens within their established ownership. |

Before connecting live data, inspect the owning repositories and map their existing identifiers and state fields. Keep that mapping in a constrained presentation adapter rather than declaring this Site's fixture objects a new canonical schema. Familiars remain bound to an exact authorized root and revision. Pending decisions remain pending; a gate marker, route, selected Project, or crown never grants permission to commit a protected operation. Connection, freshness, and availability remain separate from mission lifecycle state. [Authority requirements](09-security-and-authority.md)

## 7. Implementation sequence and execution tips

1. **Preserve stable inputs.** Resolve project keys, caller order, complete or qualified totals, familiar bindings, and scope through the existing adapter. Keep operational state out of geometry functions.
2. **Compute one layout snapshot.** Call `CovenAtlasLayout.layout(keys, options)` with measured available aspect and reserved Project/label dimensions. Cache by ordered keys and normalized geometric options, not by every mission-progress tick.
3. **Render one overview vocabulary.** Use the uniform four-corner Project for each project. Place routes from the returned points and gate metadata, respecting corridor clearance and maximum corner radius.
4. **Bound map detail.** Show Project totals on the overview. Use spacing to reveal mission labels and selected agents. The Missions browser provides the full collection.
5. **Keep scope explicit.** Connect project opening, Coven return, and search results to navigation. Connect Fit and camera gestures to camera state. Avoid zoom-based scope switching.
6. **Fit the measured safe area.** Include projected geometry and screen-space labels, observe relevant chrome changes, and refit on resize only in auto-fit mode.
7. **Reuse the crown.** Draw the canonical symbol at the required size and preserve its accessible activation target.
8. **Record integrated evidence.** Validate source geometry first, then the actual browser interaction and packaged artifact. A source-only pass does not qualify live data, touch behavior, or production authority.

## 8. Verification scope and remaining acceptance

**Combined source-level result:** `node scripts/verify-all.mjs` runs the suite, the crown check (canonical digest, aperture, bounds, stable nodes, and every view/size combination), the static source checker, and a clean-extraction rebuild and archive verification. It records the current counts in [`tests/evidence/current.json`](../../tests/evidence/current.json). The earlier layout-branch extraction/rebuild remains historical evidence in [chapter 01](01-current-state-and-evidence.md), not verification of this combined ZIP. Source success does not establish browser acceptance.

The layout test sweep covers selected project counts **0, 1, 2, 4, 8, 12, 24, 64, and 128** and geometric invariants. Mission-packing integration covers every integer count from 0 through 128. This is a bounded source-level correctness range, not a load test, production benchmark, browser frame-rate claim, or maximum supported project count. The crown check covers canonical-path provenance, finite geometry, preserved aperture, bounded footprint, and record reuse. Refer to the tests for their precise cases. [Layout tests](../../tests/atlas-layout.test.cjs) · [Crown check](../../scripts/test-atlas-crown.mjs)

Relevant focused commands are:

```sh
node --test tests/atlas-layout.test.cjs
node scripts/test-atlas-crown.mjs
node scripts/check-source.mjs
```

Use revision-specific browser evidence to qualify the rendered map. Cover open and closed panels, dense counts, project search, mission drilldown, keyboard and touch navigation, text legibility, route clearance and manual framing.

Check desktop and narrow viewports at several zoom levels. Inspect the same mission ring in the map and Seal lab, and confirm that restoring old view preferences keeps it on the drawing plane.

Older screenshots or unrelated mobile checks do not establish acceptance of this refinement. No daemon integration, live authorization behavior, production throughput, or cross-device persistence is demonstrated by these presentation tests. Use the existing [validation plan](07-validation-and-acceptance.md) and [evidence record template](templates/evidence-record.md) for the integration's remaining gates.

Locally generated SVG specimens illustrate the source geometry only. They are not browser screenshots, interactive QA, or device-performance evidence.
