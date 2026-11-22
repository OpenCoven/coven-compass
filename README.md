# Coven Compass

An interactive Site exploration of the supplied Coven Castles v27 prototype. This presentation builds on its existing event-driven simulation; it does not connect to a Coven daemon or confer protected authority.

## Run Compass locally

Serve the static site from the repository root.

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8000/`. Run `node scripts/verify-all.mjs --check` to verify the site and run its tests. Compass is distributed under the [Apache License, Version 2.0](LICENSE). [Copyright and brand notices](NOTICE) accompany the source.

## Scalable overview refinement

**Implemented; combined source-level verification passed.** The current refinement uses flat Project outlines in an aspect-aware compact lattice, paired positions, and shared branch corridors that meet each project's inward-facing gate. Routes show coordination, not execution dependencies or authority. Read [the scalable layout and crown guide](docs/handoff/15-scalable-atlas-layout.md) for implementation and integration details.

The Coven overview shows an exact mission count within each Project enclosure and a separate badge for pending decisions. The mission browser and Project drilldown retain all known missions. The map reduces detail based on projected spacing while preserving the underlying collection.

Open **Projects → Try a larger Coven** to choose a sample preset or enter a custom Project total. Each Project previews its missions on the Coven map. Within a Project, the grouped cogs beside a mission open its task list. **Remove extra samples** removes only generated layout samples and preserves existing baseline and user-created Projects. A preset never reduces the user's existing collection to meet its target, so the actual total can exceed the requested preset. These samples explore composition; 128 is neither a production capacity claim nor an architectural limit.

Compass uses a strictly 2D map. Pan and zoom frame the current scope. Fit accounts for the header, drawers and labels, and resizing preserves a manually adjusted view. The same upright crown identifies Psyche throughout the interface. Changing this restriction requires an explicit override from Val, recorded with the change. [Presentation policy](AGENTS.md#invariants-never-break)

## Visual language

- **Project outline:** one project and its mission count in the Coven overview.
- **Mission ring:** the center names the mission. Each familiar’s arc shows its share of the council’s agents, and the brighter length within that arc shows progress on its targets.
- **Familiar badge:** the same planar glyph and hue identify a familiar on the map, in filters, and in mission details.
- **Agent marks:** dots represent agents and square hubs indicate task assignments in the selected mission. Their state and familiar affiliation remain available in the detail views.
- **Near-white boundary square:** a pending permission or resource-limit decision. Selecting it opens that project's pending decisions; its presence does not mean the requested operation was approved.
- **Psyche badge:** the lavender crown marks the coordinator. Spokes connect it to the work in the current scope.
- **Coral seal rim:** the tightest time, token, or budget limit has reached 85%, or the mission is broken after stopping at a limit.

The Coven overview previews each Project’s mission rings, familiar branches and task ownership when there is room. At smaller sizes it keeps the exact mission count. Entering a Project reveals the mission seals, familiar glyphs and task groups. Selecting a mission shows its state, one decision preview, and individual agent marks when spacing allows. The Inbox holds all pending decisions, and mission details retain exact counts. Zoom changes presentation density while preserving the current scope.

The council ring summarizes agent shares with a minimum visible segment. Mission details give the exact counts, progress, working agents, state and limits.

## Interactions

1. Browse the Coven map or open Projects to search project names and explore the larger-Coven sample presets. Use Missions to search across Projects and filter by Project or mission state; an overview overflow marker opens all missions for its Project.
2. Use the familiar chips along the bottom to follow a familiar across Projects. Select the same chip again to clear the filter.
3. Select a near-white square on a project boundary to open its pending decisions.
4. Open mission details for Brief, Council, Tasks, and Agents. Previous/Next explores the current Project; Back to mission leaves a familiar view; All missions restores the search and selected row.
5. Use Seal lab to explore Planned, Active, Needs you, Stalled, Sealed, and Broken, plus target progress, working counts, and resource limits.
6. Replay the shared live timeline, pause or scrub to a moment, and change the focused Project without restarting playback. Go live returns to the current sample state. Imported recordings keep their own extent and finish paused. From mission details, open **History** to compare two event positions, inspect the recorded assignment or decision, and show that moment on the map. Return to History restores your interval and event.
7. On mobile, use **Map**, **Missions**, **Activity**, and **View** in the workspace dock. Drag to pan and pinch to zoom. View reveals zoom, Fit, and Lock. Replay and Go live stay reachable while browsing the map.

Mission routes include Project identity, mission, section, familiar scope, and card/detail mode. Browser Back/Forward and reload restore that state. A mission that disappears at an earlier replay position clears its selection with an explanatory status message.

Mobile sheets follow the visible viewport, keep the active surface above the map, and restore focus through nested views. Mission and Project forms keep their header/action row outside the scrolling fields. Draft text survives resizing and minimizing/reopening the conversation within the loaded session.

The mobile dock moves the original controls instead of creating a second replay state. It yields to open sheets and the keyboard, and restores the controls to their desktop positions when the layout changes. The available viewport and measured header/dock heights determine the map height. Compact, short-landscape, and tablet arrangements adapt to screen shape; an explicit View expansion survives rotation.

Replay renders missions before their first council seat, so opening events no longer stop the frame loop. Event refreshes preserve elapsed time, and camera smoothing retains its separate bounded delta. All visible Projects follow the shared replay cursor; delayed sample reports remain in the trace until that cursor reaches them.

The starting model contains four Projects, seven missions, and 114 delegated agents. All displayed totals are derived from the simulation. Activity changes over time. Chat and approval controls affect sample data only; they do not send communications, run agents, authorize real operations, or write to external projects.

## Projection sources

The mode is explicit. With no `source` parameter the Site runs the simulation exactly as before. `?source=fixture` (optionally `&scenario=fresh|stale|partial|disconnected|unsupported-version`) reads a static fixture shaped after Cave Client v1 `projects.list`, as cited in the [D01–D04 discovery summary](docs/discovery/2026-11-20-public/README.md). It shows each Project's name, root, and Cave id separately, and labels the state explicitly as *fresh*, *stale*, *reconciling* (incomplete pages), or *unavailable* (disconnected, unsupported version, unreadable). Any non-simulation mode stops before the simulation boots, and an unknown `source` value shows *unavailable*, so sample data never stands in for another source. There is no live mode: D03 is unresolved.

Both sources implement one interface, `read() → Promise<Projection>`, described at the top of `dist/projection-source.js`. A live adapter would be a third implementation of that interface. In simulation mode the map still renders from its own state; the registered simulation source wraps `atlasSnapshot` for consumers of the interface.

## Source

- `dist/index.html`: original simulation and seal renderer, with scope-based scene visibility and the orchestration-atlas integration.
- `dist/atlas-ui.js`, `dist/atlas.css`: navigation, searchable mission browser, responsive sheets, familiar filters, and touch camera controls.
- `dist/atlas-layout.js`: compact paired project placement, corridor routing, bounds, and bounded overview mission packing.
- `dist/atlas-viewport.js`: measured safe-area fitting for the projected scene and visible chrome.
- `dist/atlas-crown.js`: canonical crown silhouette, circular badge and Psyche label.
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
- `tests/evidence/`: historical browser audits and source fingerprints.
- `MOBILE_READINESS.md`: separate mobile, replay, and layout checkpoints, the combined source's verification boundary, and physical-device acceptance criteria.

No build step or runtime dependencies are required. Google Fonts is the inherited optional typography dependency, with system font fallbacks.

## Verification and evidence boundary

Current test and crown results are recorded in [the verification evidence](tests/evidence/current.json).

The source integrates layout/crown work with replay and adaptive-mobile improvements from `07919b421df5457e778e1b1c6a73512c8f27ba73`. Earlier checkpoints (the layout/crown branch, the incoming replay/adaptive-mobile branch with its Chrome audits, and the mobile/navigation baseline) are historical records with their own counts in [current state and evidence](docs/handoff/01-current-state-and-evidence.md) and [Mobile readiness](MOBILE_READINESS.md). They do not verify the current source.

The [incoming replay/mobile audit record](tests/evidence/replay-mobile-layout-audits.json) retains diagnostic failures separately from successful retests, source fingerprints, and interaction notes. It covers replay, the adaptive dock, mission surfaces, focus, and draft retention for that earlier source. Historical browser JPGs remain in the repository only, including `tests/evidence/replay-mobile-320.jpg`; they are excluded from the handoff. [Mobile readiness](MOBILE_READINESS.md) preserves the detailed records without treating them as validation of this merge.

Layout geometry covers selected project counts through 128: 0, 1, 2, 4, 8, 12, 24, 64, and 128. Mission-packing integration covers every integer count from 0 through 128. These source cases are not browser load or production benchmarks.

Headless Chromium QA of the current source ran on 2026-11-19 ([record](tests/evidence/browser-qa-2026-11-19.json), summarized in chapter 01); it does not establish Safari, physical-device, real multi-touch, keyboard-only, or screen-reader acceptance. Incoming Chrome evidence does not remove that current limitation or verify the merged layout. Node fixtures use DOM facades and numeric inputs. Historical Chrome audits used a browser layout engine but did not establish Safari, a physical keyboard, real multi-touch, VoiceOver, or folding-hardware behavior. This remains a local visual simulation; production integration and device acceptance require separate evidence.
