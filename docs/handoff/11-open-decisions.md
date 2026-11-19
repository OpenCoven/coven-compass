# Open decisions and proposal register

**Status:** recommendations for implementation discovery and owner review. This handoff does not establish new canonical APIs, repository ownership, authorization policy, or production readiness. The current Site is the working visual simulation described in [README](../../README.md). Use [architecture and ownership](02-architecture-and-ownership.md) and [implementation plan](05-implementation-plan.md) to turn these decisions into bounded engineering work.

## Decisions that can proceed as reversible implementation work

During a separately assigned implementation task, the team can inspect repositories, map existing contracts, create isolated adapters and fixtures, prepare draft issues/PRs, and gather evidence within that task's authorization. This handoff request itself covers the source package, documentation, and Site download surface; it does not dispatch the proposed production work. Once implementation is assigned, carry authorized work far enough to make a policy choice concrete instead of stopping at a generic approval note.

Record a decision as **proposed**, **accepted by owner**, **implemented**, and **verified** separately. A checked-in proposal is not an owner decision; a merged patch is not proof of packaged or remote behavior. Superseded proposals remain linked to the decision that replaced them.

## Decision register

| ID | Decision and owner | Recommended starting proposal | What must be resolved before acceptance |
| --- | --- | --- | --- |
| D01 | **Meaning and owner of a Project.** Coven/Psyche owners; Compass product owner | **Naming decided by Val on 2026-11-19: Projects contain Castles.** The visual enclosure is a **Project**, using Coven's existing project noun. **Castle definition decided by Val on 2026-11-19:** a **Castle** is a bounded, hosted place where a Project's work runs and its results come back, with exactly one execution owner. `OpenCoven/coven-host` provides a Castle's folder surface (`Castles/<name>/files` in, `results` out); `OpenCoven/coven-castles` checks whether a sandbox is fit to back a Castle. A Project has zero or more Castles. A Castle is never the Project: its folder path and `castle.json` must not become a Project identity, and it keeps its own ID. Map the Project to an existing durable project/workspace scope. Keep a display name separate from its canonical identity and filesystem location. | Ownership is still open. Inspect current schemas and repositories to establish which canonical object backs a Project, whether missions can span Projects, whether a Project can bind multiple roots without creating a new competing project authority, and whether a Castle serves exactly one Project (a working assumption, not a contract). |
| D02 | **Host as folder/product surface.** Coven owner; Host product owner | Treat Coven Host as the human-facing arrangement of files, synchronization and execution surfaces around canonical Coven authority. | Determine which existing component owns folder discovery, export/import, synchronization configuration and daemon selection. Do not create a new Host control plane to resolve naming uncertainty. |
| D03 | **Daemon connection and credential handling.** Coven/SDK/security owners | Use an existing authenticated local or remote transport and canonical SDK binding. Start with a read-only view. | Pin the supported transport, origin/session rules, credential storage, principal selection and revocation behavior. A static Site must not acquire an unauthenticated loopback bridge merely to make the demo convenient. |
| D04 | **Projection/version negotiation.** Psyche/SDK owners; UI consumers | One adapter maps canonical snapshots/events into the Compass display model. Keep transport freshness separate from work state. | Establish snapshot scope, cursor lifetime, completeness, schema versions, unknown-field handling and gap recovery. Decide how unsupported versions become visibly unavailable or degraded. |
| D05 | **Protected operation wiring.** Threads/Coven owners; Cave/CLI/Psyche Build consumers | Reuse existing proposal and commit operations. Bind approval to exact operation parameters and immutable state. | Identify current authenticated-principal and operation authorization records, expiry, replay prevention, recovery and receipt contracts. Confirm atomic verification/commit or a shared immutable snapshot. |
| D06 | **Single execution owner and failover.** Coven/Psyche owners | Begin the MVP with one authoritative host for a Project’s execution. Remote surfaces submit requests to that owner. | Define ownership transfer, fencing generation and stale-result rejection. Demonstrate that interrupted transfer cannot leave two valid committers. Automatic multi-host failover is a later capability unless existing canonical support is verified. |
| D07 | **Offline editing policy.** Host/Project owners; authority owner | Permit local drafts and file edits in the allowed project surface. Treat offline protected intents as unsubmitted drafts until authenticated reconciliation. | Specify conflict preservation, which edits need proposals, and how changed identities, scopes or limits invalidate an earlier draft. Distinguish “saved locally,” “submitted,” “accepted proposal,” and “committed.” |
| D08 | **Retry and unknown outcomes.** Psyche/Coven owners | Reconcile operation/receipt status before resubmitting uncertain effects. Reuse the same request identity only under the canonical deduplication rules. | Define failure classes, retry budget, retention window, how absence is proven, which effects require provider reconciliation, and whether paused missions allow any explicit retry transition. Do not infer policy from the prototype’s local gate logic. |
| D09 | **Cancellation semantics.** Psyche/Runtimes owners | Separate request accepted from terminal cancellation. Fence stale results and preserve evidence of external effects. | Record cancellation behavior per runtime and provider, child-process scope, grace/escalation behavior, and what cannot be undone. Verify the target platforms and packaged runtime rather than relying on source inspection. |
| D10 | **Synchronized artifact policy.** Host/Coven owners; security owner | Allowlist project inputs, immutable outputs and derived exports. Keep live databases, credentials and host execution state outside generic synchronization. | Define path/type/size policy, symlink handling, content commitments, quarantine, deletion/tombstone behavior, retention and restore. Establish who can authorize a destination and transfer. |
| D11 | **Canonical metric mapping.** Psyche owner; UI/Brand consumers | Preserve the current visual vocabulary while mapping each displayed quantity to a verified canonical field or computed projection. | The prototype uses role-owned target progress, wedge shares and resource-limit ratios. Decide whether equivalent production semantics exist. Unsupported metrics should show unknown or be omitted, not be approximated as authoritative progress. |
| D12 | **Pilot scope and publication.** Val; component owners | A one-repository, one-Project, single-authority-host pilot with an explicit bounded operation and rollback/recovery record. | Select the repository, familiar root/revision, runtime, destination, budget, capabilities and human acceptance owner. Published or paid remote execution requires its own concrete acceptance and authorization; a successful Site simulation is not that evidence. |

## Recommended dependency order

Resolve D01–D04 through repository discovery and a read-only adapter first. Those decisions make the nouns and read path concrete without changing authority. Prepare D05–D09 as a single vertical operation: one bounded mission, one attempt, one decision, one terminal receipt, including interrupted submission and cancellation. Then exercise D10 through a small synchronized artifact set, not the entire Host directory. Evaluate D11 with real canonical sample records before committing to visual metric claims. D12 is the pilot acceptance decision once the earlier evidence exists.

Discovery may show that several choices are already implemented and documented. In that case, record the exact contract/revision and adopt it; do not reopen the decision or fork its schema merely because this packet uses different provisional field names.

## Decision packet template

Each decision packet should identify:

1. The user problem, canonical component owner, and exact checked-out revisions.
2. Existing implementation and normative contract evidence, including contrary evidence and unknowns.
3. The smallest proposed change and at least one viable alternative where policy differs.
4. Effects on identity, authority, persistence, compatibility, cancellation/recovery and user-visible state.
5. The test or experiment that distinguishes the alternatives, its actual result, and its limits.
6. The concrete action requiring acceptance, who can accept it, and how the record will remain auditable.

If a decision cannot be completed safely, preserve the work in a draft proposal with the blocked boundary identified. Continue independent read-only or reversible work. Do not relabel an unknown as “supported,” omit a failed check, weaken a gate, or auto-select a policy merely to finish the integration.

## Exit criteria for closing this register

Close a decision only when its owner and outcome are recorded and linked to the canonical implementation or approved design. Close its implementation work only when the relevant tests pass. Close its delivery acceptance only when the packaged or hosted surface has been exercised at the pinned revision. Keep those records separate enough that a later regression can reopen the right part without erasing the original rationale.

