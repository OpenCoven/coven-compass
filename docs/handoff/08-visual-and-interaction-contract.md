# Visual and interaction contract

**Implemented in the prototype; proposed as the integration's presentation contract.** Preserve the meanings below when replacing fixtures with canonical data. Authoritative operational state belongs to Coven, using Psyche's orchestration semantics, and is exposed through a verified read projection. Shapes, colors, screen positions, and cached labels do not establish authority.

Read the [layout guide](15-scalable-atlas-layout.md) for placement, scope, measured fit and the 2D rendering restriction. Browser evidence is revision-specific.

## 1. A small vocabulary

| Element | Meaning | Must not imply |
| --- | --- | --- |
| Uniform four-corner Project enclosure | One project's work scope | A runtime sandbox, filesystem permission, authorized execution grant, or four-project limit |
| Circular divided seal | One mission and its council | A task, familiar identity, or approval token |
| Familiar glyph and stable hue | Familiar identity within the active binding | That a display name or color is a globally unique identity |
| Agent dot | One delegated agent in the selected mission | A second familiar identity root |
| Near-white boundary square | A count of pending decisions | An approved or completed operation |
| Psyche crown at the center | Coordination within the displayed scope | That the model or UI owns daemon authority |
| Neutral connection | A project participates in this coordination scope | Network reachability or active execution by itself |
| Shared branch corridor and inward gate | Readable coordination from Psyche to the destination Project | Execution dependencies, scheduling order, or authority implied by shared geometry |
| Mission count inside a Project | Exact known mission total | A limit on the canonical mission collection or evidence of complete data when coverage is partial |
| Colored connection after familiar selection | That familiar's assignments in that project | Permission to change all highlighted work |
| Dotted connection | No agents assigned in the current complete sample projection | Offline, deleted, or inaccessible data; those require explicit state |

Use `dist/semantic-map.css` for the presentational rules. Keep the canonical crown/lotus already present in `dist/index.html`; do not substitute the retired symbol or a decorative new mark.

## 2. Color has a stable job

Familiar hues remain consistent across Projects, mission rings, group glyphs, and agent marks. Read the current familiar presentation settings rather than scattering colors through new components. A hue is a display aid; the accessible name and exact bound identity belong in the data/details.

Lavender identifies Psyche and its coordination treatment. Near-white marks a decision waiting for the principal. Coral on a seal rim signals a near resource limit or the existing broken-after-limit condition. Do not use a familiar's own hue as a universal success, warning, or error color.

The current sample hues are presentation defaults, not an identity registry or a new brand specification. Where canonical Brand tokens differ, map the same semantic roles through approved tokens and verify contrast. Keep distinct glyphs, labels, fill/outline treatments, and status text so color is never the only signal.

## 3. Location explains containment

At Coven scale, project enclosures surround Psyche. All projects use the same overview renderer, including the active one. A project should not unexpectedly reveal its entire internal scene simply because it is selected in a different control.

Overview positions come from an aspect-aware compact lattice with opposite pairs, reserved Project/label rectangles, and shared routing corridors. The inward-facing gate terminates the route for that Project. Location is presentation structure, not priority or execution topology. Preserve stable caller ordering; at unchanged geometry options, appending projects retains existing positions. Resizing or explicitly reordering the collection can change placement and must not imply that canonical ownership changed. [Current positioning contract](15-scalable-atlas-layout.md)

Inside a Project, mission seals connect to familiar groups. Each mission with recorded tasks has a shared capsule of familiar-colored task cogs before selection. Activating it opens the full task list, including unstaffed tasks. Selecting a mission reveals its individual agents, reserved positions, task detail, and relevant requests. A round hub identifies an unassigned agent. A square hub identifies an assigned task. Working marks are larger and filled. Idle marks are smaller and hollow. Dashed outlines reserve places for agents at gates. Waiting agents remain inside the boundary. The boundary marker invites review; it does not depict an operation already crossing the boundary.

Within the overview, a boundary marker aggregates pending decisions for that project at its coordination-facing gate. Within a project, markers correspond to the simulation's gate locations and selected-mission scope. A future implementation must map this deliberately from canonical decision data; do not assign a new permission category based on north/east/south/west placement.

Keep internal mission placement and overview project placement distinct. The newer overview helper supersedes the earlier trace/ring positioning assumptions; local mission data still drives each project's contents. Preserve context through filtering, replay, snapshot replacement, and brief changes. A filtered item may dim or disappear; reappearance should not imply it moved between projects. If canonical assignments change, display the actual move as a data change with corresponding details.

## 4. Reading a mission seal

Compass uses one drawing plane for the overview, Project, mission details, previews and Seal lab. Psyche uses a crown with bands for working agents and missions awaiting a decision. A mission uses a filled disc with an external label. Smaller familiar badges sit at the ends of colored spokes. Four arcs mark a selected mission. Its familiar connections stay bright, and each familiar’s agents share a tinted plane. Unrelated branches recede. Selection centers the mission or familiar in the available map space and preserves familiar identity colors.

| Seal feature | Meaning |
| --- | --- |
| Colored slice angle | Familiar’s share of mission agents, subject to the visual minimum |
| Bright arc along a slice’s edge | Progress on targets assigned to that familiar’s roles |
| Outer outline | Mission state, also named in details and accessible labels |
| Rim sweep | Tightest time, token, or budget limit |
| Coral threshold | 85% or the existing broken state |

Council slices provide a readable summary even for small shares. Details and the Seal lab supply exact counts and percentages.

Current progress ownership uses `TARGET_ROLES` in the prototype. Production integration must inspect canonical target ownership, counters, and completion semantics. Do not copy this fixture mapping into a second orchestration schema. “Sealed” requires canonical completion evidence; a local 100% animation or a model's report is insufficient.

## 5. Progressive detail and control placement

The workspace bar and Psyche title share a height. Mission details open on the left. Inspector action labels use up to three words, with supporting descriptions beside the controls. Edit brief sets deliverables and limits. Ask Psyche opens the conversation for the current selection. In replay, View chat opens the conversation history. The header keeps identity, activity and section navigation in three rows. The Tasks tab names each owning familiar and groups its assigned agents under the task. A filled circle means working, an open circle means idle, and a square with a center dot means waiting at a gate. Selecting an agent opens its details in that task row. Closing the details returns focus to the agent.

From the Coven Inbox, open a pending request and choose **Inspect opening event**. History opens the recorded request in its own Project and focuses **Show on map** for that event. Events at the same clock time retain their recording order. From the map, choose **Return to History**, then **Back to Inbox** to resume the filtered queue at the current replay position. If the request has left the queue, Compass announces the change and focuses the next matching row, or the filter when no matches remain.

Opening a result from Missions keeps its search, Project and state filters for review. Previous and Next follow the matching rows in display order, including across Projects. Close details or press Escape to return to the reviewed row at the saved scroll position. When replay removes the selected match, the list reopens at the nearest remaining result. An empty list explains how to change the filters or replay position. Opening a mission permalink in a fresh tab uses that Project’s mission order.

One top bar holds workspace navigation. Project tools opens the project and mission selectors, Ward, trace and display controls. Inbox and Stop stay in the top bar when available. The map shares the workspace surface color. Its familiar key and camera controls sit on one bottom row. On small screens, View reveals the controls beside the scrollable familiar key. The Mission grid toggle arranges missions in rows and columns around Psyche for comparison. Toggle it again to return to the ring. The choice also applies to the mission previews inside each Project on the Coven map. The browser remembers the formation. Camera controls offer zoom, fit and lock. A locked camera shows the unlock control.

The Map key opens on four illustrated map symbols. Its topic tabs keep familiar identities, mission seals, connections and keyboard controls within reach while the selected panel scrolls. Selecting a familiar’s agent plane frames its members in the available map area and uses the familiar’s own color for the selection. The plane divides its area by assigned agent count. Each task has its own region, waiting agents keep a dashed place, and unassigned agents share a separate region. Tasks without agents remain accessible in the mission’s task list. The camera lock preserves a manually chosen view.

The Coven view shows Project previews, exact mission counts, decision badges, and a compact identity filter. The Projects drawer is closed by default and overlays the map without changing its dimensions. Project view reveals useful controls and group counts. Mission selection opens task/agent detail. Retain the existing replay and Seal lab as clearly scoped controls.

Project view shows connected mission seals and familiar badges. Selection exposes agent and task detail. The Inbox retains every pending decision.

Coven and project scope are explicit navigation state, separate from camera zoom. A Fit action uses measured chrome-safe space and enables auto-fit; resize refits only in that mode. Manual camera framing is retained. Camera fitting includes screen-facing crown and label bounds as well as the projected ground. [Scope and fit details](15-scalable-atlas-layout.md)

Keep the primary path discoverable by keyboard and touch: overview → Project → mission → task/agent/request. Every glyph and boundary marker needs an accessible name and activation behavior. Hidden scene layers must use real visibility removal, not merely zero opacity that leaves invisible tab stops.

Protect navigation and drawer controls from camera drag handlers. A click immediately after a drag must still operate visible chrome. Closing a dialog should restore focus to a visible control; Escape from the Seal lab must not also deselect the underlying mission. Preserve these behaviors during adapter extraction and in the acceptance pass.

## 6. Real data requires additional explicit states

The simulation's complete in-memory world does not model every production transport failure. Add explicit connection/freshness/coverage treatment before live integration. A disconnected or partial roster must not appear as an empty dormant Project. An unavailable count should be unknown or unavailable, not zero. A retained last-known view must show its revision/time and stale status.

Separate selected, working, waiting, rejected, reconciling, and disconnected states. Selection is local focus. A pending submission or unknown command outcome remains pending/unknown until a canonical receipt resolves it. A rejected request may retain useful context but cannot look committed.

## 7. Visual acceptance

Use synthetic fixtures and comparable camera states. Inspect the initial Coven overview, every Project, selected missions, familiar filters, empty/dormant projects, pending decisions, the full six-state Seal lab, stale/partial/disconnected data, and the document handoff at desktop and narrow widths. Exercise keyboard focus, screen-reader names, touch targets, contrast, reduced motion, and a zoomed text size.

The existing Node tests verify selected presentation logic and geometry; they do not prove CSS layout or accessibility. The v3 publication image and later pre-layout Chrome records are historical evidence for those specific sources. Headless Chromium QA of the current source ran on 2026-11-19 ([record](../../tests/evidence/browser-qa-2026-11-19.json), summarized in chapter 01); it does not establish Safari, physical-device, real multi-touch, keyboard-only, or screen-reader acceptance. Record fresh browser/native evidence for this refinement before treating the rendered contract as accepted, and retain the separate production-integration gates.
