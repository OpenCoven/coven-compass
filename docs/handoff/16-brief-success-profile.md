# 16 — Brief success profile (proposed)

**Status: proposed consumer profile, awaiting owner decisions.** This chapter is the documentation half of the proposal/fixture slice of [issue #35](https://github.com/OpenCoven/coven-compass/issues/35). It approves no protocol, grants no execution authority, and changes no wire schema. Every row below is *proposed — owner decision*. The decisions it raises are D13–D15 in the [register](11-open-decisions.md), and all three are proposed.

Compass consumes this profile and doesn't own it. The browser model is [`dist/brief-policy.js`](../../dist/brief-policy.js), and its synthetic cases are in [`dist/fixtures/brief-policy-cases.json`](../../dist/fixtures/brief-policy-cases.json). Open a case with `?source=fixture&scenario=brief-rubric-pass` (or any other `brief-…` case), or look at the Brief tab of any simulated mission. Both are labeled proposal and synthetic everywhere they appear.

## Pinned sources

| Source | Revision | What it establishes |
| --- | --- | --- |
| Psyche `Intent` ([intent.rs](https://github.com/OpenCoven/psyche/blob/1e47b40dbbb9db21962b4884afe49763321f04b0/crates/psyche-core/src/contracts/intent.rs)) | psyche@1e47b40 | `requested_outcome`, free-form `constraints`, and `required_evidence: Vec<String>`, bound to `project_id` and a `digest` |
| Psyche `Graph` and `GraphNode` ([graph.rs](https://github.com/OpenCoven/psyche/blob/1e47b40dbbb9db21962b4884afe49763321f04b0/crates/psyche-core/src/contracts/graph.rs)) | psyche@1e47b40 | `Graph.policy_revision` and `GraphState`, which includes `waiting_evidence`, `completed`, `failed`, `cancelled` and `recovery_required`. Node states include `candidate`, `awaiting_verification`, `verified`, `escalation_required`, `adoption_unknown` and `termination_unknown`. Every node also has a `budget_id`. |
| Psyche `Evidence`, `Verdict`, `Budget`, `Approval` and `Recovery` ([foundation.rs](https://github.com/OpenCoven/psyche/blob/1e47b40dbbb9db21962b4884afe49763321f04b0/crates/psyche-core/src/contracts/foundation.rs)) | psyche@1e47b40 | Evidence is bound to `node_id`, `attempt_id`, `content_digest` and `producer`. A Verdict is bound to `sealed_evidence_digest`, `policy_revision`, `reviewer_id` and `outcome`. A Budget is a per-`resource_class` `limit`, `reserved`, `consumed` and `released`. An Approval has a `decision` and an `expires_at`. A Recovery records `ambiguity` and `operator_disposition`. |
| Psyche schema registry ([SCHEMAS.md](https://github.com/OpenCoven/psyche/blob/1e47b40dbbb9db21962b4884afe49763321f04b0/docs/SCHEMAS.md#L64-L71)) | psyche@1e47b40 | The v1 registry is closed and typed records deny unknown fields. Evidence/verdict, budget, approval and recovery *policy* are deferred to named owners. |
| Coven mission command ([missions.rs](https://github.com/OpenCoven/coven/blob/35ce431ad0f9fdce63ea8301940adfe66e32a758/crates/coven-cli/src/automations/missions.rs)) | coven@35ce431a | `mission.submit.v1` commits the definition, occurrence, mission and adoption, then settles failed with `AUTHORITY_UNAVAILABLE_REASON`. M0 launches nothing. |
| Coven Agents authority ADR ([adr-001](https://github.com/OpenCoven/coven-agents/blob/3a4ab518da2327ac0d4eefbf6406162ba912e7cc/docs/architecture/adr-001-product-authority-boundary.md)) | coven-agents@3a4ab518 | The runner returns execution evidence, not orchestration verdicts. Durable intent and orchestration belong to Psyche. |

## Mapping: Brief inputs to canonical references

Compass would store opaque references and digests only, never writable copies of canonical records (ADR-001 rule 1). **Gap** marks a term that has no home in the closed v1 schemas at psyche@1e47b40. Compass doesn't fill those gaps with new fields or with free-form `constraints` keys. They go to the owners as D14 and D15.

| Brief input | Proposed canonical reference | Status |
| --- | --- | --- |
| What the mission should deliver | `Intent.requested_outcome` | proposed — owner decision |
| Required conditions (pass/fail/unknown) | One named entry each in `Intent.required_evidence` and `GraphNode.required_evidence`. Whether each condition passed comes from a `Verdict`, not from the Brief. | proposed — owner decision |
| Policy revision | `Graph.policy_revision`, an opaque string issued by the policy owner (D13). The browser's simulated revision is labeled `sim-…` and is not a Psyche revision. | proposed — owner decision |
| Evidence for a condition or criterion | `Evidence.evidence_id`, `content_digest`, `attempt_id` and `producer` | proposed — owner decision |
| Grade of a condition | `Verdict.outcome` and `reason_codes`, bound to `sealed_evidence_digest` and `policy_revision` | proposed — owner decision |
| Candidate digest | **Gap (D15).** A Verdict names sealed evidence, not a candidate artifact digest. The proposal is that the sealed evidence set includes the candidate's `ResultBundle` content digest, but the owner decides. | proposed — owner decision |
| Rubric: anchored criteria, weights, floors, minimum score and aggregation rule | **Gap (D14).** `Verdict` has no score field, and `Intent.constraints` must not become a policy dialect. Until the owner names a home, the rubric exists only in the labeled proposal model. | proposed — owner decision |
| Cumulative cost and time limits | `Budget` per `resource_class` (`limit` and `consumed`) | proposed — owner decision |
| Maximum attempts | **Gap (D14).** No attempt-count field exists. Each `Attempt` (`att_`) is a record, so a count could be derived, but the cap needs an owner. | proposed — owner decision |
| Deadline | **Gap (D14).** `Approval.expires_at` bounds an approval, not a mission. | proposed — owner decision |
| Stop or escalate when limits run out | `GraphNode` state `escalation_required` | proposed — owner decision |
| Authorization of another attempt or of acceptance | `Approval.decision` and `expires_at`. Denied, expired, revoked or uncertain needs resolution and is never retried automatically. | proposed — owner decision |
| Unresolved prior effects | `Recovery.ambiguity`, `operator_disposition`, and the node states `adoption_unknown` and `termination_unknown` | proposed — owner decision |
| Execution terminal state | `Graph.state` and Coven's occurrence settlement. Today that is `failed` with `AUTHORITY_UNAVAILABLE_REASON`. | proposed — owner decision |
| Accepted mission completion | An authoritative Coven transition and its receipt. None exists, and Compass never produces one. | proposed — owner decision |
| Outcome targets ([#37](https://github.com/OpenCoven/coven-compass/issues/37)) | Not mapped in this slice. A configured target stays unknown, so the mission is not eligible. | proposed — owner decision |

## Who does what (for owner review)

These are suggestions for D13. Nothing here assigns a role or claims a repository path.

| Act | Suggested owner | Status |
| --- | --- | --- |
| Issues a policy revision | The Psyche policy owner ([Psyche #12](https://github.com/OpenCoven/psyche/issues/12)) | proposed — owner decision |
| Evaluates evidence against a policy | An evaluator named by that policy, whose identity is recorded as `Verdict.reviewer_id`. A runner such as Coven Agents produces evidence but doesn't grade it (ADR-001 rule 5). | proposed — owner decision |
| Authorizes another attempt | The Coven authority owner, through its command/adoption boundary. In M0 that boundary refuses to launch. | proposed — owner decision |
| Commits each terminal transition (completed, failed, cancelled, accepted) | The Coven authority owner, for the occurrence and mission, and the Psyche owner, for the graph | proposed — owner decision |
| Displays all of the above | Compass, read-only | proposed — owner decision |

## Eligibility rules the model demonstrates

The model applies these rules to synthetic input only. Each one has a test in `tests/brief-policy.test.cjs`.

1. **Unknown never counts as met.** A condition with no current, evidence-backed evaluation is unknown. The next action then waits for evidence.
2. **A score can't hide a failure.** A failed required condition or a criterion below its floor fails the mission, whatever the weighted score.
3. **Grades bind to one candidate.** An evaluation counts only for the exact candidate digest, attempt and policy revision it names. Candidate B can't reuse candidate A's grade.
4. **Revisions invalidate, they don't erase.** Changing the rubric or limits produces a new policy revision. Older evaluations are kept, with their provenance, and shown as stale.
5. **Limits are cumulative.** Attempt count, cost and time are summed over every recorded attempt, and a retry never resets them. With no attempt limit set, no revision can be requested.
6. **Ambiguity blocks retries.** An attempt with unresolved external effects stops iteration until it is resolved.
7. **Authorization is resolved, not retried.** Denied, expired, revoked or uncertain authorization stops and escalates.
8. **No gate is never met.** A policy with no required condition, rubric or target stops and escalates (`no-gates`) instead of being eligible by default.
9. **Grading is not acceptance.** The strongest result the model can return is *eligible*, with the next action *request authorized acceptance*. Acceptance is always reported as not recorded.

The next permitted action is one of: `wait-for-evidence`, `request-bounded-revision`, `request-authorized-acceptance` or `stop-escalate`. None of these is a command. Compass has no transport for any of them (D03).

## What stays separate in the UI

The mission inspector keeps four states apart, in this order:

1. **Proposal:** the policy revision the Brief would use. In the simulation it's derived from the Brief and labeled `sim-…`.
2. **Execution:** the terminal state of the latest attempt, or *no attempt records* in the simulation.
3. **Quality qualification:** whether the required conditions and the rubric are met, not met, or unknown.
4. **Accepted completion:** always *not recorded*. Only an authorized Coven transition can record it.

In the simulation, the Brief's progress counters are sample data, not sealed evidence. That's why every condition shows as unknown even when its counter reads above the floor.

## Success criteria in New mission and Edit brief

The editor (`dist/brief-policy-editor.js`, ported from #42) sets the Brief's optional success criteria, `brief.success`. `fromBrief` merges them into the policy the Brief already implies, and they only add gates. The Brief's deliverables and floors stay required. The editor adds:

| Editor control | Policy field |
| --- | --- |
| Independent review passes, Artifact checks pass | required conditions `success:review`, `success:checks` |
| Additional required evidence (up to 12 lines of up to 160 characters) | one required condition each, `custom:<digest>` |
| Optional quality rubric: minimum weighted score and, for Accuracy and Clarity, weight and floor | `rubric` on a 0–100 scale, `weighted-mean/1`, anchors at 0, 50 and 100 |
| Total attempts | `limits.maxAttempts` (required, 1–100) |
| Deadline (UTC, optional) | `limits.deadline` (`YYYY-MM-DDTHH:MMZ`) |
| Require verified examples | one entry in `targets`. It's inert (#37) and stays unknown. |

As in #42, every condition the editor adds can be revised within the attempt limit. Cost and time across attempts stay the Brief's own *at most* ceilings, so the editor doesn't duplicate them. Changed criteria derive a new `sim-…` revision. Criteria that don't validate block Save, Open mission and Save as template, and the editor lists each error. A trace with malformed criteria derives no policy, so the inspector fails closed (`invalid-policy`). The preview is the existing *When is it done?* summary.

#42 also had other parts, which were left out on purpose. Its inspector buttons for candidate A/B and "reveal evidence", and its *Simulate cancelled / denied / expired / revoked / uncertain* holds, graded attempts inside the live simulation. So did the `brief.fixture` and `brief.hold` events behind them. Those parts contradict the rule that the simulation records no attempts. The synthetic `?source=fixture&scenario=brief-*` cases cover the same outcomes.

## Reload and replay

Creating or editing a success policy saves its local Project trace in this tab’s session storage. Reloading the tab restores its mission history and original event times. A storage warning identifies an unavailable checkpoint. Imported recordings retain their existing read-only workflow. Use History to revisit the opening event and compare its policy revision with an edited Brief.

The labeled fixtures retain each evaluation’s own policy revision, candidate digest, attempt, evaluator and evidence digests. The local simulation records no protected acceptance receipt.

Serve the checkout and copy `scripts/browser-qa.mjs` beside the external Playwright installation. Run `node browser-qa.mjs <url> <shots-directory> <report.json> <tested-sha> --brief-only`. Run it again with separate output paths and `--webkit`. Each engine exercises desktop, narrow portrait and short landscape, including field validation, focus return, historic policy replay and evidence provenance.

## Not in this slice

- No owner has reviewed the mapping, so the first acceptance box of #35 stays open.
- There are no live receipts. A source fixture can't close live acceptance.
- No scheduler, executor, accounting store, identity root or transport has been added.
- The simulation records no attempts or evaluations, so a Brief's success criteria can be set and previewed but never become eligible there.
