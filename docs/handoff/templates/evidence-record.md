# Evidence record — template

## Identity of the check

- Packet / issue / PR:
- Repository and exact source commit:
- Build/package identity and digest, if applicable:
- Platform, architecture, tool versions:
- Environment: fixture / source / real daemon / packaged CLI / native client / remote host / human acceptance
- Start/end timestamp and timezone:
- Executor and reviewer:

## Claim under examination

State one claim and the source of its expected behavior. Specify whether the check verifies implementation, conformance, authorization, persistence, recovery, interoperability, or only presentation.

## Reproduction

```text
Exact commands, setup, inputs, and faults injected.
Use synthetic data. Do not include tokens, raw credentials, private memory, or personal conversations.
```

## Result

- Exit codes and pass/fail/skip counts:
- Observed state before/after:
- Canonical object revisions / lease or attempt identifiers:
- Receipts or redacted trace references:
- Expected refusal or failure evidence:
- Artifact paths and hashes:
- RED baseline and GREEN patched result, where applicable:

## Limits

- What this check does not establish:
- Skipped checks and reasons:
- Known failures / unknown commit outcomes:
- Recovery performed:
- Next acceptance check:

“Not run,” “blocked,” “failed,” and “unknown” are distinct outcomes. Preserve them. A claim becomes verified only at the scope the evidence actually exercises.
