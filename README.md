# Coven Castles · Orchestration Atlas

A private, interactive Site exploration of the supplied Coven Castles v27 prototype. This presentation builds on its existing event-driven simulation; it does not connect to a Coven daemon or confer protected authority.

## Full source and implementation handoff

Open [START_HERE.md](START_HERE.md) for the runnable ZIP workflow and [the handoff index](docs/handoff/00-handoff-index.md) for the complete proposed architecture, ownership, synchronization/recovery plan, execution packets, agent prompts, acceptance matrix, and evidence ledger. The in-app **Handoff** entry opens a readable guide and downloads the complete source package. The implementation proposal covers Coven Host, Castles, Coven CLI, Psyche, Psyche Build, SDK, Threads, Cave, familiar identity, runtimes, and read-only memory/continuity views.

The handoff preserves the prototype as a simulation. Production APIs, schemas, and command paths require current-repository discovery and acceptance; conceptual JSON examples are inert documentation fixtures.

```bash
node scripts/check-source.mjs
node --test tests/*.test.cjs
node scripts/test-atlas-crown.mjs
python3 scripts/build-handoff.py
python3 scripts/verify-handoff.py dist/downloads/Coven_Castles_Atlas_Handoff_2026-11-18.zip
```

The tests include their exact reference fixture and work without Git history. The generated export includes the mobile-readiness report, source harness, historical JSON evidence, and its own inventory and checksums. Historical browser screenshots remain in the repository only and are excluded from the handoff, along with credentials, runtime data, and previous ZIPs. Historical fingerprints describe their recorded checkpoint; they are not verification of the current layout source.

## Scalable overview refinement

**Implemented; combined source-level verification passed.** The current refinement uses uniform four-corner Castles in an aspect-aware compact lattice, paired positions, and shared branch corridors that meet each project's inward-facing gate. Routes show coordination, not execution dependencies or authority. Read [the scalable layout and crown guide](docs/handoff/15-scalable-atlas-layout.md) for implementation and integration details.

At full overview detail, each Castle shows up to eight mission seals plus an explicit overflow count. Compact and tiny density modes replace unreadable miniatures with an exact mission aggregate; all missions remain reachable through search and project drilldown. The full mission browser retains exact known totals. The previous cosmetic 16-Castle and 12-mission creation caps have been removed; rendering detail stays bounded independently of the underlying collection. Mission resource bounds and protected decision/brief rules retain their separate semantics.

Open **Castles → Try a larger Coven** for 8, 16, 32, 64, or 128-Castle sample presets. **Remove extra samples** removes only generated layout samples and preserves existing baseline and user-created Castles. A preset never reduces the user's existing collection to meet its target, so the actual total can exceed the requested preset. These samples explore composition; 128 is neither a production capacity claim nor an architectural limit.

Coven/project scope is explicit and separate from camera zoom. Fit uses measured chrome-safe space; resize refits only in auto-fit mode and preserves a manually adjusted camera. The canonical Psyche crown has restrained projected relief in both scene scopes, with its exact aperture and leaf silhouette. Flat UI marks remain unchanged; the sculpture does not spin or glow.

## Visual language

- **Uniform four-corner enclosure:** one project's scope. Every project uses the same overview treatment, including the currently active project.
- **Circular mission seal:** one mission. Wedge angle is the share of its agents led by each familiar; wedge height is progress on that familiar's role-owned targets; the central signet expresses mission state.
- **Stable familiar glyph and hue:** identity across projects, councils, and delegated agents. Changing the camera angle does not change the familiar's mark.
- **Small uniform dots:** individual agents, revealed for the selected mission. Their state and familiar affiliation remain available in the detail views.
- **Near-white boundary square:** a pending permission or resource-limit decision. Selecting it opens that project's pending decisions; its presence does not mean the requested operation was approved.
- **Central Psyche crown:** coordination within the current scope. Its relief is decorative, while project connections remain neutral until a familiar filter highlights that familiar's assignments.
- **Coral seal rim:** the tightest time, token, or budget limit has reached 85%, or the mission is broken after stopping at a limit.

Detail appears with explicit scope and available screen space: the Coven overview shows project boundaries with bounded seals or aggregate counts; entering a project reveals its familiar groups and seal relief; selecting a mission reveals its agents and requests. Selected seals also show working-agent pips at the edge. Zoom changes presentation density without silently changing Coven/project scope.

The v27 seal constraints remain: a 12-degree minimum wedge angle, at most eight rendered council wedges, and at most twelve working pips per familiar. The minimum angle can enlarge very small shares; exact agent counts remain available in detail views.

## Interactions

1. Browse the Coven map or open Castles to search project names and explore the larger-Coven sample presets. Use Missions to search across Castles and filter by Castle or mission state; an overview overflow marker opens all missions for its Castle.
2. Use the familiar chips along the bottom to follow a familiar across Castles. Select the same chip again to clear the filter.
3. Select a near-white square on a project boundary to open its pending decisions.
4. Open mission details for Brief, Council, Tasks, and Agents. Previous/Next explores the current Castle; Back to mission leaves a familiar view; All missions restores the search and selected row.
5. Use Seal lab to explore Planned, Active, Needs you, Stalled, Sealed, and Broken, plus target progress, working counts, and resource limits.
6. Replay the shared live timeline, pause or scrub to a moment, and change the focused Castle without restarting playback. Go live returns to the current sample state. Imported recordings keep their own extent and finish paused.
7. On mobile, use **Map**, **Missions**, **Activity**, and **View** in the bottom workspace dock. Replay and Go live stay reachable while browsing the map; View reveals the 2D, 3D, Move, Orbit, zoom, Fit, and Lock controls. Drag to pan in 2D; choose Move or Orbit in 3D. Two-pointer pan/pinch preserves the point under the gesture centroid. Fit enables automatic framing; a manual camera adjustment preserves that framing through later resize events.

Mission routes include Castle identity, mission, section, familiar scope, and card/detail mode. Browser Back/Forward and reload restore that state. Older Castle bookmarks remain supported. A mission that disappears at an earlier replay position clears its selection with an explanatory status message.

Mobile sheets follow the visible viewport, keep the active surface above the map, and restore focus through nested views. Mission and Castle forms keep their header/action row outside the scrolling fields. Draft text survives resizing and minimizing/reopening the conversation within the loaded session.

The mobile dock moves the original controls instead of creating a second replay state. It yields to open sheets and the keyboard, and restores the controls to their desktop positions when the layout changes. The available viewport and measured header/dock heights determine the map height. Compact, short-landscape, and tablet arrangements adapt to screen shape; an explicit View expansion survives rotation.

Replay renders missions before their first council seat, so opening events no longer stop the frame loop. Event refreshes preserve elapsed time, and camera smoothing retains its separate bounded delta. All visible Castles follow the shared replay cursor; delayed sample reports remain in the trace until that cursor reaches them.

The starting model contains four Castles, seven missions, and 114 delegated agents. All displayed totals are derived from the simulation. Activity changes over time. Chat and approval controls affect sample data only; they do not send communications, run agents, authorize real operations, or write to external projects.

## Source

- `dist/index.html`: original simulation and seal renderer, with scope-based scene visibility and the orchestration-atlas integration.
- `dist/atlas-ui.js`, `dist/atlas.css`: navigation, searchable mission browser, responsive sheets, familiar filters, and touch camera controls.
- `dist/atlas-layout.js`: compact paired project placement, corridor routing, bounds, and bounded overview mission packing.
- `dist/atlas-viewport.js`: measured safe-area fitting for the projected scene and visible chrome.
- `dist/atlas-crown.js`: exact canonical crown faces with sampled extrusion walls and restrained solid shading.
- `dist/mission-navigation.js`: canonical route codec and replay selection reconciliation.
- `dist/mobile-interactions.js`: pointer geometry, camera gestures, and visual viewport geometry.
- `dist/mobile-ui.js`: responsive portals, adaptive workspace dock, measured map space, modal stacking, focus restoration, keyboard handling, and viewport variables.
- `dist/semantic-map.css`: scope-specific scene visibility, familiar glyphs, agent dots, and boundary decision markers.
- `dist/seal-lab.js`, `dist/seal-lab.css`: an isolated visual explorer using the actual seal renderer.
- `tests/*.test.cjs`: focused Node regression tests for layout, viewport geometry, routes, replay, focus, modal ownership, forms, gestures, and preserved seal geometry. Run the command above for the current count.
- `scripts/test-atlas-crown.mjs`: canonical-path provenance, aperture, finite geometry, footprint, and SVG record-reuse checks.
- [Replay clock](tests/replay-clock.test.cjs), [replay rendering](tests/replay-render.test.cjs), and [delayed-report](tests/replay-emission.test.cjs) tests cover elapsed playback, project focus, shared bounds, early mission events, and delayed emission. [Mobile UI](tests/mobile-ui.test.cjs) and [mobile focus](tests/mobile-focus.test.cjs) tests cover the adaptive workspace and focus targets.
- `tests/mobile-qa.html`: an interactive responsive QA harness, excluded from the deployment.
- `tests/evidence/`: historical mobile and incoming replay/mobile JSON audits with source fingerprints; repository-only browser screenshots are excluded from the exported handoff.
- `MOBILE_READINESS.md`: separate mobile, replay, and layout checkpoints, the combined source's verification boundary, and physical-device acceptance criteria.
- `.openai/hosting.json`: canonical Site identity and static deployment configuration.

No build step or runtime dependencies are required. Google Fonts is the inherited optional typography dependency, with system font fallbacks.

## Verification and evidence boundary — November 18, 2026

**Combined source-level verification passed.** The source integrates layout/crown work with replay and adaptive-mobile improvements from `07919b421df5457e778e1b1c6a73512c8f27ba73`. `node --test --test-reporter=tap tests/*.test.cjs` passed **207 tests with zero failures, cancellations, or skips**. The crown check passed **84 view/size combinations** plus canonical digest, aperture, bounds, and stable-node checks; the static source checker passed. **Combined clean-extraction, rebuilding, and ZIP verification passed**: 67 files, 65 payload entries, and 66 SHA-256 checks. Earlier branch results remain distinct below.

| Earlier checkpoint | Recorded evidence | Boundary |
| --- | --- | --- |
| Layout/crown branch before this merge | 182 Node tests passed with zero failures/skips; 84 crown view/size combinations and canonical digest/aperture/bounds checks passed; source checks and clean extraction/rebuild passed. | Historical pre-combination source/package evidence; browser QA unavailable. |
| Incoming replay/adaptive-mobile branch | 71 Node tests and 57 settled Chrome audits, including 56 mobile/tablet checks across 17 viewport sizes and one desktop reference. | Applies to the incoming source fingerprinted in its audit record, before this combined layout. |
| Earlier mobile/navigation baseline | 51 Node tests and 72 settled Chrome layout audits. | Historical pre-layout evidence. |

The [incoming replay/mobile audit record](tests/evidence/replay-mobile-layout-audits.json) retains diagnostic failures separately from successful retests, source fingerprints, and interaction notes. It covers replay, the adaptive dock, mission surfaces, focus, and draft retention for that earlier source. Historical browser JPGs remain in the repository only, including `tests/evidence/replay-mobile-320.jpg`; they are excluded from the handoff. [Mobile readiness](MOBILE_READINESS.md) preserves the detailed records without treating them as validation of this merge.

Layout geometry covers selected project counts through 128: 0, 1, 2, 4, 8, 12, 24, 64, and 128. Mission-packing integration covers every integer count from 0 through 128. These source cases are not browser load or production benchmarks.

Browser QA for the current combined source is unavailable because of the previously encountered browser URL-policy block. Incoming Chrome evidence does not remove that current limitation or verify the merged layout. Node fixtures use DOM facades and numeric inputs. Historical Chrome audits used a browser layout engine but did not establish Safari, a physical keyboard, real multi-touch, VoiceOver, or folding-hardware behavior. This remains a local visual simulation; production integration and device acceptance require separate evidence.
