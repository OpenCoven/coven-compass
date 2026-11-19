# Working on Coven Compass

Use Node.js 24 and Python 3.10 or newer. From the checkout root, run `sh scripts/verify-checkout.sh`. This runs the source checker, all Node tests, the crown checks, and the handoff builder and ZIP verifier. The builder refreshes the tracked guide, manifest, and checksums and writes the ignored archive under `dist/downloads/`. Review generated diffs alongside their source changes.

| Change | Edit | Focused check |
| --- | --- | --- |
| Project form and mission inspector | `dist/index.html` | `node --test tests/mission-interactions.test.cjs` and exercise the form in a desktop and narrow browser |
| Routes and mission browser | `dist/mission-navigation.js`, `dist/atlas-ui.js`, and bindings in `dist/index.html` | `node --test tests/navigation.test.cjs tests/mission-interactions.test.cjs` |
| Map and camera | `dist/atlas-layout.js`, `dist/atlas-viewport.js` | `node --test tests/atlas-layout.test.cjs tests/atlas-viewport.test.cjs` |
| Mobile controls and focus | `dist/mobile-ui.js`, `dist/mobile-interactions.js`, `dist/atlas.css` | `node --test tests/mobile-*.test.cjs` |
| Handoff | Edit chapters in `docs/handoff/` or the landing page in `dist/handoff/index.html`. The builder generates `dist/handoff/guide.html`. | Run the checkout command and follow Handoff in the browser. |

Preview with `python3 -m http.server 8000 --bind 127.0.0.1 --directory dist`. The app runs as a local simulation. Preserve the historical fixtures and evidence in `tests/fixtures/` and `tests/evidence/`. For an extracted delivery, run `python3 scripts/verify-handoff.py .` before editing it. The strict inventory includes only delivered files.
