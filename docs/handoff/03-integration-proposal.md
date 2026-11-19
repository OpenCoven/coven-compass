# Integration proposal: from simulation to one canonical mission

## Recommended first delivery

**Connect one existing project and one familiar to an observational Compass view, then qualify one bounded task through the existing Coven/Psyche path.** Expand to durable remote execution and Host synchronization only after the same operation can be inspected, refused, cancelled, and recovered through canonical interfaces.

Everything in this document is **proposed integration work**. The bundled Site currently mounts `CovenAtlas` with local snapshot, navigation, familiar-highlight, and legend functions. Its chat, approval, and activity behavior modifies sample worlds; it is not a production transport or SDK. Do not replace a function with a network call and assume the resulting application has inherited the necessary authority model. [S1] [S2] [S3]

## Delivery sequence and ownership

| Stage | Concrete work | Primary owner to establish | Exit evidence |
| --- | --- | --- | --- |
| 0. Discover | Map exact production objects, public clients, lifecycle rules, and packaged entry points. | Existing repository owners across Coven, Psyche, SDK, and Compass. | Revision-pinned contract map; unresolved assumptions assigned. |
| 1. Isolate presentation | Separate sample data generation from rendering and selection. Preserve the standalone demo. | Existing production UI/client owner, informed by Cave and Brand. | Demo remains explicit; operational mode cannot invoke sample mutation. |
| 2. Observe | Read one project's canonical snapshot and follow updates without writes. | SDK adapter plus Coven read surface. | Correct initial state, duplicate handling, gap detection, reconnect, and unavailable states. |
| 3. Propose | Submit a bounded proposal and render its actual decision/receipt lifecycle. | Threads/Coven integration through canonical SDK. | Unauthorized, stale, replayed, and revoked requests refuse correctly. |
| 4. Execute | Run one task with fixed inputs, a qualified runtime, fenced attempt ownership, and durable evidence. | Coven execution applying Psyche semantics. | One attributable attempt; acceptance evidence tied to exact inputs. |
| 5. Recover | Exercise cancellation, process loss, lost acknowledgments, and restart. | Coven/Psyche with runtime qualification. | No stale-owner commit or silent duplicate effect; unresolved outcomes remain visible. |
| 6. Extend Host | Synchronize eligible artifacts and proposals under one authoritative owner. | Existing Host/workspace integration owner discovered in stage 0. | Conflict, offline, path-safety, and recovery cases in the companion document. |

These are acceptance stages, not a promise that the production repositories currently contain the required interfaces. Keep each stage in the existing owning component where possible. [U1]

## Separate the two execution modes

The current event reducer, sample trace, automatic activity generator, replay tools, and Seal lab are valuable as a deterministic presentation fixture or explicitly labeled sandbox. Keep their writes within a demo-only adapter. In connected mode, a sample event must have no route to authoritative state. Conversely, replaying historical production evidence must not enable live command buttons merely because the browser changes its `live` flag. [S2]

Create a small adapter boundary with four responsibilities: obtain canonical read data; maintain subscription freshness; submit an allowed proposal/command through the SDK; and retrieve its authoritative result. Those are responsibilities, not proposed public method names or a new canonical schema. Translate the existing production contract into the presentation model, retaining source identifiers and provenance.

Do not ship mixed-mode fallback that silently substitutes sample missions when the daemon disconnects. Show the last known snapshot with its age, or an explicit unavailable state. The optional demo remains a separately selected experience.

## Read-model and subscription requirements

First discover whether the canonical interface offers snapshots, event cursors, revisions, or another consistency mechanism. The adapter must know the scope and consistency point of its initial snapshot before applying subsequent updates. A timestamp alone does not establish an ordered, gap-free stream.

Require a defined strategy for duplicate delivery, ordering, cursor expiration, and object removal. On a detectable gap, stop claiming freshness, enter reconciling state, and acquire a compatible authoritative snapshot. Apply a replacement snapshot and its cursor together; do not merge an old project list with new mission counts. Cache invalidation must respect owner changes and authorization changes as well as data revision.

Every displayed aggregate needs a counting rule. Identify whether an “agent” is an active worker, an allocated participant, an attempt, or historical execution. Count shared-task participants once under the agreed rule. Keep mission assignment, worker lifecycle, and familiar identity distinct. The simulation currently derives these counts from its in-memory maps; that makes its totals internally useful, not a production definition. [S2]

Read access is itself scoped. The server must filter inaccessible projects and evidence; hiding them in the SVG is insufficient. Preserve exact counters and source records in accessible detail even when the map aggregates or clamps visual marks. [U1] [S2]

## Authoritative command path

For the first command, choose an operation already supported by the canonical interface and bounded enough to inspect safely. Discover its actual SDK call and CLI equivalent; this handoff deliberately invents neither.

Discover the supported local/remote transport and its origin, authentication, and session-binding rules. A privately hosted Site is not inherently a trusted daemon client. Do not place reusable credentials in URLs or ordinary browser storage, and do not introduce an ad hoc bridge that bypasses the canonical client boundary.

The server-side path must establish the authenticated principal, exact familiar root/revision, operation-specific authority, target scope, expected object revision, and applicable limits. A caller-supplied role, claimed owner, project path, or model-generated approval is input to validate, not authority. The final authorization decision and commit must be atomic or use the same immutable state snapshot. [U1]

The client sends the canonical request and then represents the returned outcome faithfully:

- **Proposal retained:** the request is inspectable but has not been committed.
- **Accepted for processing:** work may be pending; this is not a success receipt.
- **Rejected or expired:** display the reason and the authoritative state needed to revise the proposal.
- **Committed/completed:** show the corresponding receipt and evidence at their actual scope.
- **Outcome unknown:** preserve the request identity and query its result; do not label failure or retry a potentially accepted effect blindly.

Use the existing idempotency/replay mechanism where available. If discovery finds none, the owner must design and qualify it before enabling a retrying write client. Reusing a correlation identifier does not by itself provide idempotency. Retries must also satisfy current routine/mission lifecycle, authorization, input revision, and resource policies.

## Long-running lanes, leases, and attempts

Before a task starts, resolve its immutable execution inputs: familiar root/revision, task intent, acceptance criteria, project/worktree revision, content digests, permitted paths/actions, runtime descriptor, and budget/time boundaries. Use the canonical reference/version mechanisms; do not mint a parallel task package format without discovery.

Psyche should define how the work occupies a lane, how a lease is acquired or renewed, what constitutes an attempt, and which conditions permit retry. Coven should persist and enforce those transitions. A worker must carry the current attempt and fencing identity to every protected write or effect-commit boundary. A heartbeat alone is not proof of current ownership. [U1]

Keep the goal durable across attempts. Proposed follow-up tasks need explicit dependencies, completion criteria, and bounded admission. Classify refusals and failures as terminal, blocked, or eligible for a particular retry policy. A refusal before ownership must not leave a run indefinitely “running” when its lifecycle prevents any valid retry; settle it or record an actionable recovery state.

After lease loss, an old worker may still run or return output. Its result may be retained as uncommitted evidence, but it must not overwrite a newer attempt or publish a protected result. Reacquiring the same task requires the canonical ownership transition and a new valid fence where the model requires one. Neither the UI nor a synced lock file may perform that transition.

For Psyche Build, use its existing coding/worktree integrations after discovery. A lane should work from an identified revision in an isolated worktree or equivalent supported workspace; it must not concurrently rewrite a human's active tree. Coven Code supplies execution through the selected runtime path. Build presents the same task, attempt, approval, and receipt objects used by the CLI and Cave rather than tracking a second lifecycle.

Acceptance should bind evidence to inputs. A passing test from one revision cannot qualify another revision by title. Distinguish a produced artifact, a recorded test result, an approved publication, and a provider-confirmed external effect.

## Effects, cancellation, and recovery

Before an external effect, persist the canonical intent and the relationship to the current attempt. Use supported provider idempotency or reconciliation where available. Do not promise exactly-once execution across an arbitrary external system: an effect may be accepted before its acknowledgment is recorded.

Cancellation has at least two observable moments: the request was committed, and the relevant execution/effect state was settled. Show that distinction. Stop admission of new work, revoke or invalidate further protected writes according to policy, request runtime cancellation, and reconcile outstanding effects. Cancellation cannot undo a provider-accepted action by changing a local status field.

On restart, recover from durable authoritative state. Reconcile attempts against runtime/provider evidence, expire or reassign ownership through the canonical mechanism, and retain uncertainty when the external outcome is unknowable. Resource accounting should likewise distinguish observed usage, reservations, and unresolved consumption; delayed reports cannot justify an invented hard-spend guarantee.

## Qualification matrix

For each case, capture the exact code/artifact revision, principal and fixture scope, request/attempt identifiers, observed transitions, and receipts. Start with the smallest relevant test, then use real-daemon or packaged-artifact tests wherever mocks could hide the failure. [U1]

| Case | Required result |
| --- | --- |
| Snapshot followed by duplicated updates | Stable state and counts; no repeated operation. |
| Subscription gap or expired cursor | Explicit reconciling state followed by a consistent snapshot. |
| Identity revision or authorization changes before commit | Revalidation rejects or degrades the request; no stale grant. |
| Same request retried after an acknowledgment is lost | Existing outcome is found or uncertainty remains explicit. |
| Worker loses its lease and returns late | Superseded attempt cannot commit protected output. |
| Cancel races with provider acceptance | Receipt distinguishes cancellation intent from external outcome. |
| Daemon/process failure during transition | Recovery produces a justified state without contradictory receipts. |
| Offline or stale client submits a decision | Proposal remains pending or is refused; client never self-commits. |
| Second host tries to acquire the same work | Single-owner rules and fencing prevent competing commits. |

The bundled source-level fixtures remain a useful visual regression floor, with the README recording their limited coverage. They do not satisfy this matrix. Browser interaction and responsive checks for the current revision also remain separately required. [S1] [S6]

## Implementation packets and rollout decision

Give each implementation agent a bounded packet: owning repository and exact starting revision; scoped instructions; the existing contract to extend; the invariant being repaired; allowed changes; acceptance commands discovered from that repository; and required evidence. Require a red-to-green example for authority or lifecycle bugs and preserve unrelated work. [U1]

Start with an adapter-focused change and one end-to-end qualification case. Expand only when the evidence supports the next stage. Keep disconnected observation usable, preserve demo isolation, and retain a clear path back to the previous client presentation. Merging, releasing, production deployment, paid infrastructure, and external communications require their own applicable authorization; producing this handoff has not performed any of them. [U1]

## Sources

[U1]: source-context/user-architecture-instructions.md
[S1]: ../../README.md
[S2]: ../../dist/index.html
[S3]: ../../dist/atlas-ui.js
[S6]: ../../tests/presentation.test.cjs

- [U1 — canonical ownership, atomic authorization, and engineering requirements][U1].
- [S1 — current Site scope and verification limitations][S1].
- [S2 — local reducer, replay, command simulation, and snapshot implementation][S2].
- [S3 — current presentation adapter][S3]; [S6 — source-level regression fixtures][S6].
