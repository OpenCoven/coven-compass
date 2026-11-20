# Coven Compass

A private, interactive Site exploration of the supplied Coven Castles v27 prototype. This presentation builds on its existing event-driven simulation; it does not connect to a Coven daemon or confer protected authority.

## Full source and implementation handoff

Open [START_HERE.md](START_HERE.md) for the runnable ZIP workflow and [the handoff index](docs/handoff/00-handoff-index.md) for the complete proposed architecture, ownership, synchronization/recovery plan, execution packets, agent prompts, acceptance matrix, and evidence ledger. The in-app **Handoff** entry opens a readable guide and downloads the complete source package. The implementation proposal covers Coven Host, Compass, Coven CLI, Psyche, Psyche Build, SDK, Threads, Cave, familiar identity, runtimes, and read-only memory/continuity views.

The handoff preserves the prototype as a simulation. Production APIs, schemas, and command paths require current-repository discovery and acceptance; conceptual JSON examples are inert documentation fixtures.

Run every check with one command. CI runs the same command on every pull request (`.github/workflows/verify.yml`, repository only):

```bash
node scripts/verify-all.mjs
```

It runs the steps below, then repeats the source, test, crown, and manifest checks in a clean extraction of the built ZIP. It exits non-zero if any step fails or is skipped. When everything passes it writes the measured counts to [`tests/evidence/current.json`](tests/evidence/current.json); commit that file with your change. CI runs `--check`, which fails if the file is stale.

```bash
node scripts/check-source.mjs
node --test tests/*.test.cjs
node scripts/test-atlas-crown.mjs
python3 scripts/build-handoff.py
python3 scripts/verify-handoff.py dist/downloads/Coven_Compass_Handoff_2026-11-19.zip
```

The tests include their exact reference fixture and work without Git history. The generated export includes the mobile-readiness report, source harness, historical JSON evidence, and its own inventory and checksums. Historical browser screenshots remain in the repository only and are excluded from the handoff, along with credentials, runtime data, and previous ZIPs. Historical fingerprints describe their recorded checkpoint; they are not verification of the current layout source.

## Scalable overview refinement

**Implemented; combined source-level verification passed.** The current refinement uses numbered Project discs on a shared brick plane in an aspect-aware compact lattice, paired positions, and shared branch corridors that meet each project's inward-facing gate. Routes show coordination, not execution dependencies or authority. Read [the scalable layout and crown guide](docs/handoff/15-scalable-atlas-layout.md) for implementation and integration details.

The Coven overview shows an exact mission count within each Project enclosure and a separate badge for pending decisions. The mission browser and Project drilldown retain all known missions. The map reduces detail based on projected spacing while preserving the underlying collection.

Open **Projects → Try a larger Coven** for 8, 16, 32, 64, or 128-Project sample presets. **Remove extra samples** removes only generated layout samples and preserves existing baseline and user-created Projects. A preset never reduces the user's existing collection to meet its target, so the actual total can exceed the requested preset. These samples explore composition; 128 is neither a production capacity claim nor an architectural limit.

Coven/project scope is explicit and separate from camera zoom. Fit uses measured chrome-safe space; resize refits only in auto-fit mode and preserves a manually adjusted camera. The canonical Psyche crown has restrained projected relief in both scene scopes, with its exact aperture and leaf silhouette. Flat UI marks remain unchanged; the sculpture does not spin or glow.

## Visual language

- **Numbered Project disc:** one project and its mission count. Every project uses the same overview treatment, including the currently active project.
- **Circular mission seal:** one mission. Wedge angle is the share of its agents led by each familiar; wedge height is progress on that familiar's role-owned targets; the central signet expresses mission state.
- **Stable familiar glyph and hue:** identity across projects, councils, and delegated agents. Changing the camera angle does not change the familiar's mark.
- **Agent marks:** cogs represent agents and square hubs indicate task assignments in the selected mission. Each squad shares a metal tray. Smaller squads use larger gears. Their state and familiar affiliation remain available in the detail views.
- **Near-white gate square:** a pending permission or resource-limit decision. Selecting it opens that project's pending decisions; its presence does not mean the requested operation was approved.
- **Central Psyche crown:** coordination within the current scope. Its relief is decorative, while project connections remain neutral until a familiar filter highlights that familiar's assignments.
- **Coral seal rim:** the tightest time, token, or budget limit has reached 85%, or the mission is broken after stopping at a limit.

The Coven overview shows Project markers, exact mission counts, and pending-decision badges. Entering a Project reveals mission seals and familiar glyphs. Selecting a mission shows its state, one decision preview, and individual agent marks when spacing allows. The Inbox holds all pending decisions, and mission details retain exact counts. Zoom changes presentation density while preserving the current scope.

The v27 seal constraints remain: a 12-degree minimum wedge angle, at most eight rendered council wedges, and at most twelve working pips per familiar. The minimum angle can enlarge very small shares; exact agent counts remain available in detail views.

## Interactions

1. Browse the Coven map or open Projects to search project names and explore the larger-Coven sample presets. Use Missions to search across Projects and filter by Project or mission state; an overview overflow marker opens all missions for its Project.
2. Use the familiar chips along the bottom to follow a familiar across Projects. Select the same chip again to clear the filter.
3. Select a near-white square on a Project route to open its pending decisions.
4. Open mission details for Brief, Council, Tasks, and Agents. Previous/Next explores the current Project; Back to mission leaves a familiar view; All missions restores the search and selected row.
5. Use Seal lab to explore Planned, Active, Needs you, Stalled, Sealed, and Broken, plus target progress, working counts, and resource limits.
6. Replay the shared live timeline, pause or scrub to a moment, and change the focused Project without restarting playback. Go live returns to the current sample state. Imported recordings keep their own extent and finish paused.
7. On mobile, use **Map**, **Missions**, **Activity**, and **View** in the bottom workspace dock. Replay and Go live stay reachable while browsing the map; View reveals the 2D, 3D, Move, Orbit, zoom, Fit, and Lock controls. Drag to pan in 2D; choose Move or Orbit in 3D. Two-pointer pan/pinch preserves the point under the gesture centroid. Fit enables automatic framing; a manual camera adjustment preserves that framing through later resize events.

Mission routes include Project identity, mission, section, familiar scope, and card/detail mode. Browser Back/Forward and reload restore that state. A mission that disappears at an earlier replay position clears its selection with an explanatory status message.

Mobile sheets follow the visible viewport, keep the active surface above the map, and restore focus through nested views. Mission and Project forms keep their header/action row outside the scrolling fields. Draft text survives resizing and minimizing/reopening the conversation within the loaded session.

The mobile dock moves the original controls instead of creating a second replay state. It yields to open sheets and the keyboard, and restores the controls to their desktop positions when the layout changes. The available viewport and measured header/dock heights determine the map height. Compact, short-landscape, and tablet arrangements adapt to screen shape; an explicit View expansion survives rotation.

Replay renders missions before their first council seat, so opening events no longer stop the frame loop. Event refreshes preserve elapsed time, and camera smoothing retains its separate bounded delta. All visible Projects follow the shared replay cursor; delayed sample reports remain in the trace until that cursor reaches them.

The starting model contains four Projects, seven missions, and 114 delegated agents. All displayed totals are derived from the simulation. Activity changes over time. Chat and approval controls affect sample data only; they do not send communications, run agents, authorize real operations, or write to external projects.

## Projection sources

The mode is explicit. With no `source` parameter the Site runs the simulation exactly as before. `?source=fixture` (optionally `&scenario=fresh|stale|partial|disconnected|unsupported-version`) reads a static fixture shaped after Cave Client v1 `projects.list`, as cited in the [D01–D04 discovery](docs/discovery/2026-11-19-d01-d04/README.md). It shows each Project's name, root, and Cave id separately, and labels the state explicitly as *fresh*, *stale*, *reconciling* (incomplete pages), or *unavailable* (disconnected, unsupported version, unreadable). Any non-simulation mode stops before the simulation boots, and an unknown `source` value shows *unavailable*, so sample data never stands in for another source. There is no live mode: D03 is unresolved.

Both sources implement one interface, `read() → Promise<Projection>`, described at the top of `dist/projection-source.js`. A live adapter would be a third implementation of that interface. In simulation mode the map still renders from its own state; the registered simulation source wraps `atlasSnapshot` for consumers of the interface.

## Source

- `dist/index.html`: original simulation and seal renderer, with scope-based scene visibility and the orchestration-atlas integration.
- `dist/atlas-ui.js`, `dist/atlas.css`: navigation, searchable mission browser, responsive sheets, familiar filters, and touch camera controls.
- `dist/atlas-layout.js`: compact paired project placement, corridor routing, bounds, and bounded overview mission packing.
- `dist/atlas-viewport.js`: measured safe-area fitting for the projected scene and visible chrome.
- `dist/atlas-crown.js`: exact canonical crown faces with sampled extrusion walls and restrained solid shading.
- `dist/mission-navigation.js`: canonical route codec and replay selection reconciliation.
- `dist/projection-source.js`, `dist/fixtures/cave-projects-list.json`: the projection seam and its static fixture (see Projection sources below).
- `dist/mobile-interactions.js`: pointer geometry, camera gestures, and visual viewport geometry.
- `dist/mobile-ui.js`: responsive portals, adaptive workspace dock, measured map space, modal stacking, focus restoration, keyboard handling, and viewport variables.
- `dist/semantic-map.css`: scope-specific scene visibility, familiar glyphs, agent marks, and boundary decision markers.
- `dist/seal-lab.js`, `dist/seal-lab.css`: an isolated visual explorer using the actual seal renderer.
- `tests/*.test.cjs`: focused Node regression tests for layout, viewport geometry, routes, replay, focus, modal ownership, forms, gestures, and preserved seal geometry. Run the command above for the current count.
- `scripts/test-atlas-crown.mjs`: canonical-path provenance, aperture, finite geometry, footprint, and SVG record-reuse checks.
- [Replay clock](tests/replay-clock.test.cjs), [replay rendering](tests/replay-render.test.cjs), and [delayed-report](tests/replay-emission.test.cjs) tests cover elapsed playback, project focus, shared bounds, early mission events, and delayed emission. [Mobile UI](tests/mobile-ui.test.cjs) and [mobile focus](tests/mobile-focus.test.cjs) tests cover the adaptive workspace and focus targets.
- `tests/mobile-qa.html`: an interactive responsive QA harness, excluded from the deployment.
- `tests/evidence/`: historical mobile and incoming replay/mobile JSON audits with source fingerprints; repository-only browser screenshots are excluded from the exported handoff.
- `MOBILE_READINESS.md`: separate mobile, replay, and layout checkpoints, the combined source's verification boundary, and physical-device acceptance criteria.

No build step or runtime dependencies are required. Google Fonts is the inherited optional typography dependency, with system font fallbacks.

## Verification and evidence boundary

**Current counts are generated, not written by hand.** `node scripts/verify-all.mjs` records the current test, crown, and package counts in [`tests/evidence/current.json`](tests/evidence/current.json), and CI fails when that file is stale. Its evidence level is static + unit: Node fixtures with DOM facades, not a browser, device, daemon, packaged CLI, or remote Host.

The source integrates layout/crown work with replay and adaptive-mobile improvements from `07919b421df5457e778e1b1c6a73512c8f27ba73`. Earlier checkpoints (the layout/crown branch, the incoming replay/adaptive-mobile branch with its Chrome audits, and the mobile/navigation baseline) are historical records with their own counts in [current state and evidence](docs/handoff/01-current-state-and-evidence.md) and [Mobile readiness](MOBILE_READINESS.md). They do not verify the current source.

The [incoming replay/mobile audit record](tests/evidence/replay-mobile-layout-audits.json) retains diagnostic failures separately from successful retests, source fingerprints, and interaction notes. It covers replay, the adaptive dock, mission surfaces, focus, and draft retention for that earlier source. Historical browser JPGs remain in the repository only, including `tests/evidence/replay-mobile-320.jpg`; they are excluded from the handoff. [Mobile readiness](MOBILE_READINESS.md) preserves the detailed records without treating them as validation of this merge.

Layout geometry covers selected project counts through 128: 0, 1, 2, 4, 8, 12, 24, 64, and 128. Mission-packing integration covers every integer count from 0 through 128. These source cases are not browser load or production benchmarks.

Headless Chromium QA of the current source ran on 2026-11-19 ([record](tests/evidence/browser-qa-2026-11-19.json), summarized in chapter 01); it does not establish Safari, physical-device, real multi-touch, keyboard-only, or screen-reader acceptance. Incoming Chrome evidence does not remove that current limitation or verify the merged layout. Node fixtures use DOM facades and numeric inputs. Historical Chrome audits used a browser layout engine but did not establish Safari, a physical keyboard, real multi-touch, VoiceOver, or folding-hardware behavior. This remains a local visual simulation; production integration and device acceptance require separate evidence.
