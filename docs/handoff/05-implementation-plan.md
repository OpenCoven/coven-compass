# Implementation plan: from visual simulation to canonical orchestration

## Current work and acceptance

At the November 23 closeout, Compass main `5201943` serves a local simulation with typed map geometry and replay, explicit simulation and fixture projection sources, and a Trace panel for inspecting and editing local recordings. Contributors can exercise Project selection, mission history and approvals from a local checkout. The first production integration proposed below is an authenticated Project read. Its prerequisites are tracked in [#2](https://github.com/OpenCoven/coven-compass/issues/2) and [#36](https://github.com/OpenCoven/coven-compass/issues/36).

### Delivered foundations

| Milestone | Merged revision | Acceptance and subsequent changes |
| --- | --- | --- |
| M1 · One verification command | [#7 · 0c12450](https://github.com/OpenCoven/coven-compass/pull/7) | Run `node scripts/verify-all.mjs --check` on a clean checkout. Val retired the historical hosted Actions run and artifact requirement for #13 on November 23. Actions remains disabled. The required merge check is Vercel. |
| M2 · Generated evidence | [#8 · 5079373](https://github.com/OpenCoven/coven-compass/pull/8) | The verifier measures the suite and compares its output with [current.json](../../tests/evidence/current.json). Source checks guard against copying counts into other documents. |
| M3 · Reproducible guide and manifest | [#9 · e344547](https://github.com/OpenCoven/coven-compass/pull/9) | The stale-guide negative control and build-only manifest qualified the former release format. [#63](https://github.com/OpenCoven/coven-compass/pull/63) subsequently retired the guide and download. Edit the handoff chapters in Git. |
| M4 · Contributor entry points | [#10 · c1191b6](https://github.com/OpenCoven/coven-compass/pull/10) | [AGENTS.md](../../AGENTS.md) maps edits to checks, invariants and delivery steps. [CLAUDE.md](../../CLAUDE.md) points to that workflow. |
| M5 · Discovery packet | [#11 · 3ddeafe](https://github.com/OpenCoven/coven-compass/pull/11) | Verify the pinned packet with `shasum -a 256 -c SHA256SUMS` in its [directory](../discovery/2026-11-19-d01-d04/). Val accepted the research. Nova retains decision routing in #2. |
| M6 · Projection sources | [#12 · e556b08](https://github.com/OpenCoven/coven-compass/pull/12) | Simulation and fixture modes expose freshness and availability. [#34](https://github.com/OpenCoven/coven-compass/pull/34) hardened version, time and container handling. Run `node --test tests/projection-source.test.cjs`. |

The keyboard and compact-label follow-ups landed through #43 and #47. The strictly 2D presentation in #48 superseded #32. Public entry-point qualification was delivered under #38. [#13](https://github.com/OpenCoven/coven-compass/issues/13) records the milestone history. The Projects drawer fix from #67 landed with #77. [#66](https://github.com/OpenCoven/coven-compass/issues/66) records the cold WebKit pointer and control journeys on the pre-#103 main and the drawer candidate. [#103](https://github.com/OpenCoven/coven-compass/pull/103) subsequently landed the responsive drawer and the shared regression for descendant activation and compact task captions.

The [#40 recovery](https://github.com/OpenCoven/coven-compass/pull/109) passed the six-cell budget twice on the candidate and again on merged main. The [reference-host report](../map-performance.md#merged-revision) links the measurements and profiles.

### Next decisions and delivery gates

Start with the [next contributor task](../../START_HERE.md#next-contributor-task). The roles below identify who can supply the next evidence. Existing claims and review threads govern implementation ownership.

| Issue | Next action and owner | Evidence needed to finish |
| --- | --- | --- |
| [#2 · D01–D04](https://github.com/OpenCoven/coven-compass/issues/2) | Nova routes the remaining questions to Coven, Cave, Host, Psyche and SDK owners. Val selected Cave as pilot issuer and a stored, daemon-minted ID long term. [#105](https://github.com/OpenCoven/coven-compass/pull/105) records the accepted issuer on main. | Link owner decisions on remaining identity and binding questions, folder registration, authorized reads, and pagination/version/gap recovery in the [decision register](11-open-decisions.md). The daemon entity, read route and migration are tracked in [Coven #1833](https://github.com/OpenCoven/coven/issues/1833). Preserve the accepted Sage packet at its original revision. |
| [#20 · Castle reference](https://github.com/OpenCoven/coven-compass/issues/20) | Inspection v1 landed at `d6b47de`. Cody’s [Castles #29](https://github.com/OpenCoven/coven-castles/pull/29) emits an optional display alias. Cody [confirmed the alias is display-only](https://github.com/OpenCoven/coven-castles/pull/29#issuecomment-7236530858). The [lifecycle owner](https://github.com/OpenCoven/coven-agents/issues/296#issuecomment-7237080340) needs to identify the approved owner-scoped read that supplies the exact Cave pair to the existing [Compass #26](https://github.com/OpenCoven/coven-compass/pull/26) join. | The [producer-to-consumer probe](https://github.com/OpenCoven/coven-compass/issues/20#issuecomment-7235724506) leaves the alias unlinked and links the exact-pair control. Use the approved producer read to requalify exact, wrong-issuer, wrong-reference, absent, ambiguous and partial inputs. [Host #16’s Linux receipt](https://github.com/OpenCoven/coven-host/pull/16#issuecomment-7235738424) covers historical peers and the native stopped upgrade. |
| [#36 · First real Project read](https://github.com/OpenCoven/coven-compass/issues/36) | The [two-page packed SDK exercise](https://github.com/OpenCoven/coven-compass/issues/36#issuecomment-7151283426) returned the full synthetic registry. [#112](https://github.com/OpenCoven/coven-compass/pull/112) delivered the consumer’s empty, incomplete and clock-skew fixture views. The [current Cave route receipt](https://github.com/OpenCoven/coven-compass/issues/36#issuecomment-7235839474) confirms instance binding and registry-wide reads. Cave and Coven confirm the dedicated-instance principal boundary or identify the supported scoped operation, with SDK support. Optional Castle association can follow. | Pin producer, SDK and consumer. Demonstrate a packed or deployed read with bounded pagination, provenance, revocation, unsupported versions, stale cursors and gap recovery. Keep the browser free of daemon credentials and mutation paths. |
| [#35 · Brief success policy](https://github.com/OpenCoven/coven-compass/issues/35) | [#44](https://github.com/OpenCoven/coven-compass/pull/44) delivered the local editor, history and labeled fixture inspector. [Val approved](https://github.com/OpenCoven/coven-compass/pull/44#issuecomment-7159570323) candidate and attempt, policy revision, evaluator, sealed evidence reference, next permitted action, and the authoritative acceptance receipt reference when available. Psyche owns the Brief evaluator and policy contract. Coven owns the retry, reconciliation and acceptance transitions. | The [current browser receipt](https://github.com/OpenCoven/coven-compass/issues/35#issuecomment-7235843043) covers cumulative budgets, uncertain effects and the synthetic inspector fields. Link the adopted evaluator, revision, candidate binding and evidence example. Closure requires the authoritative failed-attempt, bounded-retry and terminal acceptance sequence at pinned producer and consumer revisions. [Remaining acceptance checklist](https://github.com/OpenCoven/coven-compass/issues/35#issuecomment-7157111627). |
| [#37 · Outcome targets](https://github.com/OpenCoven/coven-compass/issues/37) | After #35’s policy profile, Psyche, Compass, Coven and one observation-source owner specify one metric, attribution rule, unit, settlement window and correction policy. | Exercise duplicates, partial/stale evidence, refunds and corrections in fixtures, then retain redacted authenticated source receipts and the separate authoritative acceptance transition. |
| [#39 · Physical accessibility](https://github.com/OpenCoven/coven-compass/issues/39) | Val and the device reviewer select supported combinations and run the remaining [device matrix](../../MOBILE_READINESS.md) against an identified served artifact. The [partial Duo check](https://github.com/OpenCoven/coven-compass/issues/39#issuecomment-7237107853) shows the selected Brief behind Psyche after unfolding. The [automated companion](https://github.com/OpenCoven/coven-compass/issues/39#issuecomment-7237132279) covers minimizing and returning to the mission list. Val deferred fresh VoiceOver independently of release. | Record actual viewports, hardware, IME, multi-touch, rotation, focus return, visual preferences and human acceptance per combination. Keep earlier spoken observations tied to their original build. |

## Proposed production phases

W01–W14 below describe proposed production work. Use the issue table above to locate delivered evidence and current dependencies. Repository paths are relative to the checkout. Consult the [source ledger](12-source-ledger.md) and [owner architecture instructions](source-context/user-architecture-instructions.md) when resolving a contract with its steward.

## Ownership to confirm

| Component | Responsibility to preserve |
| --- | --- |
| Familiar Contract | Governed identity, exact authorized root and revision. |
| SPAR | Continuity profile/query plane; no second identity root or database. |
| Coven Threads | Protected-surface authorization and proposal-versus-commit decisions. |
| Psyche | Canonical task, lane, lease, approval, receipt, retry, and recovery semantics. |
| Coven | Daemon authority, persistence, sessions, runtime execution, authoritative transitions. |
| Coven Host | Discover its actual role; bind remote execution/access to canonical Coven authority. |
| Coven Runtimes / SDK | Runtime capability conformance and constrained canonical client bindings. |
| Compass / Cave | Project-scope visualization and human oversight; discover where production UI belongs. |
| Psyche Build / CLI | Coding cockpit and terminal clients consuming the same authorized objects. Discover the CLI’s relationship to Coven Code. |

These boundaries are design constraints, not evidence that every component already exposes the required capability. Before adding any service, schema, storage, or adapter, establish whether an existing component owns it.

## Phase 0 — repository and contract discovery

### W01 · Pin the integration surface

**Owner:** integration lead with each repository maintainer. **Dependencies:** none. **Discover:** scoped `AGENTS.md`, README, ADRs, package/lock files, schemas, CI, release artifacts, worktree state, and relevant open work. Inventory actual repositories and revisions without modifying unrelated changes. Map requested names to current components; record unavailable repositories explicitly.

**Acceptance:** a versioned owner map identifies authority, client, persistence, identity, runtime, and deployment boundaries. **Evidence:** exact revisions, file references, commands, and unresolved access questions. A missing contract produces a discovery issue, not a guessed API.

### W02 · Establish the canonical object and transition map

**Owner:** Psyche, Coven, Threads, Familiar Contract, and SDK maintainers. **Dependencies:** W01. **Discover:** project/scope, mission/task, familiar/session, agent/attempt, proposal/decision, lease/fence, event/cursor, receipt, cancellation, and limit definitions. Identify authentication, atomic authorization/commit behavior, idempotency rules, and supported compatibility policy.

**Acceptance:** every displayed quantity and proposed command maps to a canonical field or an explicit missing capability. Differentiate an agent identity, execution attempt, and lease. **Evidence:** source-backed mapping and a proposed contract change only where an existing owner needs one. This is the first integration gate.

## Phase 1 — read-only canonical projection

### W03 · Implement the constrained read adapter

**Owner:** SDK and the existing client/projection owner. **Dependencies:** W02. **Discover:** authenticated snapshot/query APIs, event subscriptions, pagination, cursor semantics, ordering, and reconnect behavior. Implement the smallest supported adapter; preserve revisions and provenance in its output. Do not move the prototype’s `apply()` or `emit()` reducer into a new authoritative service.

**Acceptance:** a canonical fixture or daemon snapshot produces the expected view; event gaps suspend claims of freshness and trigger supported reconciliation. **Evidence:** adapter tests, recorded input versions, and a real-daemon read trace when available. No protected write is required for this phase.

### W04 · Bind the visual grammar to source-backed facts

**Owner:** Compass/Cave UI owner with Psyche review. **Dependencies:** W03; static component work may proceed after W02. **Discover:** existing UI components, accessibility conventions, and navigation ownership. Replace `atlasSnapshot()` sample totals with adapter-derived data. Keep uniform project boundaries, mission seals, familiar identity marks, selected-mission agent dots, and boundary decision entry points.

**Acceptance:** exact counts remain available beside minimum-angle and pip-cap encodings; stale/disconnected/reconciling are explicit connection conditions, separate from the six mission states. Missing data never becomes zero by default. **Evidence:** projection fixtures, interaction/accessibility results, and traceable seal calculations.

## Phase 2 — authenticated proposals and decisions

### W05 · Enforce the protected command boundary

**Owner:** Coven Threads and Coven, consuming Psyche contracts. **Dependencies:** W02; W03 provides readback. **Discover:** principal authentication, session binding, authorization objects, immutable snapshots, revocation checks, replay defense, and durable receipts. Build the supported proposal/decision route in its canonical owner. Treat every client field as untrusted.

**Acceptance:** final authorization and commit are atomic or use the same immutable authorized snapshot. Wrong principal, identity revision, scope, stale authorization, or replay cannot produce a protected effect. **Evidence:** red-to-green boundary tests at the enforcing server, including revocation between proposal and decision. UI-only checks cannot close this packet.

### W06 · Present pending, rejected, and uncertain outcomes accurately

**Owner:** Compass/Cave and SDK. **Dependencies:** W05. **Discover:** decision request/result shapes and operation-status lookup. Replace the local `resolve()` simulation with proposal submission and authoritative readback. Submission remains pending until a canonical outcome is known; transport loss produces an explicit unknown outcome.

**Acceptance:** the boundary square opens relevant pending decisions, review displays actual operation and scope, and duplicate input cannot duplicate execution. Rejection or a lost acknowledgement never causes an automatic permission retry. **Evidence:** UI contract tests and server receipts correlated to a single operation identity.

## Phase 3 — bounded execution in one Project

### W07 · Connect one scoped execution path

**Owner:** Coven, Psyche, and Coven Runtimes. **Dependencies:** W05 and runtime capability discovery. **Discover:** supported runtime descriptors, task assignment, lane scheduling, lease acquisition, fencing, workspace boundaries, and result receipts. Choose a reversible pilot task within a specifically authorized project scope. Bind execution to the exact familiar root/revision and authorized operation.

**Acceptance:** one canonical mission can create bounded work, expose its attempts, and produce durable receipts. A stale worker or substituted identity cannot commit. **Evidence:** real runtime/daemon integration, lease/fence observations, allowed/denied side-effect checks, and cleanup records.

### W08 · Make cancellation and limits authoritative

**Owner:** Psyche and Coven; clients expose results. **Dependencies:** W07. **Discover:** cancellation races, attempt completion, elapsed/token/budget accounting, reservation rules, and retry ownership. Define the observable behavior for an in-flight effect when cancellation arrives; do not promise rollback unless a canonical operation supports it.

**Acceptance:** reaching a bound stops further unauthorized work, increasing a limit follows protected authorization, and cancellation distinguishes requested, accepted, stopping, and terminal outcomes where the canon supports them. **Evidence:** deterministic race tests and daemon restart tests. A coral rim is a warning projection, never enforcement.

## Phase 4 — Host synchronization and recovery

### W09 · Bind remote Host execution to existing authority

**Owner:** verified Coven Host owner with Coven, Runtimes, and identity maintainers. **Dependencies:** W07 and W01’s deployment inventory. **Discover:** trust establishment, credential placement, host enrollment, session scopes, network assumptions, capability negotiation, and where durable state lives.

**Acceptance:** remote placement changes the execution surface without creating another identity root or authorization authority. An untrusted or incompatible host cannot acquire protected capability by claiming it. **Evidence:** an explicit trust/data-flow diagram, capability failure tests, and authenticated remote execution under a bounded pilot principal.

### W10 · Recover without duplicate effects or invented truth

**Owner:** Coven/Psyche persistence and Host transport owners. **Dependencies:** W09. **Discover:** acknowledgements, durable cursors, reconnect snapshots, conflict policy, operation lookup, fencing persistence, and recovery ownership. Exercise lost messages and host/daemon restarts at transition boundaries.

**Acceptance:** unknown outcomes reconcile against canonical receipts; repeated events converge without repeating effects; stale leases cannot regain authority; synchronization conflicts remain explicit until canonically resolved. **Evidence:** reproducible fault-injection traces with operation IDs, event positions, authority revisions, final state, and side-effect counts.

## Phase 5 — Psyche Build, CLI, and Cave parity

### W11 · Integrate Psyche Build as a canonical consumer

**Owner:** Psyche Build and SDK. **Dependencies:** W03–W08; remote features wait for W10. **Discover:** existing task/lane views, proposal surfaces, receipt links, coding workspaces, and recovery UI. Preserve Build’s specialized cockpit without inventing an independent scheduler or approval store.

**Acceptance:** Build and Compass show the same underlying mission, attempt, proposal, and receipt identities. A changed view does not change authority. **Evidence:** a shared scenario replayed through both clients and canonical state comparisons.

### W12 · Verify packaged CLI and oversight parity

**Owner:** actual CLI/Coven Code owner, Cave, SDK, and packaging maintainers. **Dependencies:** W05–W08. **Discover:** real supported commands, machine-readable output, exit behavior, configuration, authentication, and packaged entry points. Document discovered commands only after verifying them.

**Acceptance:** packaged CLI, Cave, Build, and Compass preserve pending/committed/rejected/unknown distinctions and point to the same receipts. Noninteractive use fails closed when required authority is absent. **Evidence:** installed-package tests and a cross-client operation matrix; source imports alone do not prove the shipped CLI works.

## Phase 6 — packaging and bounded pilot gates

### W13 · Produce a reproducible review package

**Owner:** release/package owner and integration lead. **Dependencies:** relevant client work and contract compatibility decisions. **Discover:** current release policy, artifact signing/checksums, supported platforms, upgrade behavior, and CI gates. Identify the production artifact and its release owner. The former Site handoff ZIP was retired in #63.

**Acceptance:** the exported source verifies without Git history, contains accurate provenance, excludes secrets/runtime data, and exposes known limitations. Production packages meet their existing gates. **Evidence:** checksums, clean extraction validation, packaged-client results, and exact command logs.

### W14 · Run an explicitly bounded pilot

**Owner:** principal/product owner with Coven, Host, and client maintainers. **Dependencies:** W10–W13 and all applicable acceptance gates. **Discover:** authorized principals, project scope, runtime capabilities, limits, observability, recovery ownership, and rollback procedure.

**Acceptance:** the agreed workload completes with inspectable authorization and receipts; injected failures recover as specified; no unexplained or duplicate protected effects remain. **Evidence:** the matrix in [07-validation-and-acceptance.md](07-validation-and-acceptance.md), unresolved-risk register, and explicit publication/deployment authorization. Do not infer production readiness from the visual prototype or unit suite.

## Sequencing rule

Advance by evidence rather than calendar dates. Discovery unlocks parallel projection, enforcement, and runtime work against the same pinned contracts. Protected effects wait for enforcement; remote execution waits for bounded local execution; cross-client acceptance waits for authoritative results. Packaging can prepare early, but a pilot cannot bypass unfinished authority, recovery, or compatibility gates.
