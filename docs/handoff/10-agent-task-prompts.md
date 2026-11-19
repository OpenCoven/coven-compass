# Agent task prompts

These prompts are intended for sustained, evidence-driven work in the actual repositories. Each assignment is self-contained after the handoff is available. Use one owner per shared file or contract; parallelize independent discovery and tests. Production API and CLI names must come from pinned canonical source, not this prototype.

The v3 references below identify a historical baseline. Pin the actual delivered source separately using its manifest/revision. The [scalable layout/crown refinement](15-scalable-atlas-layout.md) is combined with replay/adaptive-mobile changes: the final source suite passed 207 tests with zero failures, cancellations, or skips; crown and static source checks also passed. Combined clean-extraction, rebuilding, and package verification also passed, with exact results in chapter 01. The 182-test layout checkpoint, incoming 71-test/57-audit checkpoint, and older 51-test/72-audit baseline are historical. None supplies current browser acceptance; browser QA for the combined source is unavailable because of the prior URL-policy block.

## Required completion record

Every prompt below requires this exact record, even when partially blocked. Preserve it at checkpoints so another agent can resume.

```text
Packet / owner:
Prototype reference: d7b6f1e655140036cca49f31687131352162de13
Implementation repositories and exact revisions:
Status: implemented | verified | proposed | blocked | unknown
Invariant and canonical owner:
Changed files / public contract changes:
Commands, environment, exit codes, and results:
Evidence level: static | unit | browser | daemon | packaged CLI | remote Host
Operation / receipt / event-cursor references, when applicable:
Skipped checks and why:
Unresolved risks / next dependent packet:
Authorization needed for any external action:
```

## 1. Integration lead and canonical contract discovery

```text
Own W01–W02 and coordinate dependent packets from this handoff. Pin the prototype reference to d7b6f1e655140036cca49f31687131352162de13; separately record every actual repository revision and export change. Read README.md, docs/handoff/source-context/user-architecture-instructions.md, the source ledger, and documents 05–07 and 10. Inspect current AGENTS.md, ADRs, schemas, tests, CI, releases, and dirty-worktree constraints before edits.

Discover the actual owners and interfaces for Coven Host, Castles, CLI/Coven Code, Psyche, Psyche Build, Cave, Threads, Familiar Contract, Runtimes, and SDK. Map identity, project, mission, task/attempt, lease/fence, proposal, decision, receipt, cursor, cancellation, and recovery. Unknown API names remain TBD. Do not create duplicate authority, identity, storage, or orchestration systems.

Deliver a source-backed owner/contract map and issue-sized dependencies. Start independent read-only work immediately; unblock lanes against reviewed pinned contracts. Continue through authorized reversible implementation and evidence collection. Never auto-retry a rejected, expired, or uncertain permission operation. Stop only for material policy/access/authority ambiguity, identifying the exact blocker; preserve progress and continue independent work. Do not deploy, publish, or send communications without session authorization. Use the exact completion record in document 10 at each handoff.
```

## 2. Canonical read projection and Castles/Cave UI

```text
Own W03–W04 and the client portion of W06. Historical prototype reference: d7b6f1e655140036cca49f31687131352162de13. Read README.md, docs/handoff/source-context/user-architecture-instructions.md, documents 05–08, 10, and 15, and the pinned contract map. Inspect repository instructions and current code first. Record actual delivered/implementation revisions; preserve unrelated work.

Implement the smallest canonical read adapter and bind the existing visual grammar to it. Study dist/index.html, atlasSnapshot(), sealOf(), buildSeal(), drawSeal(), the layout/viewport/crown helpers, mobile-ui.js, and presentation/integration tests as prototype evidence. Uniform boundaries mean projects; seals mean missions; familiar glyph/hue means identity; selected-mission dots mean agents. Shared corridors mean coordination, not task dependencies or authority. Preserve explicit scope, measured auto-fit policy, bounded density, and the complete searchable mission collection outside the eight-seal cap. Adaptive chrome must reuse existing controls, measure the current nested HUD, exclude hidden/modal-only chrome from canvas fit, and guard queued refits while the keyboard is open. Replay selection cleanup restores the prior camera and auto-fit policy; it must not reset the shared replay clock. Preserve exact quantitative detail alongside angle and pip limits. Expose stale, disconnected, reconciling, and unavailable data separately from mission state.

Do not make the local reducer, localStorage, trace format, or sample resolve() authoritative. Pending proposals must remain visibly pending. Use only discovered supported APIs. Run narrow projection tests, the current node --test tests/*.test.cjs suite, and node scripts/test-atlas-crown.mjs; record actual counts and limits. Run browser/accessibility checks only in a permitted available environment. Consult MOBILE_READINESS.md for historical pre-layout Chrome evidence, not current acceptance, and preserve the historical seven-test reference. Continue reversible authorized work; never retry permission operations automatically. Stop only for material policy/access ambiguity. Return the exact document-10 completion record with unrun checks and next dependencies.
```

## 3. Protected proposals, decisions, and bounded execution

```text
Own W05 and coordinate W07–W08 with Coven, Threads, Psyche, and Runtimes owners. Prototype reference: d7b6f1e655140036cca49f31687131352162de13. Read docs/handoff/source-context/user-architecture-instructions.md, the source ledger, documents 05–07 and 10, and discovered canonical contracts. Pin actual code revisions and inspect current tests before changing behavior.

Implement one supported proposal-to-receipt path and one bounded single-Castle execution path in existing authoritative components. Bind the authenticated principal, operation, scope, exact familiar root/revision, and session. Verify authorization atomically with commit or against the same immutable snapshot. Treat all UI/model/task fields as untrusted. Keep pending decisions separate from committed effects.

For authority bugs, capture red-to-green tests at the enforcing boundary. Cover substituted identity, revocation races, stale state, replay, lease fencing, limits, cancellation, and lost acknowledgements. Use a real daemon/runtime where source-only tests cannot prove effects. Never auto-retry rejected/expired authority or resubmit an uncertain protected operation; reconcile its original identity. Do not add duplicate approval, scheduler, or persistence authority. Continue until authorized packet acceptance is met; stop only for material policy/access ambiguity. Return the exact document-10 evidence record, receipts, skipped checks, and remaining risks.
```

## 4. Coven Host synchronization and recovery

```text
Own W09–W10 after bounded local execution is established. Prototype reference: d7b6f1e655140036cca49f31687131352162de13. Read the user architecture instructions, source ledger, documents 05–07 and 10, repository instructions, and pinned Host/Coven/Psyche contracts. Discover actual Host capabilities; do not assume enrollment, synchronization, or recovery APIs already exist.

Trace trust, credentials, capabilities, persistence, event cursors, leases, and receipts across the real remote surface. Preserve Coven authority and Familiar Contract identity; Host placement cannot create a second identity root or permission plane. Implement only the smallest owned change needed for one authenticated bounded workload.

Build deterministic failure cases for dropped acknowledgements, event gaps, reordered/duplicate events, stale workers, concurrent sync conflicts, and restart boundaries. Require durable canonical reconciliation and effect counts. Unknown outcomes remain explicit. Never resolve transport uncertainty by repeating a protected effect or permission request. Record real remote evidence separately from mocks and local fixtures. Respect existing deployment authorization; do not provision or publish by implication. Continue independent safe work around blockers; stop only for material access/policy/authority ambiguity. Return the exact document-10 completion record and a reproducible recovery trace.
```

## 5. Psyche Build, CLI, and Cave parity

```text
Own W11–W12. Prototype reference: d7b6f1e655140036cca49f31687131352162de13. Read README.md, the user architecture instructions, documents 05–07 and 10, and the reviewed contract map. Inspect actual client repositories, package entry points, tests, CI, and supported help before documenting commands. Pin each revision and preserve unrelated changes.

Make Build, the real CLI/Coven Code surface, Cave, and Castles consume the same mission/attempt/proposal/decision/receipt identities through canonical bindings. Preserve each client's useful presentation without a second scheduler or approval store. Pending, rejected, stale, disconnected, and unknown outcomes must remain honest across clients. Noninteractive flows must fail closed without required authority.

Run a shared operation scenario and compare authoritative outcomes across clients. Test the installed CLI/package, including configuration, authentication, machine-readable results, and exit behavior; importing source modules is insufficient. Add red-to-green tests for any boundary defect in its actual enforcing owner. Never auto-retry denied or uncertain permission operations. Continue authorized reversible work through acceptance, stopping only for material policy/access ambiguity. Return the exact document-10 evidence record, actual commands, package identities, and unresolved parity gaps.
```

## 6. Packaging, independent validation, and pilot readiness

```text
Own W13–W14 readiness; execution/deployment requires the principal's explicit scope authorization. Prototype reference: d7b6f1e655140036cca49f31687131352162de13. Read README.md, source ledger, docs/handoff/source-context/user-architecture-instructions.md, and documents 05–07 and 10. Distinguish v3 source from export tooling and later implementation revisions.

Run node scripts/check-source.mjs, node --test tests/*.test.cjs, node scripts/test-atlas-crown.mjs, and python3 scripts/verify-handoff.py . from the extracted bundle. Record actual current test counts. Inspect script --help before rebuilding. Verify the portable historical baseline, archive provenance, and exclusion of secrets, runtime data, .git, previous archives, and historical browser screenshots. Preserve historical JSON audits/fingerprints as historical evidence. These commands validate the buildless handoff, not a production daemon or packaged CLI.

Audit evidence against every applicable row of document 07 and the presentation acceptance cases in document 15. Require real daemon, packaged-client, and remote Host results for corresponding claims. The historical seven Node fixtures and v3 static overview image do not prove browser interaction or production acceptance. MOBILE_READINESS.md records a historical pre-layout 51-test and Chrome pass; it does not accept the current refinement. Current browser QA remains unavailable because of the prior policy block. Prepare a bounded pilot with named scope, limits, runtime capabilities, recovery ownership, and success criteria; leave unsupported claims explicit. Never auto-retry permission operations or bypass failed gates. Continue authorized reversible validation; stop only for material policy/access ambiguity. Return the exact document-10 completion record and a clear ready/blocked judgment with evidence, without publishing by implication.
```
