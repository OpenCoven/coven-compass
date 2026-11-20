# Validation and acceptance

## Current scalable-layout refinement

**Implemented; combined source-level verification passed.** `node scripts/verify-all.mjs` runs the suite, crown, and static source checks, then clean-extraction, rebuilding, and archive verification, repeating the suite and crown/source checks in the extracted copy. Current counts are in [`tests/evidence/current.json`](../../tests/evidence/current.json). The earlier layout branch's package pass and the incoming replay branch's Node/Chrome pass remain historical checkpoints in [current state and evidence](01-current-state-and-evidence.md). Commands:

```sh
node scripts/check-source.mjs
node --test --test-reporter=tap tests/*.test.cjs
node scripts/test-atlas-crown.mjs
```

The layout module's sweep covers selected project counts through 128 (0, 1, 2, 4, 8, 12, 24, 64, and 128) as geometric correctness cases; mission packing covers every integer count from 0 through 128. It is not a load test or production benchmark. Headless Chromium QA of the current source ran on 2026-11-19 ([record](../../tests/evidence/browser-qa-2026-11-19.json), summarized in chapter 01); it does not establish Safari, physical-device, real multi-touch, keyboard-only, or screen-reader acceptance. Historical pre-layout Chrome records and source fingerprints do not establish visual or interaction acceptance of the new layout, density modes, sample controls, crown, or fit behavior. [Guide 15](15-scalable-atlas-layout.md) supplies the current presentation contract and remaining browser cases.

## Historical v3 baseline evidence

The source reference is v3 `d7b6f1e655140036cca49f31687131352162de13`. The local simulation and its renderer are implemented. `node --test tests/presentation.test.cjs` was rerun against that source: **seven tests passed; zero failed, cancelled, or skipped**. The original comparison baseline is `494a08f6bf10c9a0606c82e86821fed8a253f066`; handoff tooling makes that baseline portable and records its provenance.

The seven fixtures exercise these actual extracted functions and behaviors:

1. Overview mission seals add, remove, and return during replay without a change in the four-wall project count.
2. Agents, reserved places, and gate links remain hidden without a selected mission.
3. Selection reveals only the chosen mission’s agents, reserved places, links, and gate decisions.
4. A familiar filter highlights relevant missions and groups within project scope.
5. Local familiar selection clears a conflicting global filter; a familiar chip replaces local selection consistently.
6. v27 seal functions/constants and their numerical meanings match the pinned baseline, apart from the normalized ground origin.
7. Geometry matches that baseline across six states and three detail tiers after ground normalization.

These are **Node unit tests using a DOM facade**, not browser execution, accessibility, CSS/layout, or runtime integration tests. The portable suite reads and verifies the bundled v2 baseline fixture rather than inspecting an arbitrary Git checkout.

The source ledger records a generated static preview for the saved v3 Site version, associated with the same v3 revision. Its inspected overview image supports a visual observation of the simplified composition only. Native browser navigation was blocked by URL policy at that checkpoint; interaction, focus, responsive, and reduced-motion behavior were not verified by that historical record.

## Historical pre-layout mobile verification

Before the scalable-layout refinement, the mobile pass ran `node --test tests/*.test.cjs` with no failures. [MOBILE_READINESS.md](../../MOBILE_READINESS.md) records that historical test count, navigation, gesture, overlay, and mission-interaction coverage, its settled Chrome layout audits, observed browser flows, and remaining checks. These results supplement the original seven-test baseline; they are not the current source-suite total or a current browser pass. Chrome viewport stress tests also do not establish native iOS keyboard or device acceptance.

The source/package checkers and clean-extraction verification supply additional export evidence when run and recorded. They do not establish a real daemon, installed CLI, remote Host, security review, production conformance, or pilot acceptance. Those remain **unknown/unverified** until the following gates are satisfied.

## Visual and projection acceptance

Preserve angular project scope, circular missions, stable familiar identity marks, selected-mission agent dots, boundary decisions, and Psyche coordination. Confirm that each tier exposes the intended detail, including keyboard navigation and a meaningful focus return after drawers/dialogs close. Test actual browser interactions at supported viewport sizes and reduced-motion settings.

For the new overview, test uniform four-corner Projects, compact paired placement, non-intersecting reserved rectangles, and shared corridor routes ending at inward gates. Inspect full/compact/tiny density transitions, up to eight miniature seals plus an exact remainder, aggregate counts, and the full searchable mission collection. Exercise project search, 8/16/32/64/128 sample presets, and reset without removing baseline or user-created Projects. Verify that the removed cosmetic creation caps do not reappear as navigation limits.

Keep Coven/project scope explicit across pan, zoom, search, and history navigation. Fit must include the measured chrome-safe viewport and visible crown/label bounds. Resize should refit in auto-fit mode and preserve manual framing otherwise. Inspect the canonical crown aperture at multiple zoom levels in both scopes, with flat UI marks unchanged and no spinning or glow. These source contracts still require browser evidence for rendered clearance, focus, touch targets, and readability.

Use `scripts/plan-qa.mjs` to exercise the plan-only restriction, legacy saved settings and desktop and mobile camera inputs. The external Playwright setup and local preview commands are in [AGENTS.md](../../AGENTS.md).

### Combined mobile, replay, and fit boundaries

| Scenario | Required behavior |
| --- | --- |
| HUD/manifest changes at the compact breakpoint | Update the current lead-card structure before measuring and queuing fit; include a nested mobile HUD at its actual position. |
| Chrome hidden through CSS or DOM visibility | Exclude non-rendered/hidden elements from safe-area reservations; their old rectangles must not shrink the usable map. |
| Full mobile modal inspector | Keep modal focus/inert ownership; exclude the full modal from canvas-fit reservations while it obscures the inactive map. Reserve ordinary visible nonmodal chrome normally. |
| Keyboard opens during a queued resize | Recheck keyboard state inside the queued fit; defer automatic reframing while typing, and preserve camera lock/manual mode after it closes. |
| Replay removes the selected mission | Clear the stale selection and restore saved zoom/pan together with its saved auto-fit policy; cleanup must not silently re-enable auto-fit. |
| Adaptive popup closes | Reuse existing camera-dock/familiar observer notifications to update available space; do not add a second camera or replay state owner. |
| Project focus during playback | Retain the shared live cursor, elapsed time, and playing/paused state; imported recordings and delayed reports retain their defined boundaries. |

Source regressions for these boundaries do not replace a browser pass at the compact breakpoint, with actual keyboard geometry, nested controls, and modal focus behavior. Record the final combined result separately from both branches' earlier evidence.

For every canonical fixture, independently calculate familiar agent shares, owned-target progress, and the tightest time/token/budget limit. Check all six states: Planned, Active, Needs you, Stalled, Sealed, Broken. Near-white indicates a need for human attention; coral indicates at least 85% of the relevant limit or the defined broken-state treatment. Neither color grants authority.

Verify that the ring displays council share and target progress as separate quantities. Compare the labeled state, resource warning and exact counts with the inspector.

## Authority and recovery test matrix

The canonical owner must define API names and transition details before implementation. The expected authority behavior below is the acceptance invariant, not an invented endpoint contract.

| Scenario | Injection and observation | Expected authority behavior | Required evidence |
| --- | --- | --- | --- |
| Stale projection | Deliver an old snapshot, then attempt a protected decision using stale context. | UI marks stale context; server revalidates current authorized state or rejects the stale decision. Old displayed authority cannot authorize a write. | Daemon test, revisions, decision outcome, receipt or rejection. |
| Disconnected client/Host | Cut transport during observation and during an operation. | Client exposes disconnection/unknown outcome. Execution follows canonical leases and bounds; connectivity loss creates no new authority. | Network fault trace, lease state, side-effect count, reconnect result. |
| Pending proposal | Submit a valid proposal without an authorized decision. | Proposal remains pending and visually distinct from committed state; no protected effect occurs. | Server persistence and effect checks; UI pending representation. |
| Invalid identity/session | Substitute a root, revision, principal, or unauthorized session binding. | Fail closed; no fallback to a name, glyph, model, or nearby revision. | Red-to-green server rejection tests and zero protected effects. |
| Revocation race | Revoke authority after review but before commit. | Final verification and commit use the same valid immutable authorization snapshot or reject; stale review cannot bypass revocation. | Deterministic race test at enforcing boundary. |
| Cancellation race | Cancel before dispatch, during execution, and concurrently with completion. | Report authoritative outcome; prevent future effects as specified. Do not claim completed effects were undone without supported compensation. | Daemon/runtime race traces and final receipts. |
| Lost acknowledgement | Commit once, drop response, then reconnect. | Reconcile the original operation identity; do not blindly repeat the effect. Unknown remains explicit until resolved. | One committed effect, durable receipt, status/recovery trace. |
| Replay/duplicate decision | Repeat request/event across clients and restarts. | Canonical replay/idempotency rules prevent duplicate protected effects. Rejection does not trigger a permission retry. | Restart-inclusive tests, original operation identity, effect count. |
| Lease fencing | Let an old worker resume after its lease was replaced. | Stale fence cannot write or commit; only canonically authorized ownership proceeds. | Runtime/daemon tests covering both old and new workers. |
| Sync conflict | Concurrent clients/hosts propose incompatible updates from different revisions. | Apply canonical conflict policy with explicit outcomes; no last-writer-wins elevation of authority or silent proposal promotion. | Conflicting revisions, rejected/accepted outcomes, final state. |
| Event gap/reordering | Drop, duplicate, or reorder events around snapshot recovery. | Mark freshness uncertain, use supported reconciliation, converge without duplicate effects; never infer omitted approvals. | Cursor/snapshot trace and final-state comparison. |
| Limit reached/increased | Exhaust a bound, then submit an unauthorized increase. | Canonical enforcement stops further prohibited work; only a valid protected decision can increase a limit. | Measured usage, rejected increase, authorized-path receipt. |
| Host/daemon restart | Restart before persistence, after commit, and before delivery of receipt. | Recover only durable authoritative state; retain fencing/replay guarantees and explain uncertain outcomes. | Restart fault harness, durable records, effect counts. |
| Cross-client conflict | Act on the same proposal through Cave, CLI, Build, and Compass. | Clients share authoritative outcomes; later stale decisions cannot create extra effects or a different permission result. | Packaged/client integration matrix and common receipt references. |

## Evidence gates

**Contract gate:** W01–W02 identify real owners, versions, enforcement points, and supported compatibility. No production adapter is accepted against fictional APIs.

**Read gate:** canonical snapshots/events produce correct counts and seals; gaps, unavailable fields, and disconnects are legible. Unit fixtures and real-daemon read traces agree.

**Protected-write gate:** authority tests run at the enforcing boundary. Each corrected defect has a failing test before the fix and a passing test after it. Include unauthorized principals, scopes, identities, revocation, stale state, replay, and permission-denied behavior. A client-side validator is insufficient.

**Execution/recovery gate:** one bounded task passes real daemon/runtime tests, cancellation, fencing, limit enforcement, lost acknowledgements, and restart recovery. Extend to a real authenticated Host before claiming remote support. Document any explicitly unsupported fault mode and its safe failure behavior.

**Client/package gate:** run the actual installed CLI and deployed/test-packaged UI clients against the same supported contracts. Verify authentication/configuration, machine-readable outcomes, error/exit semantics, and receipt correlation. Validate the Site ZIP after clean extraction without Git history; record checker and fixture results separately from production package results.

**Pilot gate:** agree on principal, project, workload, budget, runtime capabilities, recovery owner, and success criteria before execution. Acceptance requires inspectable authorization, durable outcomes, no unexplained protected effects, and resolution of blocking failures in the matrix. Deployment/publication remains a separate explicitly authorized action.

Record exact commands, exit codes, environments, revisions, operation references, skipped checks, and risks using [06-execution-playbook.md](06-execution-playbook.md). A passing lower-level gate cannot substitute for a missing higher-level environment. Do not relabel an unrun test as passed because the architecture appears sound.
