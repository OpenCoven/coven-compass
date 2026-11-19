# Security and authority handoff

**Status:** proposed integration requirements. The governing ownership rules come from Val’s supplied OpenCoven instructions. Production repository conformance has not been inspected in this handoff. The shipped Atlas is a local simulation, as documented in [README](../../README.md); it neither authenticates a principal to Coven nor executes protected operations.

## 1. Preserve the trust boundary while replacing the simulation

The current `atlasSnapshot()` reads local JavaScript worlds, and `emit()` appends local simulation events. `gate.resolved` changes those sample worlds. Those functions are useful presentation and replay seams; they are not suitable authorization or durable-commit implementations. The implementation is visible in [dist/index.html](../../dist/index.html). No transport adapter should silently reinterpret a local `allowed` state as a real permit.

Use one authority path. Coven owns authoritative transitions and persistence; Psyche owns orchestration semantics; Coven Threads owns protected-surface authorization and proposal-versus-commit decisions; the SDK exposes constrained canonical bindings. Atlas, Castles, Cave, CLI, and Psyche Build consume those owners. A Host folder, browser cache, familiar message, or UI control cannot create another writer or authorize itself.

The first live integration should be read-only. Introduce command submission only after the exact existing authentication, operation authorization, replay protection, revocation, and receipt contracts are mapped and tested. Keep the local simulation adapter visibly separate from a daemon adapter. A transport failure must not fall back to simulated success.

## 2. Identity, intent, authority, orchestration, and execution

| Concern | Required binding | What a client may do |
| --- | --- | --- |
| Identity | Exact authorized familiar root and revision; principal association resolved by the identity/authority owners | Display verified references and request an explicit binding; never infer identity from a name, color, or project path |
| Intent | Concrete operation, target scope, immutable input references, requested effect, and bounded parameters | Draft and submit an intent through the canonical client |
| Authority | Authenticated principal, operation-specific authorization, freshness/replay rules, revocation/recovery state | Present the decision interface and show returned outcomes; never make the final decision locally |
| Orchestration | Canonical mission/task/lane/attempt state, leases, retries, recovery and cancellation | Render an adapter projection and request supported transitions |
| Execution | Runtime capability descriptor, constrained environment, fenced attempt and output provenance | Display execution evidence; never treat a process exit or model response as proof of authorized completion |

If a familiar changes revision while an attempt is active, use the canonical session-binding policy. Do not hot-swap the revision because the display name is unchanged. Until the policy is verified, hold a proposed rebinding for review and preserve the original attempt’s identity references. SPAR may explain continuity across revisions; it does not grant a new execution identity or become a second identity root.

## 3. Keep connection, freshness, and work state separate

An active mission can be observed through a disconnected client. A successful receipt can arrive while the map is reconciling an event gap. These must remain distinct axes, rather than collapsing into one green/red status.

| Axis | Proposed presentation vocabulary | Required behavior |
| --- | --- | --- |
| Connection | Connected, disconnected, reconnecting, unavailable | Describe transport availability; never infer that a disconnected remote attempt stopped |
| Projection quality | Fresh, stale, degraded, reconciling, unknown | Mark incomplete or old views; retain the last observation with its provenance and age |
| Orchestration | Map the actual canonical states discovered in Psyche/Coven | Do not promote the prototype’s six visual seal states into a new normative state machine |
| Command outcome | Draft, pending, committed, rejected, unknown outcome | Pending is visually and structurally distinct from committed; unknown means reconcile, not retry blindly |

These names are an adapter proposal, not a new canonical enum. Snapshot revisions, ordering/cursor scope, completeness and reset rules must come from existing contracts. A sequence number is meaningful only within its defined owner and stream. On a gap, keep the last verified view, mark it reconciling, and request the supported snapshot/resume path. Do not splice unrelated host streams into an apparently complete ordered history.

A JSON field claiming `authenticated`, `authoritative`, or `fresh` is not proof. The application establishes transport/session trust, validates the canonical envelope and scope, and derives its own observation state. The [projection example](../../examples/proposed-atlas-projection.json) deliberately demonstrates a cached, unverified fixture.

## 4. A protected operation needs a complete decision, not a button click

Before any protected commit, the authority owner must validate the exact principal, familiar root/revision, operation, target, input commitment, expected state revision, applicable lease generation, bounded parameters, authorization lifetime, and revocation state. Bind the final verification and commit atomically or to the same immutable snapshot. A preview or preflight result may become stale before the user confirms.

Prefer the established outcomes **Permit / Degrade to Proposal / Reject**. A UI may collect an intent while offline; it must not render a queued file as an accepted proposal or committed action. Creating the authoritative proposal itself may require authenticated submission. Proposal edits need new revision bindings so an approval cannot apply to different bytes.

The [command-intent example](../../examples/proposed-command-intent.json) is a draft fixture, not an endpoint payload. It omits credentials and client-asserted authority. Its operation name and precondition names must be replaced by mapped canonical SDK types before any implementation uses them.

## 5. Submission, idempotency, and an unknown outcome

The client should establish a stable request identity before its first submission and preserve the exact intent bytes for retries. The server must bind any deduplication key to principal, operation, target and request content according to the canonical contract. Reusing the key with different content must fail explicitly; silently choosing one version is not acceptable. A client-generated key alone does not establish server deduplication, and server deduplication alone does not guarantee exactly-once effects at an external provider.

If a connection drops after submission, show **outcome unknown**. First query the authoritative operation/receipt status through the supported protocol. If committed, adopt that receipt. If rejected, display the rejection. If pending, keep it pending. If absence can be established under the protocol’s consistency and retention rules, follow its permitted retry path using the same identity and immutable request. Otherwise preserve uncertainty and surface an operator recovery action. Do not invent a new key to escape a pending request.

For an HTTP transport, RFC 9110 defines conditional requests such as `If-Match` and distinguishes idempotent methods from operations whose retries require additional knowledge. These are useful transport primitives, not substitutes for Coven’s operation authorization or external-effect reconciliation. An ETag only works as a concurrency precondition when the server defines and checks the relevant representation before mutation. [HTTP source](https://datatracker.ietf.org/doc/html/rfc9110#section-13.1.1); [retry semantics](https://datatracker.ietf.org/doc/html/rfc9110#section-9.2.2).

## 6. Attempts, leases, and cancellation

Every runtime attempt must carry its authoritative attempt identity and fencing context. The receiving authority verifies that context before accepting outputs or transitions. Lease expiry, transfer, cancellation, or recovery cannot be enforced solely by hoping an old process exits. A stale process may still produce bytes; those bytes must remain uncommitted until accepted under the current canonical rules.

Cancellation has at least two distinguishable observations: the request was accepted, and the attempt reached a terminal cancelled/stopped outcome. A disconnected view must not claim the second based on the first. Document whether children, remote provider requests, temporary files, and external side effects are cancellable, recoverable, or require reconciliation. Do not promise that cancellation reverses a provider-accepted action.

Retries require a classified failure, bounded policy, valid identity and current authority. A previous approval is not an unlimited retry capability. A paused mission, revoked familiar, changed input, expired authorization, or transferred lease must not be resumed by the UI’s retry button without the applicable canonical transition.

## 7. Host-folder and synchronization boundaries

Treat synchronized files as inputs, proposals, immutable artifacts, exports, or derived views according to an explicit allowlist. Do not synchronize live daemon databases, credentials, sockets, lock files, process handles, or host-specific lease ownership as ordinary project files. Do not turn receipt copies into writable authority records.

If Coven uses SQLite in the target implementation, its WAL is part of persistent database state; copying a live main database independently is not a safe synchronization design. SQLite documents database-aware snapshot mechanisms such as its Online Backup API. Use the established Coven export/backup owner and verify restore behavior rather than introducing a UI-controlled database-copy routine. [WAL source](https://www.sqlite.org/wal.html); [backup source](https://sqlite.org/backup.html).

An import must validate its destination root, normalized relative paths, archive traversal, symlinks, file types, size/resource limits and content commitments using host-appropriate primitives. Recheck at the actual write boundary; checking a path and later following a replaced symlink is insufficient. Unknown file types stay quarantined or excluded until their handling is defined. A manifest hash establishes byte identity, not authorization or trust in its producer.

Use explicit conflict objects or proposals for concurrent edits. Do not resolve familiar identity, authority records, accepted mission state, lease ownership, or approvals by timestamp or last-writer-wins. Remote ownership transfer is a canonical operation, not a folder move. Preserve unacknowledged local edits during reconciliation without treating them as accepted remote state.

## 8. Inputs, outputs, and privacy

Task text, repository instructions, model output, imported files and tool results are untrusted data. They may request a broader operation but cannot authorize it. Avoid wiring rendered prose or arbitrary file metadata directly into command construction. Validate operation variants and structured arguments in the canonical service, with output encoding and bounded rendering in the UI.

Keep credentials outside the shared Host tree and browser storage. Presentation preferences may remain local; authorization state must follow the supported credential/session mechanism. Logs and exported evidence should identify target, attempt, familiar revision, receipt and content commitment while redacting secrets and minimizing unnecessary prompt/file content. Retention and export policies require explicit product decisions before a real pilot.

The supplied [presentation tests](../../tests/presentation.test.cjs) establish selected view logic and seal geometry. They do not prove identity enforcement, transport isolation, durable authorization, runtime containment, packaged behavior, revocation, or safe remote execution. The production acceptance matrix belongs in [validation and acceptance](07-validation-and-acceptance.md), with evidence from the actual daemon, packaged clients and target runtime.

## References and evidence status

- **Normative constraints supplied by Val:** OpenCoven ownership boundaries and core laws in the task’s AGENTS.md instructions. These are requirements, not verified implementation findings.
- **Implemented prototype evidence:** [README](../../README.md), [simulation and renderer](../../dist/index.html), [presentation fixtures](../../tests/presentation.test.cjs).
- **Primary technical references, checked 2026-11-18:** SQLite WAL and Online Backup API; IETF RFC 9110 §§9.2.2 and 13.1.1, linked above. These substantiate limited technical guidance; they do not certify Coven’s current behavior.

