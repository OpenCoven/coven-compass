# Discovery D01–D04: what canonically backs a Project

**Status: discovery delivered. Every recommendation is proposed and awaiting its owner. None of it is an owner decision.** Tracking: issue #2. The decision register is [chapter 11](../../handoff/11-open-decisions.md).

This folder is a byte-for-byte import of Sage's read-only research deliverable, so other agents can read it without access to a familiar's local workspace. **Don't edit these files.** Corrections or newer discovery go in a new dated folder next to this one, and the digests below must keep matching.

| File | What it is | SHA-256 |
| --- | --- | --- |
| [findings.md](findings.md) | Q1–Q9 with evidence, contrary evidence, unknowns, and **proposed** D01–D04 | `aae5f276184075a71996e6f342512a3dd423b6f8d62f495275f931439ff2737b` |
| [gaps.md](gaps.md) | G1–G16: what doesn't exist at the pinned revisions, and who would own it according to existing code and docs | `95dc9772a837a2e650dffe94807bebdba11815ad0292f42c1ff19a479f4ddca2` |
| [binding-inventory.csv](binding-inventory.csv) | The handoff's [binding-inventory template](../../handoff/templates/canonical-binding-inventory.csv), filled in, with 2 rows and a `notes` column added | `2e3518b636b5edc7036658a1d89cf785c3632b957c1de88aeee11c1115b71096` |
| [NOVA-SAGE-COMPASS-20261119-D01D04.txt](NOVA-SAGE-COMPASS-20261119-D01D04.txt) | Receipt marker | `8b83d87872b82aaff387bbbc38a59615709ad054c3437560e6a83af564742253` |

To verify, run `shasum -a 256 -c SHA256SUMS` from this folder.

## Provenance

- **Author:** Sage (research lane), routed by Nova. Receipt `NOVA-SAGE-COMPASS-20261119-D01D04`, dated 2026-11-19.
- **Imported from:** `~/.coven/workspaces/familiars/sage/deliverables/coven-compass-discovery/` (the receipt from its `.receipts/` subfolder). The three deliverable digests match the prefixes Sage posted on issue #2.
- **Pins** (every citation is from the committed revision, never a working tree): coven `35ce431a` · coven-agents `7052dc3` · sdk `6e816c5` · coven-threads `33baee4` · psyche-build `8b97cf6` · coven-cave `57b44a3a8` · coven-castles `9310183` · coven-host `d2e5348` · coven-memory `eb542a5` · familiar-contract `93f486cf` · coven-compass `792187e` (read) / `72ff96d` (checked).
- **Evidence level:** static (source inspection only). Nothing was edited, built, run, or started in any repository, and no runtime behaviour was observed.

## Headlines (summarized; findings.md is authoritative)

| Decision | Discovery headline | Sage's proposal (not accepted) |
| --- | --- | --- |
| D01 Project | No canonical Project entity exists. The daemon keys everything on a canonical path. One folder has three unrelated IDs (Cave `nanoid`, daemon `sha256(cwd)`, Psyche `projectDigest`). Missions bind exactly one cwd. | Back the first read-only view with Cave Client v1 `projects.list`. Show `id`, `name`, and `root` separately, and join work by canonical root. |
| D02 Host | Cave owns folder discovery, project registration, and daemon selection today. The native `coven host` side isn't in coven at `35ce431a`. | Give Compass no Host role. Leave Host naming and ownership to the Coven and Host owners. |
| D03 Transport | No safe browser path exists. Loopback TCP is unauthenticated with no CORS. The Unix socket is unreachable from a browser. | Don't connect a static page to the daemon. Run inside Cave, same-origin, or as a Cave Client v1 consumer with `chat:read`. Until then, static Compass shows live data as **unavailable**. |
| D04 Projection | There's no project subscription. `projects.list` returns keyset pages (`apiVersion "1.0"`). Cursor dialects diverge, and version detection is an exact string match. | Snapshot plus poll-and-age freshness. Show *stale* and *reconciling* explicitly, and show *unavailable (unsupported version)* on a mismatch. |
