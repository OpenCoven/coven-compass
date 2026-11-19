# Visual and interaction contract

**Implemented in the prototype; proposed as the integration's presentation contract.** Preserve the meanings below when replacing fixtures with canonical data. Authoritative operational state belongs to Coven, using Psyche's orchestration semantics, and is exposed through a verified read projection. Shapes, colors, screen positions, and cached labels do not establish authority.

The [scalable layout and crown guide](15-scalable-atlas-layout.md) supersedes earlier overview positioning and zoom-driven scope assumptions. That refinement is **implemented; combined source-level verification passed**. It specifies compact paired placement, bounded density, explicit scope, measured fit, and canonical crown relief. Current browser QA is unavailable; historical mobile/Chrome evidence applies only to its recorded pre-layout source.

## 1. A small vocabulary

| Element | Meaning | Must not imply |
| --- | --- | --- |
| Uniform four-corner Castle enclosure | One project's work scope | A runtime sandbox, filesystem permission, authorized execution grant, or four-project limit |
| Circular divided seal | One mission and its council | A task, familiar identity, or approval token |
| Familiar glyph and stable hue | Familiar identity within the active binding | That a display name or color is a globally unique identity |
| Small agent dot | One delegated agent in the selected mission | A second familiar identity root |
| Near-white boundary square | A count of pending decisions | An approved or completed operation |
| Psyche crown at the center | Coordination within the displayed scope | That the model or UI owns daemon authority |
| Neutral connection | A project participates in this coordination scope | Network reachability or active execution by itself |
| Shared branch corridor and inward gate | Readable coordination from Psyche to the destination Castle | Execution dependencies, scheduling order, or authority implied by shared geometry |
| Mission aggregate or overflow marker | Exact known total or remainder when miniature detail is reduced | A limit on the canonical mission collection or evidence of complete data when coverage is partial |
| Colored connection after familiar selection | That familiar's assignments in that project | Permission to change all highlighted work |
| Dotted connection | No agents assigned in the current complete sample projection | Offline, deleted, or inaccessible data; those require explicit state |

Use `dist/semantic-map.css` for the presentational rules. Keep the canonical crown/lotus already present in `dist/index.html`; do not substitute the retired symbol or a decorative new mark.

## 2. Color has a stable job

Familiar hues remain consistent across Castles, mission wedges, group glyphs, and agent dots. Read the current familiar presentation settings rather than scattering colors through new components. A hue is a display aid; the accessible name and exact bound identity belong in the data/details.

Lavender identifies Psyche and its coordination treatment. Near-white marks a decision waiting for the principal. Coral on a seal rim signals a near resource limit or the existing broken-after-limit condition. Do not use a familiar's own hue as a universal success, warning, or error color.

The current sample hues are presentation defaults, not an identity registry or a new brand specification. Where canonical Brand tokens differ, map the same semantic roles through approved tokens and verify contrast. Keep distinct glyphs, labels, fill/outline treatments, and status text so color is never the only signal.

## 3. Location explains containment

At Coven scale, project enclosures surround Psyche. All projects use the same overview renderer, including the active one. A project should not unexpectedly reveal its entire internal scene simply because it is selected in a different control.

Overview positions come from an aspect-aware compact lattice with opposite pairs, reserved Castle/label rectangles, and shared routing corridors. The inward-facing gate terminates the route for that Castle. Location is presentation structure, not priority or execution topology. Preserve stable caller ordering; at unchanged geometry options, appending projects retains existing positions. Resizing or explicitly reordering the collection can change placement and must not imply that canonical ownership changed. [Current positioning contract](15-scalable-atlas-layout.md)

Inside a project, mission seals connect to familiar groups. Selecting a mission reveals its individual agents, reserved positions, task detail, and relevant requests. Working dots are filled, idle dots are hollow, and reserved places use a dashed outline. Waiting agents remain inside the boundary. The boundary marker invites review; it does not depict an operation already crossing the boundary.

Within the overview, a boundary marker aggregates pending decisions for that project at its coordination-facing gate. Within a project, markers correspond to the simulation's gate locations and selected-mission scope. A future implementation must map this deliberately from canonical decision data; do not assign a new permission category based on north/east/south/west placement.

Keep internal mission placement and overview project placement distinct. The newer overview helper supersedes the earlier trace/ring positioning assumptions; local mission data still drives each project's contents. Preserve context through filtering, replay, snapshot replacement, and brief changes. A filtered item may dim or disappear; reappearance should not imply it moved between projects. If canonical assignments change, display the actual move as a data change with corresponding details.

## 4. Topography is measured

Entity placement shares a ground plane. Mission seal relief conveys measured progress; removed terraces, familiar statues, and decorative halo stacks should not reappear as unlabelled “importance.” The requested Psyche crown is a specific decorative extrusion of the exact canonical silhouette, including its aperture. Its height conveys no progress, priority, or authority. Flat UI marks remain flat, and the scene sculpture uses no spin, glow, or gradients. [Crown contract](15-scalable-atlas-layout.md)

| Seal feature | Current v27 meaning |
| --- | --- |
| Wedge angle | Familiar's share of mission agents, subject to the visual minimum |
| Wedge height | Progress on targets owned by that familiar's roles; unowned targets contribute to every relevant wedge |
| Wedge brightness | Working agents are present |
| Dark lead pip | Lead familiar's wedge, beginning at twelve o'clock |
| Central signet | Mission state: Planned, Active, Needs you, Stalled, Sealed, or Broken |
| Rim sweep | Tightest time, token, or budget limit |
| Coral threshold | 85% or the existing broken state |
| Selected-seal edge pips | Working agents, visually capped per familiar |

The renderer permits at most eight council wedges, a minimum wedge angle of 12 degrees, and at most twelve working pips per familiar. Therefore small angular shares and pip counts are not exact numerical displays. Exact counts belong in details. Preserve these qualifications rather than suggesting a miniature seal is a precision chart.

Current progress ownership uses `TARGET_ROLES` in the prototype. Production integration must inspect canonical target ownership, counters, and completion semantics. Do not copy this fixture mapping into a second orchestration schema. “Sealed” requires canonical completion evidence; a local 100% animation or a model's report is insufficient.

## 5. Progressive detail and control placement

The Coven view carries boundaries, seals, decisions, and a compact identity filter. The Castles drawer is closed by default and overlays the map without changing its dimensions. Project view reveals useful controls and group counts. Mission selection opens task/agent detail. Retain the existing replay and Seal lab as clearly scoped controls.

Full overview detail shows at most eight mission seals plus an exact overflow count. Compact/tiny density modes show an exact mission aggregate instead of unreadable miniatures; the complete mission collection remains available through search and drilldown. Project search and the 8/16/32/64/128 layout samples make dense compositions inspectable. **Remove extra samples** removes only generated layout samples, preserving baseline and user-created Castles. The removed cosmetic 16-Castle and 12-mission creation caps must not return as model limits.

Coven and project scope are explicit navigation state, separate from camera zoom. A Fit action uses measured chrome-safe space and enables auto-fit; resize refits only in that mode. Manual camera framing is retained. Camera fitting includes screen-facing crown and label bounds as well as the projected ground. [Scope and fit details](15-scalable-atlas-layout.md)

Keep the primary path discoverable by keyboard and touch: overview → Castle → mission → task/agent/request. Every glyph and boundary marker needs an accessible name and activation behavior. Hidden scene layers must use real visibility removal, not merely zero opacity that leaves invisible tab stops.

Protect navigation and drawer controls from camera drag handlers. A click immediately after a drag must still operate visible chrome. Closing a dialog should restore focus to a visible control; Escape from the Seal lab must not also deselect the underlying mission. Preserve these behaviors during adapter extraction and in the acceptance pass.

## 6. Real data requires additional explicit states

The simulation's complete in-memory world does not model every production transport failure. Add explicit connection/freshness/coverage treatment before live integration. A disconnected or partial roster must not appear as an empty dormant Castle. An unavailable count should be unknown or unavailable, not zero. A retained last-known view must show its revision/time and stale status.

Separate selected, working, waiting, rejected, reconciling, and disconnected states. Selection is local focus. A pending submission or unknown command outcome remains pending/unknown until a canonical receipt resolves it. A rejected request may retain useful context but cannot look committed.

## 7. Visual acceptance

Use synthetic fixtures and comparable camera states. Inspect the initial Coven overview, every Castle, selected missions, familiar filters, empty/dormant projects, pending decisions, the full six-state Seal lab, stale/partial/disconnected data, and the document handoff at desktop and narrow widths. Exercise keyboard focus, screen-reader names, touch targets, contrast, reduced motion, and a zoomed text size.

The existing Node tests verify selected presentation logic and geometry; they do not prove CSS layout or accessibility. The v3 publication image and later pre-layout Chrome records are historical evidence for those specific sources. Current browser QA is unavailable because of the prior URL-policy block. Record fresh browser/native evidence for this refinement before treating the rendered contract as accepted, and retain the separate production-integration gates.
