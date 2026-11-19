# Acceptance checklist — template

Use for a real implementation candidate. Check a box only when evidence for the current source/package revision exists.

## Contract and ownership

- [ ] Current repository revisions and scoped instructions recorded.
- [ ] Existing canonical schemas/SDK symbols mapped; no competing authority store introduced.
- [ ] Exact principal and familiar root/revision bindings verified.
- [ ] Read-only, proposal, and committed mutation paths are distinguishable.

## Projection and UI

- [ ] Complete, partial, stale, disconnected, degraded, reconciling, and unavailable data tested.
- [ ] Event gaps, duplicates, reconnect, and snapshot replacement reconcile correctly.
- [ ] Shape/color/location meanings and exact-count details preserved.
- [ ] Keyboard, touch, screen-reader, contrast, text scaling, and reduced-motion checks recorded.

## Authority and execution

- [ ] Operation-specific authorization and commit share the correct immutable inputs.
- [ ] Revoked, expired, mismatched, replayed, and stale requests fail as specified.
- [ ] Idempotency and lost-ack reconciliation prove bounded effects.
- [ ] Lease/fencing, crash recovery, cancellation, resource limits, and runtime refusal exercised against the real owner.
- [ ] Pending proposals and unknown outcomes never display as committed.

## Host and portability

- [ ] Portable files are classified and live databases/secrets/runtime state excluded from generic sync.
- [ ] Conflicts, interrupted sync, changed authority owner, and disconnected execution tested.
- [ ] A clean extracted artifact runs and its verification commands work without Git history.
- [ ] Packaged CLI/native clients and remote-host evidence are recorded separately.

## Delivery

- [ ] Exact source and package receipts are attached.
- [ ] Failures, skips, remaining decisions, and safe-disable behavior are explicit.
- [ ] Required human/product acceptance recorded.
- [ ] Release/publication/merge authorization and normal gates satisfied for the actual destination.
