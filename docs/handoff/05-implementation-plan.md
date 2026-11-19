# Implementation plan: from visual simulation to canonical orchestration

## Status and scope

**Proposed production work.** The design input began with the v3 Site at revision `d7b6f1e655140036cca49f31687131352162de13`; the bundle also contains subsequent mobile/navigation work and the [scalable Atlas layout/crown refinement](15-scalable-atlas-layout.md). The latter is implemented and source-level verified. The buildless JavaScript/SVG interface, local event reducer, sample decisions, replay, and seal laboratory remain a presentation reference. They do not establish a daemon integration, production authorization, remote execution, or durable orchestration service. Record actual delivered source and packaging separately from historical baseline evidence.

Paths such as `README.md`, `dist/index.html`, and `tests/presentation.test.cjs` are relative to the bundle root. Read the shared source ledger and `docs/handoff/source-context/user-architecture-instructions.md` before implementation. API names, repository locations, and supported protocol versions remain **TBD through canonical repository discovery**. “Coven Host,” “Compass” (formerly “Castles”), and “CLI” describe requested integration surfaces; their existing ownership and implementation must be verified.

The intended result is one coherent path from a human-readable project and mission view to authoritative state, bounded work, and auditable outcomes. Keep the familiar identity distinct from its delegated agents. Preserve the visual grammar while replacing sample data with a constrained projection of canonical records.

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

**Owner:** release/package owner and integration lead. **Dependencies:** relevant client work and contract compatibility decisions. **Discover:** current release policy, artifact signing/checksums, supported platforms, upgrade behavior, and CI gates. Keep the Site handoff ZIP distinct from a production release.

**Acceptance:** the exported source verifies without Git history, contains accurate provenance, excludes secrets/runtime data, and exposes known limitations. Production packages meet their existing gates. **Evidence:** checksums, clean extraction validation, packaged-client results, and exact command logs.

### W14 · Run an explicitly bounded pilot

**Owner:** principal/product owner with Coven, Host, and client maintainers. **Dependencies:** W10–W13 and all applicable acceptance gates. **Discover:** authorized principals, project scope, runtime capabilities, limits, observability, recovery ownership, and rollback procedure.

**Acceptance:** the agreed workload completes with inspectable authorization and receipts; injected failures recover as specified; no unexplained or duplicate protected effects remain. **Evidence:** the matrix in [07-validation-and-acceptance.md](07-validation-and-acceptance.md), unresolved-risk register, and explicit publication/deployment authorization. Do not infer production readiness from the visual prototype or unit suite.

## Sequencing rule

Advance by evidence rather than calendar dates. Discovery unlocks parallel projection, enforcement, and runtime work against the same pinned contracts. Protected effects wait for enforcement; remote execution waits for bounded local execution; cross-client acceptance waits for authoritative results. Packaging can prepare early, but a pilot cannot bypass unfinished authority, recovery, or compatibility gates.
