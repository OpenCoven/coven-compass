# Coven Host: folder, sync, and recovery proposal

## Product model and first boundary

**Make Coven Host a familiar place to find project work, proposals, artifacts, and receipts while Coven remains the authority that executes and commits.** A folder can make work portable and reviewable without becoming the source of identity or permission. The user's instructions require one coherent authority model and treat cloud infrastructure as an execution surface, not the fundamental home of a familiar. [U1]

This document is a **proposal**. The Site's Castle metadata includes illustrative repository and root strings, but it does not mount folders, synchronize files, or connect to a remote daemon. The production Castles schema, Host implementation, filesystem layout, and transport must be discovered before choosing exact filenames or APIs. [S1] [S2]

The first sync delivery should use **one authoritative owner per project/run**. It may distribute eligible content and display remote results, but it should not support opportunistic offline ownership takeover or replicate live daemon databases.

## Proposed folder contents

The paths below illustrate a user experience, not a required new directory standard. Reuse existing Castle/package conventions when discovery finds them. Ordinary file permissions can reduce accidental edits, but authoritative validation remains necessary.

| Illustrative location | Intended content | Treatment |
| --- | --- | --- |
| `<Host>/Castles/<project>/workspace/` | User work and approved execution inputs. | Versioned working material; never implicit permission to execute. |
| `…/proposals/` | Draft intents, requested changes, and imported suggestions. | Pending until accepted through the canonical authority path. |
| `…/artifacts/` | Produced reports, patches, exports, and supporting evidence. | Bind each accepted version to content identity and its attempt. |
| `…/receipts/` | Exported copies of authoritative outcomes. | Read-only projection; edited copies do not rewrite history. |
| `…/references/` | Links or exported context identifying the project and familiar revision. | References, not private identity material or executable grants. |
| `…/.cache/` | Replaceable previews and downloaded content. | Discardable; excluded from authoritative recovery decisions. |

Keep daemon databases, WAL/SHM files, runtime sockets, process handles, live lease state, bearer tokens, private keys, provider credentials, and secret-bearing environment files outside the synchronized set. A backup/export facility may handle selected state separately under its own consistency and access rules; generic folder sync must not copy a live database and call the result a recoverable authority.

Discover the existing credential facility and secret-redaction rules. The folder should reference an approved credential binding without containing the credential itself. Protect exports and logs too: an apparently harmless report can contain paths, prompts, access tokens, or confidential source content.

## File edits create input, not committed control state

A user can edit a brief or project file in their normal editor. A watcher should detect the changed version, preserve the prior base, and prepare an inspectable proposal or new input version. It must not interpret a line such as “approved,” “owner,” or “run now” as an authenticated operation. Model output, downloaded content, and files synchronized from another machine are subject to the same rule. [U1]

For a running attempt, keep the input snapshot immutable. Later file edits become a candidate next version; they do not silently alter the work already authorized. A user may explicitly request a new attempt or revision through the canonical client, subject to its cancellation and acceptance rules.

Exported receipts should retain their source identifiers and integrity/provenance information. A content digest identifies bytes; it does not alone authenticate who produced them or prove that an operation was authorized. Importing a JSONL trace from the demo is also a replay operation, not an admission path into production authority. [S2]

## Proposed synchronization cycle

1. **Inventory bounded content.** Compare eligible paths against a known base version. Record byte identity, type, size, and applicable project/input references using existing mechanisms where available.
2. **Stage transfers.** Transfer incomplete content into a private staging area with quotas and cancellation support. Do not expose partial content as the accepted project version.
3. **Verify the destination.** Check received bytes, path policy, content limits, and provenance before publication. A matching checksum is necessary for integrity, but does not confer authority.
4. **Publish a consistent version.** Use the platform's supported atomic publication mechanism for the defined unit. Do not infer an atomic multi-file update from several successful file copies.
5. **Reconcile canonical state.** Submit eligible proposals or acknowledge artifact availability through the existing SDK/daemon path. Keep transfer completion separate from task acceptance or protected commit.
6. **Advance the sync checkpoint.** Retain enough base and transfer information to resume or explain interruption. The checkpoint is sync bookkeeping, not a competing task database.

The exact transfer provider is a discovery decision. Prefer existing transport and storage capabilities over introducing another service. Define bandwidth, storage, retention, and cost boundaries before enabling remote transfer; this handoff does not create a paid account or select an unverified provider.

## Conflict policy

Avoid timestamp-based last-writer-wins for semantically important files. Filesystem modification times are useful observations, not an authority ordering rule. Compare against a common base and preserve both versions when their relationship is uncertain.

| Conflict | Proposed handling |
| --- | --- |
| Same input edited on two hosts | Preserve both candidates and their common base; require review before choosing execution input. |
| User edits a file while an attempt produces output | Keep attempt output separate; present a patch or merge proposal against the recorded input revision. |
| Brief, permissions, identity reference, or ownership changes | Route a proposal to the relevant canonical owner; never auto-merge into authority. |
| Receipt bytes differ for the same claimed outcome | Quarantine the conflicting copy and retrieve/reconcile the authoritative record. |
| Delete races with edit or remote result | Retain a tombstone and recovery copy under a defined retention policy; do not silently delete new work. |
| Rename or case/Unicode collision | Resolve identity and filesystem constraints explicitly; do not treat conflicting paths as the same approved object. |
| Cache differs | Rebuild from an accepted source; cache conflict never decides mission state. |

Textual auto-merge may be offered as a draft for ordinary source files. Its success does not establish semantic correctness, authorization, or acceptance. Keep protected metadata and external-effect decisions outside automatic merge.

## Offline operation

Offline users can inspect the last known state, edit ordinary work, and prepare proposals. Label the projection with its known revision/freshness. New control changes remain **proposal-only** until the authoritative owner can validate and commit them. Local connectivity loss must not manufacture an approval receipt or a new owner epoch.

An already-running local attempt may continue only if the existing execution/authorization model explicitly permits that behavior with valid inputs and bounded authority. If required revocation, ownership, or lease evidence cannot be established, stop further protected commits and expose the degraded state. Do not assume that a cached permission remains valid indefinitely.

On reconnect, first re-establish authoritative identity, ownership, and object revisions. Then compare queued proposals with their bases. Stale proposals may need rebasing or renewed approval; replaying the offline queue in file timestamp order is insufficient. These rules follow the supplied separation of intent, authority, and committed state. [U1]

## Multiple hosts and remote execution

Distinguish the **authoritative owner**, the **execution host**, and a **viewing/syncing client**. A remote runtime can execute a bounded attempt while the owner retains the canonical task and decision state. A copied workspace does not transfer ownership.

Any future ownership transfer must use the canonical serialized transition, advance its ownership/fencing state, and ensure that the former owner cannot commit afterward. A local PID, shared-folder lock, heartbeat, or file named “owner” does not provide that guarantee. If there is no reachable shared authority capable of resolving competing owners, a partitioned client cannot safely prove exclusive takeover. For the first delivery, retain a fixed owner and make failover an explicit, qualified operation. [U1]

Remote attempts need exact input references, scoped access, runtime capability evidence, and fencing at every relevant commit boundary. Preventing local state commits alone is insufficient when a stale worker can still invoke an external provider; use supported credential/effect admission boundaries and reconcile any uncertain provider outcome.

Cancellation should record intent durably, stop admitting additional effects, request runtime termination, and settle outstanding results. A transfer may finish after cancellation; retain it as attributable evidence without promoting it into an accepted result automatically. Cancellation does not retract an already accepted external action.

## Path safety and filesystem acceptance

Implement path validation in the owning file-operation layer, not solely in the UI. Enforce the approved root at the actual open/write operation. Reject traversal, unexpected absolute paths, ambiguous separators, unsafe device/special files, and out-of-scope links. Account for case handling and platform-specific reserved names before mapping remote names to local paths.

Symlink checks must survive replacement between validation and use. Prefer descriptor-relative, no-follow, or equivalent platform mechanisms; re-resolving a string and later opening it is not a complete race defense. Establish policy for hard links and mount changes as well. Download/archive extraction must apply the same rules, plus file-count, expanded-size, and depth limits.

Publish through staging that stays on an appropriate filesystem and preserves the promised atomicity. Test interrupted writes, disk-full conditions, permission failures, and integrity mismatches. Report a failed transfer or failed persistence barrier explicitly rather than showing a new accepted revision.

## Recovery and acceptance packet

On restart, load authoritative state first, reconcile ownership and attempts, then rebuild folder projections. Treat orphaned staged transfers as incomplete. Verify durable artifact references, reconcile missing receipts or unknown external outcomes, and admit new work only after the necessary authority and state are available.

| Exercise | Acceptance evidence |
| --- | --- |
| Crash after content upload but before publication | Partial content remains unaccepted; restart resumes or discards safely. |
| Crash after effect acceptance but before receipt visibility | Reconciliation finds the outcome or preserves explicit uncertainty. |
| Symlink/root replacement during a write | Out-of-scope target is never modified. |
| Two hosts edit/delete the same input | Both candidates and the conflict decision remain inspectable. |
| Old owner returns after transfer | Its fenced attempt cannot commit protected changes. |
| Offline proposal uses a revoked/stale binding | Reconnection refuses or requests renewed authorization. |
| Sync scans a live database or secret | Exclusion policy prevents transfer; diagnostics avoid leaking contents. |

Assign discovery of folder conventions to the Castles/Host owner, authoritative transitions to Coven/Psyche, protected decisions to Threads integration, public bindings to SDK, and cross-client acceptance to Cave, CLI, and Psyche Build owners. Each packet should identify real modules and tests after discovery. [U1]

The acceptance result is a recoverable relationship between files, exact inputs, authority, attempts, and receipts. A folder that merely looks synchronized is not enough.

## Sources

[U1]: source-context/user-architecture-instructions.md
[S1]: ../../README.md
[S2]: ../../dist/index.html

- [U1 — supplied authority, identity, persistence, and client boundaries][U1].
- [S1 — simulation scope and absence of production integration][S1].
- [S2 — illustrative Castle metadata, local replay, and sample decisions][S2].
- Related: [architecture and ownership](02-architecture-and-ownership.md), [integration stages and qualification](03-integration-proposal.md).
