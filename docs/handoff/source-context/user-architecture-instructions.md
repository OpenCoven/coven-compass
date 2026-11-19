# Owner-supplied architecture constraints

Source: Val's instructions supplied in this conversation on 18 November 2026. These are design and engineering requirements for this handoff, not independently verified claims about current repository implementation. Personal profile information and unrelated instructions are excluded.

## Canonical ownership

- Familiar Contract: governed portable familiar identity.
- SPAR: continuity profile/query plane explaining continuity across revisions, runtimes, sessions, devices, models, memories, and embodiments. It is not a second identity root or competing database.
- Coven Threads: protected-surface authorization and proposal-versus-commit decisions.
- Psyche: orchestration semantics, including tasks, lanes, leases, approvals, receipts, retries, and recovery.
- Coven: daemon authority, persistence, sessions, runtime execution, and authoritative state transitions.
- Coven Runtimes: runtime capability descriptors and conformance.
- SDK: constrained public clients and canonical bindings.
- Coven Memory: read-only memory client/projection, never a second memory authority.
- Cave: primary human oversight product and production UI behavior.
- Psyche Build: multi-lane coding cockpit consuming Psyche canonically.
- Coven Code: terminal coding execution.
- Coven GitHub: GitHub-triggered familiar delivery.
- Brand: canonical visual identity and voice.
- UI: specimen/component laboratory, not production authority.

## Core laws

- Identity precedes work. Identity, intent, authority, orchestration, and execution remain separate.
- No UI, prompt, model response, task text, or caller-supplied field may grant itself protected authority.
- Authoritative objects gate writes; derived views provide legibility. Clients are untrusted for enforcement.
- Familiar sessions bind to an exact authorized familiar root and revision.
- Protected changes require authenticated principal authority, operation-specific authorization, replay protection, revocation/recovery semantics, and auditable receipts.
- Final authorization verification and commit must be atomic or use the same immutable snapshot.
- Pending proposals must never appear as committed state.
- Stale, degraded, reconciling, disconnected, rejected, and unavailable are explicit states.
- Prefer Permit / Degrade to Proposal / Reject.
- Fail closed at identity, authorization, persistence, release, and publication boundaries.
- Structural conformance alone does not establish security, privacy, safety, personhood, or legal ownership.
- Familiars are AI systems. Product language may be evocative; normative claims remain technically honest.
- Cloud infrastructure is an execution surface, not the fundamental home of identity.
- Before introducing a repository, service, schema, database, control plane, or abstraction, check whether an existing canonical component owns the responsibility.
- Prefer fewer coherent systems over overlapping ones.

## Engineering and decision rules

Inspect current repository state, relevant scoped instructions, README/ADRs/schemas/tests/CI, issue and PR context, and branch/worktree constraints first. Preserve unrelated work and respect archived, read-only, reference-only, or intentionally dirty worktrees. Trace authority and data flow before changing behavior; fix the invariant with the smallest safe patch.

Do not weaken security, ownership, release, conformance, or evidence gates to make tests pass. Add red-to-green evidence for bugs and authority boundaries. Run the narrowest relevant tests before broader gates, and use real-daemon or packaged-artifact checks when source-only tests can conceal failure. Report exact commands, revisions, results, skipped checks, remaining uncertainty, and risks.

Current explicit owner instructions and current implementation evidence outrank older planning notes. Distinguish implemented, verified, specified, approved design, proposed, experimental, deprecated, and unknown/unverified. Obtain the authorization required for consequential actions; creating this handoff does not authorize production deployment, credential changes, merging, or external communications in another repository.
