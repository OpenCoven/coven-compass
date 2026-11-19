# Coven Compass discovery: what backs a Project (D01–D04)

From: Sage · For: Nova (routing), Cody (first read-only Project view) · Person: Val
Brief: `/Users/buns/.coven/workspaces/familiars/sage/handoffs/2026-11-19-from-nova-compass-d01-d04-discovery.md`
Receipt marker: `NOVA-SAGE-COMPASS-20261119-D01D04`
Tracking: https://github.com/OpenCoven/coven-compass/issues/2
Date: 2026-11-19

## Method and pins

This was read-only. Nothing was edited, built, run or started in any repo. Every citation below comes from the committed revision through `git show <rev>:<path>` or `git grep <rev>`, never from a working tree. Three trees were dirty at brief time: coven (`crates/coven-cli/src/daemon.rs` modified, plus untracked files), coven-cave (`pnpm-lock.yaml`, one deleted `.gitkeep`) and coven-threads (untracked `site/`). Those uncommitted changes are not reflected here.

Citation form: `repo@rev path:line`.

| Repo | Local path | Pinned rev | Moved since the brief? |
| --- | --- | --- | --- |
| coven | `/Users/buns/Documents/GitHub/OpenCoven/coven` | `35ce431a` | no |
| coven-agents | `…/coven-agents` | `7052dc3` | no |
| sdk | `…/sdk` | `6e816c5` | no |
| coven-threads | `…/coven-threads` | `33baee4` | no |
| psyche-build | `…/psyche-build` (branch `local/556-unread-reply-bound-private`) | `8b97cf6` | no |
| coven-cave | `…/coven-cave` | `57b44a3a8` | no |
| coven-castles | `…/coven-castles` | `9310183` | no |
| coven-compass | `…/coven-compass` | `792187e` (read); `72ff96d` (checked) | **yes**. Val's rename (#1) landed as `72ff96d` "feat: rename the Atlas to Coven Compass; Castle becomes Project" during this session. D01 now reads "Meaning and owner of a Project". The CSV follows the `72ff96d` template rows. The D01 question is unchanged in substance, and "a Castle serves exactly one Project" is now labelled "a working assumption, not a contract". |
| coven-host (added) | `…/coven-host` | `d2e5348` | n/a |
| coven-memory (added) | `…/coven-memory` | `eb542a5` | n/a |
| familiar-contract (added) | cargo git cache `~/.cargo/git/db/familiar-contract-686868760b6d684a` | `93f486cf` | n/a (pinned by coven) |

Labels: **read** means seen in code or docs at the pin. **inference** means my conclusion from what I read. **not found** means I searched and found nothing; the patterns are listed.

Compass docs were read as context only. None of the claims below rest on them.

---

## D01 · What is a Project, canonically?

### Q1. Which existing object is closest to "Project"?

**Answer.** No single canonical Project object exists. Four components each model "a project" differently, and all four reduce to **one filesystem path**:

| Candidate | ID field | Storage owner | Lifecycle |
| --- | --- | --- | --- |
| **Cave project** `CaveProject` | `id`: random `nanoid()` (10 chars) | Cave Node server, `<caveHome>/projects.json` | Create, update and delete through Cave API routes |
| **Coven daemon project root** | none; the canonical path is the key | Daemon SQLite `coven.sqlite3`, inline `sessions.project_root` | None; it exists only while a session references it |
| Daemon opaque `project_id` (authority path) | `"project:" + sha256(cwd)[..32]` | Derived on demand, never stored as an entity | None |
| Psyche `projectDigest` (spec) | Psyche-owned opaque digest | Psyche (planned repo, not present) | Spec only |
| coven-agents `RunnerAgent.workspace` | free varchar path inside a Daytona sandbox `/workspace` | coven-agents Postgres | Follows the agent row |
| psyche-build `projectRoot` | canonical path; the control socket is a hash of it | psyche-build runtime `~/.psyche/runtime/sockets/<id>.sock` | Per cockpit process |

**Evidence.**

*Cave project registry*
- coven-cave@57b44a3a8 `src/lib/cave-projects-types.ts:11-19` defines `export type CaveProject = { id: string; name: string; root: string; color?; access?; repoUrl?; … }`.
- coven-cave@57b44a3a8 `src/lib/cave-projects.ts:25-30` puts storage at `path.join(caveHome(), "projects.json")` and `:20-23` sets the file shape `{ version: 1; projects: CaveProject[] }`.
- coven-cave@57b44a3a8 `src/lib/cave-projects.ts:212` mints the ID with `id: nanoid()`.
- coven-cave@57b44a3a8 `src/lib/cave-projects.ts:121`: "the normalized path IS the project identity". At `:203-209`: "One project per root… Return the existing project idempotently".
- Lifecycle runs through `POST /api/projects` (`src/app/api/projects/route.ts:49-102`) and `PUT`/`DELETE /api/projects/[id]` (`src/app/api/projects/[id]/route.ts:19,93,108-117`). The DELETE handler also revokes the project's grants. This came from the Cave discovery pass; I spot-checked the type, storage and ID lines myself.
- A **canonical read API** exists. coven-cave@57b44a3a8 `src/app/api/client/v1/projects/route.ts:1-10` reads: "The canonical read of the Cave project registry (`<caveHome>/projects.json`), one page at a time". The SDK binds it: sdk@6e816c5 `packages/cave/src/canonical-reads.ts:39-42` `operation: 'projects.list', capabilities: ['projects','cursors']`, with the type `CaveProject {id,name,root,color?,repoUrl?,createdAt,updatedAt}` at `packages/cave/src/schemas.ts:12-20`.

*Coven daemon*
- coven@35ce431a `crates/coven-cli/src/project.rs:3-4`: `pub fn canonical_project_root(path) … path.canonicalize()`.
- coven@35ce431a `crates/coven-cli/src/store/schema.rs:151-153`: `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY NOT NULL, project_root TEXT NOT NULL, …`.
- coven@35ce431a `crates/coven-cli/src/automations/trusted_authority.rs:775-778`: `opaque_id(kind, cwd) → format!("{kind}:{}", &sha256_hex(cwd.as_bytes())[..32])`. It is used at `:224-225` as `project_id: &opaque_id("project", cwd), workspace_id: &opaque_id("workspace", cwd)`. Coven Threads requires these fields: coven-threads@33baee4 `profiles/automation-authority/v1/schemas/request.schema.json:141` `"required": ["project_id", "workspace_id", "runtime"]`.
- coven@35ce431a `crates/coven-agents/src/delegation.rs:147-151`: `/// Opaque project identity. Coven compares it for equality only; a child may never cross into a project its parent does not hold. pub struct ProjectRef(String);`.
- coven@35ce431a `crates/coven-cli/src/reset.rs:92-96`: `name: "projects" … "The legacy local project registry stored in COVEN_HOME." paths: &["repos.toml"]`. This is a hand-edited `repos.toml` (`repos_config.rs:8-20`) with no API.

*Psyche (spec only)*
- coven@35ce431a `specs/psyche/O2_CONTRACT_DESIGN.md:130-133`: "The top-level, Coven-resolved canonical `projectRoot` remains Coven authority… `executionBinding.projectDigest` is Psyche-owned, independently persisted, and is never derived from or checked against `project_root`."

*psyche-build*
- psyche-build@8b97cf6 `src/orchestration/types.ts:29-41`: `OrchestrationTaskRequest { taskId; …; projectRoot: string; … }`.
- `src/control/endpoint.ts:13-17` hashes the canonical project root to a control socket (from the Castles/Threads/Psyche discovery pass; not re-read by me).

*coven-agents*
- coven-agents@7052dc3 `lib/db/schema.ts:776`: `workspace: varchar("workspace", …)` on `RunnerAgent`. ADR-001 assigns project authority elsewhere: coven-agents@7052dc3 `docs/architecture/adr-001-product-authority-boundary.md:36` "Project and harness-session authority | OpenCoven/coven | Consume versioned authority through an explicit future adapter" (from the SDK/coven-agents pass).

**Contrary evidence.**
- The daemon is the stated authority for project boundaries: missions, sessions and authority checks all key off its canonical path. But it holds **no project entity, no project ID, and no project list**. `GET /sessions` takes only `limit`, `cursor` and `includeArchived` (coven@35ce431a `crates/coven-cli/src/api.rs:4880-4882`), and there is no `/projects` route in the dispatcher (`api.rs:935-1540`).
- Cave holds the only registry with IDs, names and a list. Cave is a product UI, not the daemon, and its IDs are random per install. coven-cave@57b44a3a8 `src/lib/cave-projects-types.ts:65-86` (`dedupeProjectsByRoot`) notes that IDs "are random and can diverge across duplicate rows".
- **Three unrelated IDs for the same folder (inference, from the citations above).** Cave's `nanoid`, the daemon's `sha256(cwd)` opaque ID, and Psyche's independent `projectDigest`. Nothing maps one to another except the path.

**Unknowns.**
- Whether the daemon's `opaque_id("project", cwd)` is meant to be the canonical project ID or is only an authority-profile projection. No doc at the pin says either way.
- The Psyche repo (`OpenCoven/psyche`) is not checked out locally. See Q3 and gaps.md.

### Q2. Is a display name separate from identity and path? Can one Project bind multiple roots?

**Answer.** Only Cave separates a display name: `name` is distinct from `id` and `root`. Even there, the path is the effective identity. **No project object binds multiple roots.** Multiple roots exist only as per-session access policy.

**Evidence.**
- Cave: `name`, `id` and `root` are separate fields (coven-cave@57b44a3a8 `src/lib/cave-projects-types.ts:12-15`). `name: input.name.trim()` sits at `src/lib/cave-projects.ts:213`. Exactly one `root` is allowed, and creating a second project at the same root returns the existing one (`:203-209`).
- Daemon: there is no name field at all. Multiple roots appear only in launch or chat policy: coven@35ce431a `crates/coven-cli/src/chat_workspace_policy.rs:10-16` `ChatWorkspacePolicy { …, primary_root, writable_roots, read_only_roots }`, and `launchPolicy.addDirs` at `api.rs:4242-4266` (from the daemon pass).
- Cave chat fingerprint: `runtimeAccessFingerprint` carries `{version:2, primaryRoot, permissionMode, readOnlyResourceRoots, roots:[{root,access}]}` (coven-cave@57b44a3a8 `src/lib/chat-runtime-scope.ts:68-90`; from the Cave pass). Its roots are the cwd, plus every project the familiar holds a grant for, plus the familiar's workspace. That is a session's reach, not a project's shape.
- coven-host: one client state binds exactly one root, `"client state is already bound to another root"` (coven-host@d2e5348 `src/client.rs:155-175`; from the Cave/Host pass).

**Contrary evidence.** Cave grants (`ProjectGrant {familiarId, projectId, access, …}`, coven-cave@57b44a3a8 `src/lib/project-permissions.ts:44-51`) let one familiar session reach several project roots at once. This is one session spanning projects, not one project spanning roots.

**Unknowns.** No owner has decided whether a Project *should* bind several roots, for example a monorepo plus a docs repo. That stays D01 policy.

### Q3. What's closest to "mission", and to task/attempt? Can a mission span Projects?

**Answer.** The **daemon automation mission** is the closest real object. It binds to **exactly one project cwd**, so it **cannot span Projects**. The Psyche spec states the same rule ("one project" per intent). Attempts exist in the daemon automation runs, in the daemon mission view and in coven-agents. Cave board cards are the closest "task", and their dependencies can point across projects.

**Evidence.**

*Daemon mission*
- coven@35ce431a `crates/coven-cli/src/automations/missions.rs:75-76`: `mission_id_for(adoption_key) → format!("mission-{}", &sha256_hex(adoption_key.as_bytes())[..32])`.
- Table `automation_missions (mission_id TEXT PRIMARY KEY, …, project_cwd TEXT NOT NULL, …)` at `automations/store.rs:49-66`; rows are immutable via triggers at `:69-78` (from the daemon pass).
- One active mission per (familiar root, cwd): coven@35ce431a `automations/missions.rs:686-694` runs `SELECT 1 FROM automation_missions … WHERE mission.familiar_root_id = ?1 AND mission.project_cwd = ?2 AND occurrence.state NOT IN (…terminal…)`.
- SDK view: sdk@6e816c5 `packages/coven/src/missions-view.ts:95-115` `CovenMissionView { missionId; occurrenceId; revision; state; …; familiar; envelope; project: { cwd: string }; task: { statement }; attempts; … }`. The attempt shape `CovenMissionAttempt {attemptId, attemptNumber, state, failureClass?}` is at `:54-60`.

*Daemon runs and attempts*
- `automation_runs` and `automation_attempts (…, attempt_number 1..10, occurrence_fence_generation, dispatch_generation, session_id UNIQUE, …)` at coven@35ce431a `automations/runs.rs:15-111` (from the daemon pass). Neither has a project field; they reach a project only through the session's `project_root` (inference).

*Psyche spec*
- coven@35ce431a `specs/psyche/INTEGRATION_REVIEW.md:393-397`: "Every accepted intent binds: one mapped principal; one familiar identity snapshot; one project; …".
- Execution binding `psyche.execution_binding.v1 {…, projectDigest, graphId, nodeId, attemptId, …}` at `specs/psyche/O2_CONTRACT_DESIGN.md:68-80` (from the Psyche pass).
- coven@35ce431a `specs/psyche/DECISION_DOSSIER.md:13`: "Product home: planned standalone `OpenCoven/psyche` repository".

*psyche-build*
- A task has one `projectRoot` and rejects paths outside it. psyche-build@8b97cf6 `src/orchestration/planner.ts:306-309` throws `'project_scope_violation' … "resolves outside the project root"`.
- It has no mission type ("mission" not found in src, packages or docs) and no attempt type.
- It claims no Psyche conformance yet: psyche-build@8b97cf6 `docs/PSYCHE-COMPATIBILITY-MAP.md:15` "must not claim Psyche protocol conformance".

*Cave*
- Board `Card {id, sessionId, cwd, projectId?}`. coven-cave@57b44a3a8 `src/lib/cave-board-types.ts:284-285`: "Stable project ID from cave-projects.json. Preferred over cwd."
- `TaskDependency.taskId` "Must name a live card" (`:58-59`), with no project constraint (from the Cave pass).
- `ResearchMission {id, familiarId, projectRoot?, …}` at `src/lib/research-missions.ts:270-310` is a Cave research feature.
- `mission-defs.ts` is a gamified progression catalog, unrelated to work missions (from the Cave pass).

*coven-agents*
- `RunnerTeamRun.mission` is a varchar at coven-agents@7052dc3 `lib/db/schema.ts:1293`; it is one instruction shared by a team. Each team member runs in its own sandbox workspace (from the SDK/coven-agents pass). There is no project entity.

**Contrary evidence.**
- Cave card dependencies and coven-agents team missions can each involve more than one workspace. They do so by composition, not because one mission is scoped to several projects.
- Cave cards reference the **Cave** project ID. Daemon missions reference the **cwd**. The same "task" therefore keys differently depending on who you ask.

**Unknowns.** The real Psyche task, lane, lease and attempt model lives in the unpinned `OpenCoven/psyche` repo, blocked on `OpenCoven/psyche#11` per psyche-build@8b97cf6 `docs/PSYCHE-COMPATIBILITY-MAP.md:15`. Not found locally at any rev.

### Q4. How does a coven-castles sandbox binding relate to a Project? Does anything enforce "one Castle serves one Project"?

**Answer.** **It doesn't relate to a Project today.** A coven-castles binding is (owner agent ID, sandbox ID, expected generation, profile), checked against the **coven-agents agent record**. No repo, project or workspace field is involved. **Nothing enforces one Castle per Project.** The coven-agents schema does make a pinned sandbox unique to one agent row.

**Evidence.**

*The binding*
- coven-castles@9310183 `src/profile.ts:255-260` reads the keys `CASTLES_PROFILE`, `CASTLES_SANDBOX_ID`, `CASTLES_OWNER_AGENT_ID`, `CASTLES_SANDBOX_GENERATION`.
- `src/profile.ts:267-273` defines `Binding = { agentId /* "The Coven Agents agent record that canonically owns the sandbox." */; expectedGeneration; profile; sandboxId }`.
- coven-castles@9310183 `src/preflight.ts:1049,1053,1057,1064-1068` raises `owner_mismatch`, `binding_mismatch` and `returned_id_mismatch`, and `generation_mismatch` when `envelope.binding.generation !== binding.expectedGeneration`.

*Scope and enforcement*
- coven-castles@9310183 `docs/architecture.md:12-14`: "Not a backend. No server, database… Not a fleet manager. One sandbox, one familiar, one active attempt."
- `docs/architecture.md:101`: "They are not fields of the profile, and nothing at this revision enforces them."
- No project, repo or workspace field: grepping `project|repo|workspace|worktree` in coven-castles `src/` only matches `UPSTREAM_REPOSITORY = "OpenCoven/coven-agents"` (`src/profile.ts:9`; from the Castles pass).

*Upstream record in coven-agents*
- coven-agents@7052dc3 `lib/db/schema.ts:705` `daytonaSandboxId: text(…)`, `:731` `pinnedSandboxId`, `:736` `sandboxGeneration: integer(…).notNull().default(0)`, `:776` `workspace: varchar(…)`.
- `:781` `unique("RunnerAgent_pinnedSandboxId_key").on(table.pinnedSandboxId)` makes a pinned sandbox belong to at most one agent.
- `daytonaSandboxId` has no unique constraint at this rev; I grepped `unique|uniqueIndex` in `lib/db/schema.ts`.

*Provider and lifecycle*
- Daytona: coven-castles@9310183 `src/profile.ts:245` `provider: "daytona"`. Castles never mutates a sandbox; `MUTATION_OWNERS` names coven-agents at `src/profile.ts:105-110` (from the Castles pass).
- The live inspection seam is missing: "reports `unavailable` / `upstream_seam_missing`", blocked on coven-agents#296 (coven-castles@9310183 `README.md:7,48`).

**Contrary evidence: the word "Castle" already means something else in coven-host.**
- coven-host@d2e5348 `src/folder.rs:136-166` seeds `<root>/Castles/demo/{files,results}` and a manifest `castle.json` `{"version":1,"id":"demo","displayName":"Demo Castle"}`.
- coven-host@d2e5348 `README.md:16`: "The MVP supports a single client, peer and Castle."
- There a Castle is a **synced folder area**, not a hosted sandbox. This collides with Val's 2026-11-19 meaning ("a hosted place where a familiar runs work").

**Version drift.** coven-castles cites its upstream as `coven-agents@3a4f3ff` (coven-castles@9310183 `docs/architecture.md:109`, `docs/acceptance.md:34`). This report uses the brief's pin, `7052dc3`. The fields above exist at `7052dc3`.

**Unknowns.**
- Whether `RunnerAgent.workspace` (a path inside `/workspace`) is meant to name a Project.
- How a coven-agents agent maps to a local Coven project. coven-agents@7052dc3 `docs/product/cloud-pilot-integration.md:68-69` says the native-to-cloud binding "remain[s] unimplemented" (from the SDK/coven-agents pass).

---

## D02 · Host as the folder/product surface

### Q5. Which component owns folder discovery, workspace registration and daemon selection? Is there already a "host" concept?

**Answer.** **Cave owns all three on the desktop today.**
- **Folder discovery:** a native picker plus a web directory browser. Nothing auto-scans.
- **Workspace registration:** `projects.json`.
- **Daemon selection:** `COVEN_SOCKET`, then `$COVEN_HOME/coven.sock`, or a hub URL.

The coven CLI and daemon pick a home (`COVEN_HOME`) but register no folders. psyche-build selects a socket independently. **Three separate "host" concepts exist**, and none of them is a folder/product surface that owns registration:
1. The daemon **hub/node** multi-host mode.
2. The **coven-host** folder-sync library, whose peer has a persistent host ID.
3. The daemon **mobile host identity**, a TLS key.

**Evidence.**

*Folder discovery (Cave)*
- Tauri `shell_pick_directory` at coven-cave@57b44a3a8 `src-tauri/src/shell_open_commands.rs:301-327`, called from `src/components/project-picker.tsx:95-110`.
- Web `GET /api/fs-browse` at `src/app/api/fs-browse/route.ts:16-38`.
- `isAllowedNewProjectRoot` at `src/lib/server/project-paths.ts:161-176` allows any path except `$HOME`.
- These came from the Cave pass. No automatic repo scanning was found.

*Daemon selection*
- Cave: coven-cave@57b44a3a8 `src/lib/coven-daemon.ts:334` `resolveDaemonSocket`. It returns `env.COVEN_SOCKET` first (`:370-376`) and falls back to `path.join(covenHome, "coven.sock")` with source `"canonical-local"` (`:439-443`). Hub mode reads a URL plus an access token (`:458-470`).
- Cave also launches the daemon (`args: [...fixedArgs, "daemon", "start"]`, `src/lib/daemon-start.ts:289-299`) and resolves `COVEN_BIN` (`src/lib/coven-bin.ts:880-924`). Both from the Cave pass.
- Daemon and CLI: `COVEN_HOME → HOME → … → .coven` (coven@35ce431a `crates/coven-cli/src/paths.rs:26-29`) and `coven_home.join("coven.sock")` (`daemon.rs:2422-2423`), from the daemon pass.
- The Rust client looks only at `<home>/coven.sock`: coven@35ce431a `crates/coven-client/src/discovery.rs:57` "Discover only owner-local IPC".
- The CLI has no `--daemon` or `--socket` flag (not found: `COVEN_SOCKET|COVEN_URL|COVEN_DAEMON`, `"--daemon"|--socket|remote.?profile`).
- psyche-build: psyche-build@8b97cf6 `src/daemon/bridge.ts:838-849` tries `COVEN_SOCKET`, then `COVEN_HOME/coven.sock`, then `~/.coven/coven.sock`, with an HTTP fallback at `:854` `http://127.0.0.1:${COVEN_PORT || 7777}`.
- SDK: sdk@6e816c5 `packages/coven/src/discovery.ts:885` uses `paths.join(home, 'coven.sock')`, and `:368` refuses HTTP endpoints (from the SDK pass).

*Host concepts*
- Daemon hub: coven@35ce431a `crates/coven-cli/src/hub.rs:1` "Hub control-plane state for multi-host mode (#266)". Nodes register via `POST /hub/nodes` (`api.rs:1370`) into `node_registry` (from the daemon pass).
- coven-host: coven-host@d2e5348 `README.md:3-5`: "keeps an ordinary folder in sync with one authenticated peer… The native `coven host` commands, daemon and npm packaging live in OpenCoven/coven" (that README links coven issue #1805).
  - **Not found at coven@35ce431a:** I grepped `coven host|host_sync|hostsync|coven-host` in `crates/`. Only a test hostname matched (`daemon.rs:12685`). The native `coven host` commands are not in the daemon at this rev.
  - The host ID is a UUID in `host.sqlite`, sent as `X-Host-ID`, and refused if it changes (coven-host@d2e5348 `src/peer/server.rs:39-65`, `src/peer.rs:158-193`; from the Host pass).

**Contrary evidence.**
- coven-host's plan says "Daemon owns the root, token reference and polling worker. Same-user IPC advertises `hostSync`" (coven-host@d2e5348 `docs/plan.md:11`; from the Host pass). That is a **plan**. The daemon at `35ce431a` has no `hostSync`.
- Cave never references coven-host. I grepped `hostSync|coven host |coven-host|Castles/` over src/, server.ts and src-tauri/src and found no code hits.

**Unknowns.** Whether D02's "Host" is the coven-host product, the daemon hub, or Cave's project registry under a new name. The code supports none of those as the owner of export/import (see gaps.md G4).

---

## D03 · Daemon connection and credentials

### Q6. What transports does the daemon expose? What auth, origin rules and principal selection apply? Is a read-only scope possible?

**Answer.** The daemon has four transports:

| Transport | Bind | Auth | Origin rules | Principal | Read-only? |
| --- | --- | --- | --- | --- | --- |
| Unix socket `<COVEN_HOME>/coven.sock` (Windows named pipe) | same-user file `0o600` in a `0o700` home | **filesystem permissions only**; the server does no peer-cred check; clients verify the server | n/a | `RequestAuthority::OwnerLocalIpc` (full) | no scope levels |
| TCP `daemon serve --tcp ADDR` (opt-in) | **loopback only** | **unauthenticated** | Host header must be loopback or allowlisted; `Origin`, if sent, must be loopback or an exact `https://` allowlisted host; **no CORS headers** | `RequestAuthority::Tcp` (reduced) | effectively "reduced", not read-only |
| Mobile TLS gateway | private, link-local or tailnet address, HTTPS | device-signed request headers after pairing | n/a | paired device | the mobile memory surface is read-mostly |
| coven-relay (separate binary) | `0.0.0.0:8080` default | per-room `Bearer` (43-char) | none found | "not an authentication or authorization authority" | n/a |

Two neighbouring surfaces are not daemon transports but matter for D03:
- **Cave Client v1** (Cave's server, not the daemon) has a **real read scope**. Bearer credential with scope `chat:read`, loopback-only, rate-limited, keyset cursors.
- The **SDK Coven client** uses only the Unix socket or pipe and has no token.

**Evidence.**

*Unix socket*
- coven@35ce431a `crates/coven-cli/src/daemon.rs:5417` chmods the socket `0o600`.
- coven@35ce431a `crates/coven-cli/src/request_authority.rs:8-11`: `enum RequestAuthority { OwnerLocalIpc, Tcp }`.
- The client-side check is in coven@35ce431a `crates/coven-client/src/discovery.rs:57` and :87-118 (symlink, uid, mode). The peer-cred check (`SO_PEERCRED` / `getpeereid`) is client-side at `coven-client/src/transport/unix.rs:725-788` (from the daemon pass).
- SDK: sdk@6e816c5 `packages/coven/src/transport-unix.ts:1263,1273` (owner mismatch; "writable by another user"). The README at `:1218` says "The SDK intentionally does not bundle a peer-credential implementation" (from the SDK pass).

*TCP*
- coven@35ce431a `crates/coven-cli/src/main.rs:1793-1796`: "Also bind an HTTP TCP listener… The API is unauthenticated — bind only to loopback for local dev (e.g. cockpit via Vite proxy)."
- coven@35ce431a `daemon.rs:5231`: "refusing to bind Coven TCP API to non-loopback address(es)".
- coven@35ce431a `daemon.rs:6836-6850` holds the Host and Origin guard: "Host header must be a loopback or allowed address." / "Cross-origin requests are not allowed."
- coven@35ce431a `request_authority.rs:13-30`: only `OwnerLocalIpc` may do chat-context admission, session launch policy, Ward proposals, and "Automation mutations and the reads that expose prompts, run logs, receipts, or stored event checkpoints".
- CORS: not found. I grepped `Access-Control-Allow|allow_origin|CorsLayer` across crates (from the daemon pass).

*Mobile gateway and relay*
- Mobile: `mobile_memory/config.rs:48-49,114-131` and `gateway.rs:1759-1767`.
- Relay: `coven-relay/src/main.rs:20-21` and `ws.rs:3-7,553-575`.
- Both from the daemon pass, at coven@35ce431a; not re-read by me.

*Proposed read-only scope (not implemented)*
- coven@35ce431a `docs/design/remote-listener-auth.md` proposes observe/control scopes and per-device bearer tokens. Its status is "Proposed", and `main.rs` has no `--remote` flag (from the daemon pass).

*Cave Client v1*
- coven-cave@57b44a3a8 `src/app/api/client/v1/projects/route.ts:55-65`: a `isTrustedLoopback(stamp)` check, then `requireScope({ bearer, scope: CLIENT_V1_READ_SCOPE })`, then a rate limit.
- `src/lib/server/client-v1/read-guard.ts:38`: `CLIENT_V1_READ_SCOPE = "chat:read"`.
- The scope list `chat:read, chat:write, conversations:write, attachments:write, tasks:write, github:write` is at `src/lib/server/client-v1/contract.ts:34-41`.
- The loopback stamp is a per-boot secret set only for loopback peers that carry no forwarding headers: coven-cave@57b44a3a8 `server.ts:1158-1175` and `:2395-2399`.

**Contrary evidence.**
- Over TCP, `GET /sessions` and `GET /events` aren't in the `request_authority.rs` deny list. So with `--tcp` on, session lists and events can be read without authentication by any process that can reach loopback. This is inference from the deny list. I did not run it.
- That is the opposite of a safe read-only scope.

**Unknowns.**
- Credential storage and revocation exist only for Cave Client v1 credentials (admin routes at `src/app/api/client/v1/admin/credentials/*`). I did not trace their storage at this rev.
- The daemon has no credentials to store or revoke.

### Q7. Could a static browser page reach any of it safely?

**Answer.** **No.** A static page served from an `https://` origin cannot safely read daemon state today:
- **Unix socket or named pipe:** a browser can't reach it.
- **TCP listener:** off by default and unauthenticated. A CORS request with `Origin: https://x` gets a 403 unless the operator allowlisted that exact host. Even then the daemon sends no `Access-Control-Allow-Origin`, so the browser won't hand the response to the page (inference from the guard code plus the absence of CORS).
- **Opaque requests:** no-cors GETs usually carry no `Origin`, so they pass the guard and *execute* with an opaque response (inference). Turning `--tcp` on for a browser page widens exposure; it doesn't give the page a safe channel.
- **Relay:** needs an `Authorization: Bearer` header, which browsers can't set on a WebSocket. There's also no Origin check (inference).
- **Cave Client v1:** needs the loopback-peer stamp plus a bearer credential. Cave's `/api` proxy rejects foreign origins with `403 "forbidden origin"` / `"forbidden referer"` (coven-cave@57b44a3a8 `src/proxy.ts:402,508,511`).

**The supported path for a browser today is a page served by Cave itself, same-origin, through Cave's server-side proxy.** Cave's browser bundle never talks to the daemon directly: no `src/components` file imports `@/lib/coven-daemon` (from the Cave pass). Compass as a separately hosted static page would need one of these, all owner decisions (see gaps.md G5):
- Cave serving Compass,
- a native or desktop wrapper using the SDK, or
- the proposed remote-listener auth.

---

## D04 · Projection and version negotiation

### Q8. Is there a snapshot or subscription API for sessions, projects or events?

**Answer.** Several exist, each with its own cursor dialect. **There is no project subscription anywhere.** The only project snapshot is Cave Client v1 `projects.list`, a paged read.

| Surface | Kind | Cursor | Schema/version | Gap / recovery |
| --- | --- | --- | --- | --- |
| Daemon `GET /sessions` | snapshot (page) | opaque `cursor`, `next_cursor`; limit 1..1000 | `coven.daemon.v1` | none; keyset |
| Daemon `GET /events?sessionId=` / `/sessions/{id}/events` | poll | `afterSeq` (SQLite rowid) or `afterEventId`; returns `nextCursor{afterSeq}`, `hasMore` | `coven.daemon.v1` | **an unknown `afterEventId` resolves to `None` and restarts from the beginning** (inference) |
| Daemon `GET /main-session/events` | **SSE** | `Last-Event-ID` = seq; frames `id: {seq}` | `coven.daemon.v1` | unknown cursor → **409 `event_cursor_unavailable`** "refresh history before resubscribing"; reset event; 25 s heartbeat; max 16 streams, then 503 |
| Daemon automation feed (`coven.automations.events.read.v1` / `.subscribe.v1` via `POST /actions`) | paged poll | numeric `after` (exclusive) **or** opaque `checkpoint` with expiry; `feed.snapshot` events advance to `throughSequence` | `coven.automations.v1` | expired → **410 `CURSOR_EXPIRED`**; unknown → `NOT_FOUND`; the SDK refuses gaps and never auto-resets; owner IPC only |
| Daemon mission `watch()` (SDK) | poll by `revision` | `afterRevision` | mission view `revision` | n/a |
| Cave Client v1 `projects.list` | snapshot (page) | opaque base64url keyset cursor, max 100/page; an out-of-range limit is refused | `apiVersion "1.0"`, `minimumClientVersion "0.0.1"` | keyset tolerates deletes; no change feed |
| Cave event plane `/api/events-ws` (Cave server → its clients) | WebSocket **invalidations only** | `resume:{epoch,seq}`, acks | `CAVE_EVENT_PROTOCOL = 1` | `resync-required{reason:"server-restarted"\|"replay-gap"}`; topics `sessions, board, runs, familiars, daemon`, **no `projects` topic**; behind `COVEN_CAVE_EVENT_PLANE_ENABLED=1` |
| psyche-build control `events.read` | poll | `afterSequence` | `CONTROL_PROTOCOL_VERSION = 1` | `gap: afterSequence < firstRetained - 1` |
| coven-threads approval events | append-only chain | `sequence ≥ 1` + `previous_event_digest` | `…approval-event/v1` | stale or skipped sequence rejected |

**Evidence.**

*Daemon sessions and events*
- coven@35ce431a `crates/coven-cli/src/api.rs:4880-4886` takes `limit`, `cursor` and `includeArchived`; with none of them it returns the full list.
- `api.rs:5333-5335`: `"nextCursor":{"afterSeq":N},"hasMore":…`.
- coven@35ce431a `crates/coven-cli/src/store.rs:4258-4267` resolves `afterEventId` with `.optional()`, so an unknown ID becomes `None`.

*Daemon SSE*
- coven@35ce431a `crates/coven-cli/src/main_session_events.rs:119-131`: `409, "event_cursor_unavailable", "The event cursor is unavailable; refresh history before resubscribing."`.
- Heartbeat and stream cap at `:23, :26, :294-300`, from the daemon pass.

*Daemon automation feed*
- sdk@6e816c5 `packages/coven/README.md:911-932` (after/checkpoint, gapless, `CURSOR_EXPIRED` 410, "The SDK never resets a cursor").
- sdk@6e816c5 `packages/coven/src/automations-events.ts:262-264` (`feed.snapshot` → `throughSequence`; otherwise `event.sequence !== (cursor ?? -1) + 1` → invalid).
- Daemon side: coven@35ce431a `contract/events.rs:29-60,126,650-663` and `control_plane.rs:1026-1060,248`, from the daemon pass.

*Missions*
- sdk@6e816c5 `packages/coven/src/missions-view.ts:98`: "Increases on every state change and stops at the terminal state."
- `missions.ts:250-258` holds `watch()` (from the SDK pass).

*Cave Client v1*
- coven-cave@57b44a3a8 `src/app/api/client/v1/projects/route.ts:77-88` does the keyset paginate and emits `{ projects }` plus a cursor.
- `src/lib/server/client-v1/pagination.ts:1-25` explains the shape: "follows the daemon's session pager (OpenCoven/coven#783)… page ceiling… (100)… an out-of-range `limit` is refused… Offsets are deliberately absent".
- `src/lib/server/client-v1/responses.ts:82-89` builds the envelope base `{apiVersion, minimumClientVersion, capabilities, operations, requestId?}`.

*Cave event plane*
- coven-cave@57b44a3a8 `src/lib/cave-event-plane-protocol.ts:1-16`: "carries invalidations only… REST snapshots stay authoritative… parsers are strict and fail closed".
- Topics and resync at `:34-114`, from the Cave pass.
- Cave polls the daemon: `src/lib/server/daemon-event-watcher.ts:1-18` "The daemon is pull-only" (from the Cave pass).

*psyche-build and threads*
- psyche-build@8b97cf6 `src/control/runtime.ts:433-434` (from the Psyche pass).
- coven-threads@33baee4 `crates/coven-threads-core/src/automation_authority/lifecycle.rs:438-442` (from the Threads pass).

**Contrary evidence.**
- The daemon's own capability advertises `event_cursor` (coven@35ce431a `crates/coven-cli/src/api_health.rs:49-57`, including `event_cursor: String`). That suggests a single cursor model, but each stream above actually has its own cursor dialect.
- The SDK Coven client has **no** list-sessions or list-projects method. I grepped `listSessions|sessions\(|listProjects|projects\(` in `packages/coven/src` and found nothing (from the SDK pass). Sessions and events appear in the SDK only as health booleans.

**Unknowns.**
- Whether `GET /events` with an unknown `afterEventId` really replays from the start. That reading comes from the `.optional()` code and was not run.
- Cursor lifetime for daemon `/sessions` cursors and Cave Client v1 cursors: no expiry was seen in the lines I read.

### Q9. How does the SDK version its bindings, and how does a client discover an unsupported version?

**Answer.** The SDK packages are all `0.0.1`, private, and released as one **fixed changeset group**. API baselines are checked in. Protocol versions are string constants. Discovery differs by client:
- **Coven daemon client.** Calls `GET /api/v1/health` and requires `apiVersion === "coven.daemon.v1"` exactly, otherwise generic `invalid_response`. There is no dedicated version error and no semver check. Per-feature support comes from `GET /api/v1/capabilities`, failing with `capability_unsupported`.
- **Cave client.** Requires API major `1` and semver `minimumClientVersion ≤ CAVE_CLIENT_VERSION`, otherwise **`incompatible_version`**.
- **Unknown fields.** The Coven client is strict: unknown keys fail closed. The Cave client ignores additive fields.
- **Daemon side.** `GET /api-version` → `{apiVersion:"v1", supportedApiVersions:["v1"]}`. An unknown `/api/vN/` → 404 listing the supported versions.

**Evidence.**

*SDK packaging*
- `.changeset/config.json` `"fixed": [["@opencoven/sdk-core", "@opencoven/cave-client", "@opencoven/coven-client", "@opencoven/sdk"]]`.
- `api-baselines/coven.json:2` `"version": 2`.
- Package versions at `packages/*/package.json:2-3`.
- All at sdk@6e816c5, from the SDK pass.

*Coven client*
- sdk@6e816c5 `packages/coven/src/schemas.ts:1-13`: `COVEN_DAEMON_PROTOCOL = 'coven.daemon.v1'` and `CovenHealthResponse { apiVersion, covenVersion, capabilities{sessions, events, eventCursor?, structuredErrors} }`.
- sdk@6e816c5 `packages/coven/src/client.ts:163-167`: `if (!validateHealthResponse(response) || response.apiVersion !== COVEN_DAEMON_PROTOCOL) { throw invalidHealthResponse(); }`.
- Capability gate: `packages/coven/src/missions.ts:361-362` → `capability_unsupported` (from the SDK pass).

*Cave client*
- sdk@6e816c5 `packages/cave/src/client.ts:96` `SUPPORTED_CAVE_API_MAJOR = '1'`, with the check at `:2125-2166`.
- `packages/core/src/compatibility.ts:201-212` `assessCompatibility`.
- From the SDK pass.

*COMPATIBILITY.md*
- sdk@6e816c5 `COMPATIBILITY.md:20-22`: pre-1.0, minor releases may break.
- `:26-29`: Cave rejects unsupported majors and newer minimum-client requirements.
- `:45`: receipts, "Unknown fields and unsupported variants fail closed".
- From the SDK pass.

*Rust client and daemon*
- coven@35ce431a `crates/coven-client/src/models.rs:5` `PROTOCOL_VERSION = "coven.daemon.v1"`.
- `crates/coven-client/src/http.rs:52-56` returns `ClientError::ProtocolVersion { expected, actual }` (the Rust client *does* have a dedicated version error).
- coven@35ce431a `crates/coven-cli/src/api.rs:936-941` serves `/api-version`.
- Unknown-version 404 at `api.rs:915-924`, from the daemon pass.

*Cave and psyche-build against the daemon*
- coven-cave@57b44a3a8 `src/lib/daemon-startup-contract.ts:4,23-28` allowlists `COVEN_DAEMON_API_VERSION = "coven.daemon.v1"`.
- Cave also probes CLI flags by parsing `coven run --help` (`src/lib/harness-adapters.ts:341-344`, from the Cave pass). That is a second, version-free negotiation channel.
- psyche-build accepts `coven.daemon.v1` **or `v1`** (psyche-build@8b97cf6 `src/daemon/bridge.ts:780-781`, from the Psyche pass). That is looser than the SDK.

**Contrary evidence.**
- sdk@6e816c5 `packages/core/package.json:16` exports a `./browser` subpath, but `COMPATIBILITY.md:12` says only the root and `./package.json` are supported (from the SDK pass).
- The three daemon clients (SDK TS, Rust `coven-client`, psyche-build bridge) apply three different strictness levels to the same health field.

**Unknowns.**
- No minimum-daemon-semver check exists anywhere. I grepped `MIN_COVEN_VERSION|minimumCovenVersion|MIN_DAEMON|minDaemonVersion` in Cave.
- How a client should tell "too old" from "too new" on `coven.daemon.v1` is undefined.

---

## Where the brief's unlocated components live

- **Familiar Contract.** Repo `OpenCoven/familiar-contract` at `93f486cf`, pinned by coven@35ce431a `crates/coven-cli/Cargo.toml:80` (`familiar-contract = { git = "https://github.com/OpenCoven/familiar-contract", rev = "93f486cf9e7b66f7f3a49131fbcfd003dd9da8ac", version = "0.7.0" }`). There is no checkout under `/Users/buns/Documents/GitHub/OpenCoven`; I read it from the cargo git cache.
  - `schemas/familiar-embodiment-binding.schema.json:10-19`: `"profile": {"const": "familiar.embodiment_binding.v1"}, "schemaVersion": {"const": "1.0.0"}, familiar: {familiarRootId, identityRevisionId, lineagePosition, lineageEvidence}`.
  - The binding schema has no project field (from the Psyche pass, which ran the grep).
- **Psyche core.** Not found locally. coven@35ce431a `specs/psyche/DECISION_DOSSIER.md:13` says "planned standalone `OpenCoven/psyche` repository". Its specs live in coven `specs/psyche/`. psyche-build's protocol pin is blocked on `OpenCoven/psyche#11`/`#12` (psyche-build@8b97cf6 `docs/PSYCHE-COMPATIBILITY-MAP.md:15`). In psyche-build, `psyche` is a launcher **file**, not the core.
- **SPAR.** **Not found at any rev inspected.** It appears only in prose; no code, schema or repo exists.
  - Searched for `-w SPAR|S\.P\.A\.R`, filenames `spar`, and `continuity profile|continuity-profile|continuity_profile`.
  - Repos covered: chat, coven, coven-agents, coven-castles, coven-cave, coven-code, coven-compass, coven-docs, coven-grimoire, coven-host, coven-landing, coven-memory, coven-podcast, coven-remote, coven-threads, coven-today, desktop-use, open-coven-weekly, open-sesame, psyche-build, psyche-research, research, sdk, slides and familiar-contract.
- **psyche-research\*.** All 28 folders are worktrees of `OpenCoven/psyche-research`, a Django research-publication site ("A bounded research publication for practical work with AI systems", README.md:1-3 at origin/main `828a5b9`). It is **a separate product, unrelated to Psyche orchestration**; do not use it. From the Psyche pass.

---

## Recommendations (all **proposed**; none is an owner decision)

**D01 · Project: proposed.**
- Back the first read-only Project view with the **Cave project registry, read through Cave Client v1 `projects.list`** via `@opencoven/cave-client`. It is the only existing object with an ID, a display name, a root and a paged canonical read with an auth scope.
- Show three things separately:
  - Cave's `id` (a Cave-local handle),
  - `name` (display),
  - `root` (the path that **every** other component actually keys on).
- Join daemon sessions and missions to a Project **by canonical root**, never by Cave ID. That matches how the daemon, Psyche spec and psyche-build already key work.
- Treat **one root per Project** and **one Project per mission** as the current reality. Multi-root Projects and cross-Project missions don't exist; they stay out of the first view.
- Show a Castle (coven-castles) under a Project **only once an owner defines the link**. Today no field connects a sandbox binding to a project.
- Flag the coven-host "Castle" naming collision to Val and Nova before the rename lands. It is in scope for #1, not this issue.
- Alternative: use the daemon's `opaque_id("project", cwd)` as the canonical ID. It is stable across machines' Cave installs for the same path, but it is not exposed by any read API. That makes it a daemon-owner change, not an adapter choice.

**D02 · Host: proposed.**
- Record that **Cave owns folder discovery, project registration and daemon selection today**.
- The coven-host repo is a single-folder sync MVP whose native `coven host` daemon side **is not present at coven@35ce431a**.
- Don't give Compass a Host role. Leave "Host" as an open naming and ownership question for the Coven and Host owners (gaps.md G4).

**D03 · Daemon connection: proposed.**
- The first view should **not** connect a static page to the daemon. Run it **inside Cave, same-origin**, or as a Cave Client v1 consumer holding a `chat:read` credential issued through Cave pairing.
- Do not use `daemon serve --tcp` for Compass. It is unauthenticated and sends no CORS headers.
- A static Compass with live data stays **unavailable** until the owners decide (gaps.md G5). Showing it as unavailable is acceptable.

**D04 · Projection: proposed.**
- Snapshot projects with Cave Client v1 `projects.list` (keyset pages; `apiVersion "1.0"`, `minimumClientVersion`, fail with `incompatible_version`).
- Snapshot sessions per root with daemon `GET /sessions` (via Cave's proxy).
- There is no project change feed. Treat freshness as **poll-and-age**, or as Cave's event-plane `invalidate` where enabled. Show "stale" and "reconciling" explicitly.
- Don't derive freshness from `/events`, since an unknown `afterEventId` may silently replay (inference).
- Version gate: require `coven.daemon.v1` (SDK behaviour) and Cave API major 1. On a mismatch, show **unavailable (unsupported version)**. Don't degrade silently.
