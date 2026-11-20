# Getting started with Compass

See the [README](README.md) to run the map locally and [AGENTS.md](AGENTS.md) for the contributor workflow.

## Where to make a change

| Change | Editable source | Focused check |
| --- | --- | --- |
| Project and mission navigation | `dist/mission-navigation.js`, `dist/atlas-ui.js`, and their app bindings in `dist/index.html` | `node --test tests/navigation.test.cjs tests/mission-interactions.test.cjs` |
| Map placement and camera | `dist/atlas-layout.js`, `dist/atlas-viewport.js` | `node --test tests/atlas-layout.test.cjs tests/atlas-viewport.test.cjs` |
| Mobile controls and focus | `dist/mobile-ui.js`, `dist/mobile-interactions.js`, `dist/atlas.css` | `node --test tests/mobile-*.test.cjs` |
