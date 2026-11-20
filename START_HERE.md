# Coven Compass — full implementation handoff

Prepared for Val · 18 November 2026 · package edition 1

This package contains the complete runnable Compass source, its regression fixtures, a readable handoff, and a proposed integration plan for Coven Host, Coven Compass, Coven CLI, Psyche, Psyche Build, and related OpenCoven components.

**The implemented application is a local simulation. The backend integration is a proposal.** This handoff does not establish that a production repository implements a proposed API, folder layout, lease, receipt, or authorization behavior. Verify canonical contracts at current pinned revisions before implementation.

The scalable overview and crown refinement now incorporates adaptive-mobile replay improvements; **combined source-level verification passed**. It adds compact project placement, bounded overview mission detail, project search and sample presets, explicit scope, chrome-safe fit, and canonical crown relief. See [guide 15](docs/handoff/15-scalable-atlas-layout.md); historical browser evidence does not qualify these changes.

## Start in ten minutes

1. Start at the root of your Git checkout. If you received the ZIP, extract it and work from the extracted `Coven_Compass_Handoff_2026-11-19` directory.
2. Read this file, then [current state and evidence](docs/handoff/01-current-state-and-evidence.md).
3. For an extracted delivery, run `python3 scripts/verify-handoff.py .` before making edits. In a Git checkout, use the source checks and verify a rebuilt export as described below.
4. Preview Compass locally. Enter a Project, select a mission, inspect its agents and pending decisions, and try familiar filters and Seal lab. In Projects, use project search and **Try a larger Coven** to explore the 8/16/32/64/128 sample presets; **Remove extra samples** preserves baseline and user-created Projects. Start replay and switch Projects while it plays; on mobile, explore the Map, Missions, Activity, and View dock.
5. Read [architecture and ownership](docs/handoff/02-architecture-and-ownership.md), then take the discovery packet in the [implementation plan](docs/handoff/05-implementation-plan.md).

The handoff HTML is also available at `dist/handoff/guide.html`. Markdown chapters are the editable documentation source. The Site's Handoff entry links to the same package and reader.

## Where to make a change

| Change | Editable source | Focused check |
| --- | --- | --- |
| Project and mission navigation | `dist/mission-navigation.js`, `dist/atlas-ui.js`, and their app bindings in `dist/index.html` | `node --test tests/navigation.test.cjs tests/mission-interactions.test.cjs` |
| Map placement and camera | `dist/atlas-layout.js`, `dist/atlas-viewport.js` | `node --test tests/atlas-layout.test.cjs tests/atlas-viewport.test.cjs` |
| Mobile controls and focus | `dist/mobile-ui.js`, `dist/mobile-interactions.js`, `dist/atlas.css` | `node --test tests/mobile-*.test.cjs` |
| Handoff chapter | Markdown under `docs/handoff/` | Rebuild the guide and ZIP below, then follow the Handoff link in the preview. |

The application in `dist/` is editable browser source. The builder generates `dist/handoff/guide.html` and the downloadable archive. Preserve the baseline under `tests/fixtures/` and dated audits under `tests/evidence/` as historical evidence.

## Run and check

From a Git checkout, run the full verification with `node scripts/verify-all.mjs` (`sh scripts/verify-checkout.sh` is the same command). It runs every check below plus the clean-extraction checks, and exits non-zero if any step fails or is skipped. See [AGENTS.md](AGENTS.md) for editable sources and focused checks.

The package has no npm dependencies and needs no application build. Use Node.js 24 and Python 3.10 or newer; the tested runtimes are Node.js 24.22.1 and Python 3.12.14. Exact results are recorded in [the evidence note](docs/handoff/01-current-state-and-evidence.md). The bundled reference fixture makes the unit tests independent of Git history and network access.

```bash
node scripts/check-source.mjs
node --test tests/*.test.cjs
node scripts/test-atlas-crown.mjs
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8000/` in your browser. Stop the local preview with Ctrl+C. These preview instructions are for the recipient's local development machine; a managed Sites environment should use its documented preview tooling.

**Combined source-level verification passed:** the full suite recorded **207 passing tests with zero failures, cancellations, or skips**; the crown check passed **84 view/size combinations** plus canonical digest/aperture/bounds/stable-node checks; and the static source checker passed. **Combined clean-extraction, archive rebuilding, and verification passed**, including the full suite and crown/source checks in the extracted copy. The earlier layout/crown branch's 182-test and clean-extraction/rebuild pass is a historical pre-merge checkpoint.

The incoming replay/adaptive-mobile branch at `07919b421df5457e778e1b1c6a73512c8f27ba73` recorded 71 Node tests and 57 Chrome audits before this combined layout. It adds a shared live replay timeline that preserves elapsed time and playing/paused state across project focus changes, while imported recordings keep their own extent. Delayed reports do not force replay to the live edge. Its adaptive workspace reuses the original controls; measured header/dock space and the visible viewport support compact, short-landscape, and tablet arrangements.

Read [MOBILE_READINESS.md](MOBILE_READINESS.md) for the distinct incoming 71-test/57-audit record, the older 51-test/72-audit baseline, and native-device limits. Neither record verifies the combined source. Browser QA for this merge is unavailable because of the prior browser URL-policy block. The current evidence note records the combined source and ZIP results, including the exact clean-extraction commands and inventory counts.

The checksum verifier validates the delivered snapshot. After intentionally editing files, changed checksums are expected; run the source/unit checks and rebuild the export. A checksum manifest detects byte changes relative to itself. It is not a cryptographic signature or a proof of trust.

```bash
python3 scripts/build-handoff.py
python3 scripts/verify-handoff.py dist/downloads/Coven_Compass_Handoff_2026-11-19.zip
```

To check the extracted delivery independently, run these commands from the checkout.

```bash
export_check=$(mktemp -d)
python3 -m zipfile -e dist/downloads/Coven_Compass_Handoff_2026-11-19.zip "$export_check"
python3 scripts/verify-handoff.py "$export_check/Coven_Compass_Handoff_2026-11-19"
```

The generated ZIP is excluded from its own contents. It can be recreated from the extracted package. The other files required to run Compass and rebuild the handoff are included.

## What to read for your role

| Role | Reading order | First output |
| --- | --- | --- |
| Product / architecture owner | 01 → 02 → 05 → 11 | Accepted scope, canonical owners, and decisions requiring validation |
| Coven / SDK implementer | 02 → 03 → 09 → 07 | Verified binding map and one read-only end-to-end slice |
| Host / Projects implementer | 02 → 04 → 09 → 07 | Folder classification, authority owner, synchronization/recovery evidence |
| Psyche / Psyche Build implementer | 02 → 03 → 05 → 06 | Canonical mission/attempt mapping and bounded execution packet |
| Compass / Cave / CLI implementer | 01 → 03 → 08 → 15 → 07 | Client projection, scalable layout, explicit scope, and stale/proposal/error behavior |
| Coordinating agent | 06 → 10 → 05 | Pinned inventory, lane ownership, narrow implementation, exact evidence |

## Package map

- `dist/`: complete static application plus the handoff landing page and generated reader.
- `docs/handoff/`: architecture, integration proposal, folder synchronization, implementation plan, execution playbook, acceptance matrix, visual contract, scalable layout/crown guide, security, agent prompts, decisions, and sources.
- `docs/handoff/templates/`: implementation packet, binding inventory, evidence record, and acceptance checklist.
- `examples/`: clearly marked, inert conceptual JSON; these are not canonical wire schemas or runnable permissions.
- `tests/`: source regression coverage for presentation/layout/viewport geometry, navigation, replay timing/rendering/delayed reports, adaptive mobile controls, gestures/overlays, and mission interactions; the pinned v2 reference source; and historical JSON evidence. Run the full command for the combined count. Replay cases are in [clock](tests/replay-clock.test.cjs), [render](tests/replay-render.test.cjs), and [emission](tests/replay-emission.test.cjs) tests.
- `MOBILE_READINESS.md`: separate historical mobile and incoming replay/mobile checkpoints, the combined refinement's evidence boundary, and remaining native-device checks.
- `scripts/`: source and crown checks, repeatable package generation with a fresh export timestamp, and archive/extracted-directory verification.
- `HANDOFF_MANIFEST.json`, `CHECKSUMS.sha256`: export provenance, file inventory, and byte-integrity checks.

Git metadata, credentials, local runtime state, browser profiles, historical QA screenshots, installed dependencies, and previous export archives are intentionally excluded. No license or production authority is created by this package. Preserve the applicable upstream terms and current repository instructions when integrating.

## First implementation recommendation

Deliver **one read-only Project backed by the canonical Coven projection** before enabling operational commands. Map a familiar's exact identity revision, one mission, its task/attempt state, a pending decision, and a resulting receipt into Compass. Show source freshness and disconnection explicitly. Then introduce bounded command proposals through the existing SDK/authorization path and prove refusal/recovery behavior before connecting remote execution.

Keep the simulation available as an explicit demo/fixture mode. A production mode must not silently fall back to sample data, synthetic acknowledgements, or browser-generated success states.

## Publishing and reuse

The manifest identifies the existing private Site. It is provenance and configuration, not a publishing credential. Updating that Site requires authorized source access and its normal publish flow. A separate fork needs its own registered Site identity; never invent an ID or accidentally publish a fork over the original.

No production repositories were modified, no real agent was launched, and no production permissions were granted while preparing this handoff. The [acceptance matrix](docs/handoff/07-validation-and-acceptance.md) defines what evidence is still needed before a real integration can be called ready.
