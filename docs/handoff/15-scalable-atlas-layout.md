# Scalable Atlas layout and dimensional crown

**Status: implemented; combined source-level verification passed.** This user-requested refinement makes the Coven overview work with a changing number of projects and missions while preserving the existing visual language, and incorporates the adaptive mobile workspace and shared local replay clock. Browser, physical-device, and performance acceptance remain unverified; combined clean-extraction, rebuilding, and package verification passed. The refinement supplies presentation and local simulation behavior; it does not connect the Site to a Coven daemon or establish production readiness.

The inspected implementation surfaces are [`atlas-layout.js`](../../dist/atlas-layout.js), [`atlas-viewport.js`](../../dist/atlas-viewport.js), [`atlas-crown.js`](../../dist/atlas-crown.js), and the surrounding [scene](../../dist/index.html) and [UI adapter](../../dist/atlas-ui.js). These presentation helpers remain separate from authoritative orchestration state. This guide supersedes earlier overview positioning and zoom-driven scope assumptions. Read it alongside the [visual contract](08-visual-and-interaction-contract.md), [ownership map](02-architecture-and-ownership.md), and [security and authority requirements](09-security-and-authority.md).

## 1. What the geometry means

| Representation | Meaning | Constraint |
| --- | --- | --- |
| Castle courtyard | One project within the displayed Coven scope | Corner towers and curtain walls frame the Project. Openings align with route gates. |
| Mission count inside a Project | Exact known mission total in that Project | Enter the Project or use the searchable mission browser for individual seals and details. |
| Central canonical crown | Psyche coordination in the displayed scope | Its relief does not encode priority, progress, authority, or a separate identity. |
| Shared branch corridor | A readable coordination connection from Psyche to a project | Shared segments do not assert execution order, dependencies, network connectivity, or shared permissions. |
| Inward-facing Project gate | Where that project's coordination route meets its enclosure | The direction is geometric. North, east, south, and west do not create authorization categories. |
| Position in the lattice | A stable presentation slot | Nearness to Psyche does not imply importance, ownership, scheduling priority, or stronger authority. |

All overview Projects use the same enclosure vocabulary, including the currently selected project. Selecting a project elsewhere must not unexpectedly substitute its full internal scene into the overview. Familiar colors and glyphs retain their existing identity-recognition role; selection and urgency remain separate signals. Exact familiar roots and revisions belong to the verified data binding, never to color or shape. [Visual contract](08-visual-and-interaction-contract.md)

## 2. Compact placement for a changing project count

The layout helper accepts an ordered collection of unique project keys. It reserves a central hub and fills nearby lattice cells in opposite pairs. This produces a compact arrangement with balanced space around Psyche, including when the project count is odd. It avoids enlarging a single ring every time a project is added. The usable aspect ratio influences which nearby cells are selected: a wide canvas favors horizontal space, while a narrow canvas makes greater use of vertical space. [Layout source](../../dist/atlas-layout.js)

The Coven is drawn as a kingdom of Project castles. Plan and orbit project the same courtyard, curtain walls and towers. The footprint is shared across the overview, with roof and battlement detail revealed at larger scales. This architectural metaphor represents Project scope. Hosted Castle records retain their separate meaning in D01. Inside a Project the boundary can grow additional sides as missions accumulate. Psyche occupies a circular coordination disc with the upright crown in both scopes. Routes meet the overview disc at its edge. Plan view shows the face alone, and orbit reveals a shallow base proportional to its radius.

Each cell reserves the complete Project-and-label rectangle, not just the outline. The gaps between those rectangles are routing corridors. Routes leave the hub boundary, share suitable corridor segments, and make their final approach through the destination's inward-facing cardinal gate. A route may enter its own destination rectangle; it must not pass through another project's reserved space. The renderer must respect the helper's `maxCornerRadius` when rounding a branch, because excessive rounding can consume the reserved clearance.

At unchanged geometric options, appending keys preserves existing node positions. That guarantee depends on preserving caller order. Reordering keys, inserting an item earlier in the order, changing the available aspect ratio, or changing reserved dimensions can legitimately produce a different layout. Keep a stable project ordering at the adapter boundary; do not sort on rapidly changing agent counts or progress every frame. Filtering should retain spatial context where practical, and a change of project membership must remain distinguishable from a presentation rearrangement.

“N-many” means that placement is data-driven and has no hardcoded four-project or sixteen-project scenario. It does **not** promise unlimited rendering performance. Finite geometry, DOM cost, text legibility, interaction targets, and device limits still constrain useful detail. At dense counts, favor compact summaries, search, and project drilldown. Introducing viewport culling or list virtualization later requires measured evidence and must preserve the full accessible collection; it is not established by this geometry helper alone.

The overview uses a single count per Project. Project names appear when the projected enclosure is wide enough and remain available to assistive technology, the Projects drawer, and hover or focus. Density uses separate entry and exit thresholds to reduce flicker during zoom. At compact sizes, the boundary square marks a pending decision and the Project label and drawer provide the exact count. The larger badge has its own review target when there is room.

### Explore larger Covens without removing user projects

The Projects drawer provides project-name search and **Try a larger Coven** presets for **8, 16, 32, 64, and 128** Projects. Presets add or remove only generated layout samples to approach the requested total. Existing baseline and user-created Projects are preserved; if that existing collection is already larger than a preset, the actual total remains larger. **Remove extra samples** removes only entries marked `layoutDemo`, rather than resetting the user's project collection. These are local simulation controls, not operations on external projects.

The former cosmetic sixteen-Project and twelve-mission creation caps have been removed. Mission resource bounds and protected decision/brief rules retain their separate semantics; removal of presentation creation caps grants no additional authority. The eight-seal overview cap still bounds presentation, and the supplied 128-Project preset remains a composition example rather than a system capacity limit or performance result. [Sample controls and implementation](../../dist/atlas-ui.js)

## 3. Eight seals, an honest remainder, and the full collection

`missionPacking(count, options)` supplies a bounded overview arrangement: up to eight seal slots and, when needed, one additional overflow slot. It returns `total`, `visible`, `hidden`, the visible positions, the overflow position/count, and a suitable seal radius. The helper does not change mission priority, state, progress, or the source collection. Caller order determines which missions occupy the visible slots. [Packing implementation](../../dist/atlas-layout.js)

A Project with thirteen known missions shows thirteen in its enclosure. Enter the Project for individual seals or use the searchable mission browser to open a mission directly.

Keep the complete known Project total separate from the number matching an active filter. Preserve the independent wedge and working-pip limits, with exact values in the mission details. [Seal limits](08-visual-and-interaction-contract.md)

The prototype can calculate exact totals from its complete in-memory fixtures. A production adapter may receive a partial page or unavailable count. In that case, retain coverage and freshness information and show an unknown or qualified total. Do not calculate an apparently complete `+N` from an incomplete page, and do not turn unavailable missions into a zero-mission dormant Project. Search and drilldown give access to the known collection. Show its coverage separately.

## 4. Scope and camera are separate controls

The interface needs an explicit **Coven** scope and an explicit **project** scope. Scope determines the collection, relationships, navigation context, and available details. Camera zoom determines how large that chosen scope appears. A zoom threshold must not silently change one scope into the other.

Opening a Project is a scope-navigation action. Returning to Coven is another. Panning, zooming, rotating, or tilting remains camera manipulation within the selected scope. Keep the active scope visible in navigation and preserve a predictable route back to the overview. Search results should carry their project identity so opening a result can establish scope deliberately.

Maintain an explicit auto-fit mode rather than inferring it from the current zoom factor. Initial entry and an intentional Fit action may enable auto-fit. A manual camera adjustment should preserve the user's framing. A resize may refit the scene only while auto-fit is active; it must not reset a manually chosen camera simply because a drawer, inspector, or viewport changed size. If an explicit scope change establishes a new framing, make that navigation behavior consistent and test it separately from resize handling.

The Coven overview defaults to **24° shallow relief**, with overview orbit capped at **45°**; project detail may reach **78°**. These bounds retain clearance for the screen-facing crown and name. Fit includes explicit crown and label bounds rather than treating the compressed ground plane as the entire composition. The crown has no autonomous spinning or animation; changes reflect the chosen view.

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

## 5. One canonical crown with restrained depth

The scene crown uses the existing `#crown` symbol as its exact front and back faces. Derived edge samples form the extrusion's side walls, including the central aperture. The canonical path remains the identity-bearing asset; the sampled geometry is a rendering aid, not an alternative logo. Its provenance is recorded in the renderer and guarded by the dedicated crown check. [Renderer](../../dist/atlas-crown.js) · [Crown check](../../scripts/test-atlas-crown.mjs)

Both map centers use the same lavender as the flat Psyche marks. A single darker lavender rim adds shallow, proportional depth along the bottom. The face stays upright as the camera orbits, preserving the canonical proportions and aperture. The rim is decorative, while mission-seal relief represents progress.

The integration interface is:

```js
const crown = window.CovenAtlasCrown.create(psycheGroup, svgEl);
window.CovenAtlasCrown.draw(crown, {
  x: projectedX,
  y: projectedY,
  size: nominalWidth
});
```

Load the renderer before creating the scene crown. Coordinates are already projected SVG coordinates; `size` is the nominal full width in the same units. Keep the existing group's hit target and accessible Psyche label. The crown's own group is decorative and ignores pointer events. Reuse its record on redraw instead of rebuilding SVG nodes. Apply the same renderer at the Coven center and the project center; scale alone must not change what the crown means.

### Map materials

Project courtyards use staggered flagstones. Paving follows the ground plane through orbit, and masonry joints follow the projected tower and wall faces. Fine paving and path borders drop out when projected courses become too small to resolve. The shapes and colors of decision markers, working agents and mission states carry their own meanings at every scale.

Psyche’s mount and mission seals use a graphite metal finish. Familiar faces and cog hubs retain their identity colors. An engraved groove follows each detailed seal wedge inside the separate resource rim. Seal Lab uses the same geometry as the map, and small inline seals use a single bevel around the face.

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
4. **Bound map detail.** Show Project totals on the overview. Use projected scale and spacing to reveal seal relief and selected agents within the Project. Preserve the selected mission and keep the full collection accessible through the mission browser.
5. **Keep scope explicit.** Connect project opening, Coven return, and search results to navigation. Connect Fit and camera gestures to camera state. Avoid zoom-based scope switching.
6. **Fit the measured safe area.** Include projected geometry and screen-space labels, observe relevant chrome changes, and refit on resize only in auto-fit mode.
7. **Reuse the crown record.** Keep canonical front faces and decorative relief isolated from flat UI marks, hit targets, and semantic mission topography.
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

Headless Chromium QA of the current source ran on 2026-11-19 ([record](../../tests/evidence/browser-qa-2026-11-19.json), summarized in chapter 01); it does not establish Safari, physical-device, real multi-touch, keyboard-only, or screen-reader acceptance. Before calling the integrated result visually accepted, inspect desktop and narrow layouts with chrome open and closed; zero, one, odd, and dense project counts; more than eight missions; exact overflow and aggregate totals; density transitions; project/mission search and drilldown; sample presets and preservation of user-created Projects on reset; keyboard and touch navigation; label overlap; route clearance; explicit scope changes; auto-fit resize behavior; and preservation of a manually adjusted camera. Check the canonical aperture and readable depth at low pitch in both scopes.

Browser QA should cover desktop and narrow layouts in both camera modes. Check dense sample presets, exact Project totals, selection and focus across density changes, label and leader clearance, and the shared seal geometry in Seal Lab.

Older screenshots or unrelated mobile checks do not establish acceptance of this refinement. No daemon integration, live authorization behavior, production throughput, or cross-device persistence is demonstrated by these presentation tests. Use the existing [validation plan](07-validation-and-acceptance.md) and [evidence record template](templates/evidence-record.md) for the integration's remaining gates.

Locally generated SVG specimens illustrate the source geometry only. They are not browser screenshots, interactive QA, or device-performance evidence.
