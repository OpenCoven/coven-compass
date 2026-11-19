# Proposed adapter examples

These JSON files are **documentation fixtures**, not canonical OpenCoven schemas, endpoints, credentials, grants, or executable requests. No production API mapping was verified while preparing them. Every identifier beginning with `fixture:` is invented sample data. Dates are illustrative and must not be reused as live authorization windows.

- [proposed-atlas-projection.json](proposed-atlas-projection.json) separates a daemon-shaped read projection from the client’s connection/freshness observation. It demonstrates a disconnected, stale view of a mission awaiting a decision. That old observation does not prove the remote attempt is currently stopped.
- [proposed-command-intent.json](proposed-command-intent.json) shows a locally drafted resource-limit-change intent, exact identity references and concurrency preconditions. It is deliberately expired sample data. Its `draft` UI state and null receipt cannot be interpreted as authoritative proposal acceptance or a committed operation.

## How to use them

First locate the actual canonical contract and SDK types. Create a mapping table from every relevant field here to its real owner/type, or mark the field unsupported. Replace provisional names and enums with those bindings rather than making these examples a new schema registry. Discard a field that has no supported meaning; do not manufacture it from display labels.

Parse these files as inert test data only. Neither their `producer_hint` nor their supplied revision strings establish trust. The application must derive authenticated transport context, scope and freshness from the canonical session/envelope behavior. Credentials and final authority decisions are outside a client intent payload. `ui_hints` describe a fixture’s presentation and are never enforcement.

Use them to test unavailable/stale rendering, pending-versus-committed presentation, fixture identity binding, and rejection of unrecognized operation names. They do not exercise authentication, daemon persistence, replay protection, lease enforcement or external effects. See [security and authority](../docs/handoff/09-security-and-authority.md) and [open decisions](../docs/handoff/11-open-decisions.md) before introducing a live adapter.

