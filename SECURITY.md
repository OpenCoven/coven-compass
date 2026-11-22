# Security and publication

## Report a vulnerability

Sign in to GitHub, open the repository’s **Security** tab, and choose **Report a vulnerability**. You can also go directly to the [private reporting form](https://github.com/OpenCoven/coven-compass/security/advisories/new). Include the commit or deployment, affected service and location. Keep credential values out of issues, PRs, screenshots and scan reports. The credential owner should revoke or rotate an exposed value and check its use. Coordinate history changes with the maintainers after containment. Existing downloads, forks, clones and caches can retain old copies.

## Before contributing

Install the matching binary for your system from the [Gitleaks 8.30.1 release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1), put `gitleaks` on your PATH, and confirm `gitleaks version` prints `8.30.1`. From the repository root, run the commands below. Run the installer again after the guard changes. It installs local copies of the scanners in this clone’s Git hooks directory, shared by its linked worktrees. It preserves unrelated hooks and stops if a named hook already exists.

```sh
python3 scripts/install-secret-hooks.py
python3 scripts/scan-secrets.py staged
python3 tests/secret-checks.py -v
```

The pre-commit hook reads the index, including partially staged files. The commit-msg hook scans the proposed message. The pre-push hook scans the objects reachable from every outgoing tip, including credentials added and removed between pushes. Scans fail on detector errors or a missing executable. Findings identify a rule and an object ID where available. Use Git locally to locate an object. Keep any investigation output private.

For a clone with custom hooks, invoke `python3 scripts/scan-secrets.py staged` from pre-commit, `python3 scripts/scan-secrets.py message "$1"` from commit-msg and `python3 scripts/scan-secrets.py pre-push` from pre-push, passing Git’s ref-update input to the latter. Ensure the hook can locate a trusted copy of the scanner on every branch. Local hooks require installation in each clone and Git allows contributors to bypass them.

## History and public builds

Run `python3 scripts/scan-secrets.py history` in a full mirror to examine all locally available refs. Fetch the remote heads, tags and pull-request heads before a publication review. The guard reads unique blobs, tree entries, commits and annotated tags. It checks credential-shaped filenames and byte patterns, then runs Gitleaks’ default rules with redaction and bounded decoding and archive inspection. It rejects shallow history. A complementary diff scan is `gitleaks git --redact=100 --log-opts="--all --full-history -m" .`. Review issue and PR text, release assets and available CI artifacts separately.

The Vercel build checks the static `dist/` tree for credential filenames, secret values, private paths, stale Handoff files and archives. A checksum-pinned Gitleaks scan of the source and site must also pass before publication. The source scan excludes the top-level Git and Vercel working directories.

## Public repository protections

GitHub secret scanning covers the public repository’s history. Push protection checks incoming pushes for supported credential patterns. The former filename push rule is disabled. The local hooks check credential filenames before commits and pushes, and the Vercel build checks the publishing tree.

Changes to `main` go through a pull request. GitHub requires the branch to be up to date and the Vercel GitHub App’s `Vercel` check to pass. These protections apply to administrators. Force pushes and branch deletion are blocked.

GitHub Actions is disabled for this repository. Contributors run the Node suite and hook regression tests locally. The Vercel build runs the site and secret checks described above. To inspect their exact commands, see [vercel.json](vercel.json).

## Accepted dependency alerts

| Alert | Package | Decision | Re-check when |
| --- | --- | --- | --- |
| [Dependabot #1](https://github.com/OpenCoven/coven-compass/security/dependabot/1), GHSA-wrw7-89jp-8q8g (medium) | `glib` 0.18.5 in `src-tauri/Cargo.lock`. The fix is in 0.20.0 | Dismissed as tolerable risk by Val on 2026-11-22. The dependency chain is `tauri` 2.12.7 → `wry` 0.57.3 → `webkit2gtk` 2.0.2 / `gtk` 0.18. Those are Linux-only crates. No upgrade is possible: gtk3-rs ends at 0.18.2, and glib 0.20 belongs to gtk4-rs. The bundle target is a macOS `.app` only, so `glib` isn't compiled. Compass code doesn't use `VariantStrIter`. Coven Cave dismissed the same advisory, and its reachability analysis is in [coven-cave `docs/dependency-advisories.md`](https://github.com/OpenCoven/coven-cave/blob/main/docs/dependency-advisories.md): only `Variant::iter_str()` builds `VariantStrIter`, and no crate in Cave's tree calls it. That analysis was done for Cave and has not been re-run for this tree. | Before any Linux build or release, or when Tauri moves off GTK3. Either one reopens this decision. |
