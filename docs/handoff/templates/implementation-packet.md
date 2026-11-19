# Implementation packet — template

## Goal and status

- Packet ID / title:
- User-visible outcome:
- Current status: proposed / in progress / implemented / verified / blocked / ready for review
- Owning component and repository:
- Baseline revision / branch / isolated worktree:
- Scoped instructions and canonical ADR/schema links:
- Related issue/PR and dependencies:

## Scope

Describe the smallest complete vertical slice. Identify the canonical behavior being consumed or changed, the adapter/client code involved, and explicit exclusions. Record whether this packet has read-only, proposal, or mutation behavior.

## Identity and authority path

- Principal/session source:
- Exact familiar root and revision binding:
- Project / mission / task / attempt identities:
- Authorization verifier and immutable inputs:
- Persistence/commit owner and receipt lookup:
- Retry, lease/fencing, cancel, and unknown-outcome handling:
- Offline/stale/degraded behavior:

## Implementation

1. Inspect and record current contracts; replace placeholders with verified symbols.
2. Add the narrow failing evidence where behavior or authority changes.
3. Implement the smallest owned change; preserve unrelated work.
4. Run narrow checks, then required broader/package/runtime gates.
5. Record results and limitations; prepare the reviewable artifact.

## Acceptance and evidence

List concrete scenarios, expected outcomes, exact commands, revisions, artifacts, and remaining uncertainty. Use the [evidence record](evidence-record.md). Do not mark an external action complete from a model response, optimistic UI update, or an unverified transport acknowledgment.

## Review and next decision

- Reviewer/component owner:
- Remaining policy decisions:
- Actions already authorized:
- Actions requiring separate authorization:
- Rollback or safe disable path:
- Next executable task:
