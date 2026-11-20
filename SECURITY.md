# Security and publication

Report suspected credentials to a repository administrator through a private channel. Include the commit or deployment, affected service and location. Keep credential values out of issues, PRs, screenshots and scan reports. The credential owner should revoke or rotate an exposed value and check its use. Coordinate history changes with the maintainers after containment. Existing downloads, forks, clones and caches can retain old copies.

## Before contributing

Install Gitleaks 8.30.1 and run the following from a checkout. Run the installer again after the guard changes. It installs local copies of the scanners in this clone’s Git hooks directory, shared by its linked worktrees. It preserves unrelated hooks and stops if a named hook already exists.

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

A read-only GitHub Actions workflow can run the full Git scan and regression tests when Actions is enabled. Repository push rules can reject credential filenames before accepting new Git objects. Push rules match paths. A successful scan is evidence about the supplied bytes, rule set and revision. Encrypted archives, unsupported credential formats, external attachments, deleted remote refs and clones outside this repository require separate assessment.

## Public release checks

Build from the approved release snapshot. The private development history includes material intentionally omitted from that snapshot. Keep this history private and publish only a repository initialized from the reviewed files. Obtain Val’s approval before changing visibility or publishing a repository.

Changing a private repository to public disables its push rulesets. At publication, verify branch protection and required checks, enable repository secret scanning and push protection for supported credential patterns, and check bypass privileges. Local hooks and the public site scan also check credential filenames. An ordinary filename cannot be blocked across every public push by the current private-repository path rule. [GitHub visibility changes](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility) · [Repository security settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository)
