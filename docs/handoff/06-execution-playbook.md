# Execution playbook

## Establish a reproducible starting point

The historical design/prototype reference is v3 revision `d7b6f1e655140036cca49f31687131352162de13`. The handoff adds documentation, portable validation, packaging, later mobile/navigation work, and the [scalable layout/crown refinement](15-scalable-atlas-layout.md). The latter is implemented and source-level verified. Consult the source ledger and final export provenance; do not describe the entire export as byte-identical to v3.

From the extracted bundle root, inspect `README.md`, the source ledger, `docs/handoff/source-context/user-architecture-instructions.md`, and the package manifest before running anything. The Site needs no npm installation or bundler. Record the actual runtime versions and run these source/package checks:

```sh
node --version
python3 --version
node scripts/check-source.mjs
node --test tests/*.test.cjs
node scripts/test-atlas-crown.mjs
python3 scripts/verify-handoff.py .
```

Record the actual current test count and outcomes. The suite uses extracted functions and shared modules with DOM facades and numeric inputs; it has no browser layout engine or native-device emulation. The separate crown check preserves the canonical path and aperture. The export includes the presentation comparison baseline with provenance so these tests can run outside Git. Confirm that behavior in a clean extraction; an earlier Git-backed run alone is insufficient evidence for portable packaging.

For archive inspection or rebuilding, discover the supported arguments before use:

```sh
python3 scripts/build-handoff.py --help
python3 scripts/verify-handoff.py --help
```

The standard output is `dist/downloads/Coven_Compass_Handoff_2026-11-19.zip`. Verify a generated ZIP by passing its path to the verifier. Keep generated archives, `.git`, environment files, credentials, and runtime data outside archive contents. A successful source check is neither a security audit nor a production build result.

For a recipient’s local preview, where local browser access is permitted:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open the local server in that environment and stop it when finished. Do not expose it publicly or bypass a browser/network policy to obtain a preview. Native browser navigation for the v3 revision was policy-blocked; the separate recorded static overview preview proves only what appears in that image.

The historical pre-layout Chrome interaction/mobile pass and its Node test result are recorded in [MOBILE_READINESS.md](../../MOBILE_READINESS.md). Those fingerprints do not verify the current scalable layout, crown, viewport, density, or sample controls. Current browser QA is unavailable because of the prior browser URL-policy block. Keep these evidence periods separate and record permitted future browser acceptance against the exact source tested. Historical JSON audits remain in the export; repository-only browser screenshots do not.

## Discover real repositories before proposing commands

In each available candidate checkout, start read-only:

```sh
git status --short --branch
git rev-parse HEAD
rg --files -g AGENTS.md -g 'README*' -g '*schema*' -g '*receipt*' -g '*lease*' -g '*identity*' -g '*auth*' -g '*sync*' -g '*test*' -g '*lock*' -g '*.yml' -g '*.yaml'
rg -n 'proposal|authorization|receipt|lease|fenc|revocation|reconcile|idempot|cursor' .
```

Use scoped searches after locating the owner directories. Inspect instructions, ADRs, schemas, tests, CI, and release evidence. Preserve unrelated changes; use a permitted isolated branch/worktree when appropriate. Record unsupported or unavailable capabilities explicitly. These are discovery commands, not evidence that any particular Coven subcommand, endpoint, schema, or release pipeline exists.

For each contract, record its owning repository, pinned revision, authoritative definition, consumers, test entry point, and compatibility constraints. Find the canonical command through repository documentation and the real program’s supported help interface before adding CLI examples. Never translate the prototype’s local event names into supposed public APIs without this evidence.

## Work lanes and integration order

| Lane | Work packets | Safe parallel work | Integration prerequisite |
| --- | --- | --- | --- |
| A: contracts and ownership | W01–W02 | Repository inventory, source ledger, identity/data-flow mapping | Reviewed owner and contract map |
| B: projection and UI | W03–W04, W06 | Read adapters, sealed fixtures, visual components | Canonical read contracts; decisions wait for W05 |
| C: authority | W05 | Server enforcement, negative tests, receipt semantics | Authenticated principal and exact identity contracts |
| D: execution | W07–W08 | Runtime capability discovery and bounded fixtures | W05 before any protected effect |
| E: Host recovery | W09–W10 | Trust model and fault harness discovery | Bounded local execution and canonical persistence |
| F: client parity | W11–W12 | Existing client inventory, presentation adapters | Stable command/outcome contracts |
| G: packaging and pilot | W13–W14 | Export manifests, validation scripts, acceptance planning | Required authority, recovery, and packaged-client evidence |

The integration lead owns sequencing, not a new control plane. Assign file ownership before simultaneous edits. Contracts and shared fixtures should land before dependent clients; do not let several lanes redefine the same operation schema. Keep contract changes reviewable separately from presentation changes when practical.

Integrate one canonical read path first. Then add one proposal-to-receipt path, one bounded execution path, and its cancellation/recovery cases. Extend that proven path to Host, Build, CLI, and Cave. A branch can be ready for review while deployment remains blocked by missing authorization or evidence.

## Packet execution loop

1. Read the packet’s dependencies and current source, then pin the exact revisions actually used. Compare them with the handoff reference; explain any intentional drift.
2. State the invariant, authoritative owner, allowed scope, and evidence required. For an authority defect, reproduce the failing boundary before patching it.
3. Make the smallest coherent change in the existing owner. Keep the Site simulation separate from production fixtures and services.
4. Run the narrowest meaningful test first. Expand only for a concrete integration risk or required gate; use real-daemon, remote, or packaged-client tests when a source-only test cannot prove the invariant.
5. Inspect the diff and artifacts for unrelated changes, leaked runtime data, misleading state labels, and missing provenance. Record exact results.
6. Commit/review according to existing authorization and repository policy. Update the packet ledger, hand off dependencies, and continue to the next unblocked packet.

Do not turn transient network failure into permission to resubmit a protected operation. Use a canonical status query or reconciliation path keyed to the original operation; otherwise report uncertainty and preserve the pending/unknown state. Rejected, revoked, or expired authority requires the canonically defined resolution, not repeated attempts.

## Evidence and resumable checkpoints

Every packet should leave this record, including incomplete work:

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

Persist the record beside the repository’s normal issue/PR evidence. Include a precise next step and working-tree status so another agent can resume without repeating discovery or interpreting a proposal as an approval. Redact credentials; retain nonsensitive correlation identifiers necessary to inspect outcomes.

Stop only for material access, ownership, policy, or authority ambiguity that prevents safe progress. Continue independent read-only work and reversible authorized implementation. Explain the exact blocking rule and evidence required to resolve it; do not ask broad approval questions when the current session already authorizes the work.
