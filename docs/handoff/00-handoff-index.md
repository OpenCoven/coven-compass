# Handoff index

**Status:** complete source handoff with proposed integration work. Start with [START_HERE](../../START_HERE.md). The implementation plan is not an assertion of production implementation.

The scalable layout/crown refinement is **implemented; combined source-level verification passed**; start its presentation handoff with [guide 15](15-scalable-atlas-layout.md). It supersedes earlier positioning and zoom-driven scope assumptions while preserving the semantic visual vocabulary. Headless Chromium QA of the current source ran on 2026-11-19 ([record](../../tests/evidence/browser-qa-2026-11-19.json), summarized in chapter 01); it does not establish Safari, physical-device, real multi-touch, keyboard-only, or screen-reader acceptance.

For the **historical pre-layout** Node and Chrome mobile pass, read [Mobile readiness](../../MOBILE_READINESS.md). Those results and the older v3 baseline do not verify the current refinement. Its exact source/package outcomes belong in chapter 01.

| Chapter | Purpose |
| --- | --- |
| [01 — Current state and evidence](01-current-state-and-evidence.md) | Exactly what the Site implements, what was checked, and what remains unknown |
| [02 — Architecture and ownership](02-architecture-and-ownership.md) | Boundaries between Host, Projects, Castles, Coven, Psyche, clients, identity, and authorization |
| [03 — Integration proposal](03-integration-proposal.md) | Read models, event reconciliation, commands, receipts, identity binding, and adapter seams |
| [04 — Host folder sync and recovery](04-host-folder-sync-and-recovery.md) | Portable files, excluded authority/runtime data, conflicts, disconnection, and recovery |
| [05 — Implementation plan](05-implementation-plan.md) | Phases, work packets, dependencies, acceptance gates, and delivery order |
| [06 — Execution playbook](06-execution-playbook.md) | How humans and agents coordinate implementation and evidence |
| [07 — Validation and acceptance](07-validation-and-acceptance.md) | Unit, daemon, packaged, remote, security, and human acceptance scenarios |
| [08 — Visual and interaction contract](08-visual-and-interaction-contract.md) | Shape, color, topology, accessibility, state, and progressive detail |
| [09 — Security and authority](09-security-and-authority.md) | Threats, request boundaries, retry/fencing, protected operations, and synchronization rules |
| [10 — Agent task prompts](10-agent-task-prompts.md) | Ready-to-use prompts for discovery and scoped implementation |
| [11 — Open decisions](11-open-decisions.md) | Proposed defaults, owners, risks, and validation needed |
| [12 — Source ledger](12-source-ledger.md) | Provenance and limits for each source class |
| [15 — Scalable Atlas layout and crown](15-scalable-atlas-layout.md) | Uniform Projects, compact placement, bounded mission detail, density/search/sample controls, explicit scope, measured fit, and canonical flat crown |

## Working templates

- [Implementation packet](templates/implementation-packet.md)
- [Canonical binding inventory](templates/canonical-binding-inventory.csv)
- [Evidence record](templates/evidence-record.md)
- [Acceptance checklist](templates/acceptance-checklist.md)
- [Conceptual examples](../../examples/README.md)

The sequence is deliberate: establish owners and current contracts; connect a read-only slice; add authenticated proposal/commit behavior; prove bounded execution and recovery; then extend the same contracts across clients and hosts. Avoid building independent stores or competing orchestration loops while implementing the visual map.
