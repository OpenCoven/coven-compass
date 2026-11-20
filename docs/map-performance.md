# Measuring the Compass map

Run the browser workload from an external Playwright installation. The runner uses the local simulation and opens a new Chromium context for every trial. It verifies every served file against the supplied Git revision before loading Compass. The checkout in which you invoke Node must contain that revision and its verifier. Choose a new output directory for each run.

## November 20 baseline and decision

Returning from a Project to the Coven overview is the first interaction to investigate. At 128 Projects its warmed median was 116–128 ms across both runs and viewports, compared with 66–79 ms at 32 Projects. All 60 matrix journeys used fresh Chromium contexts and completed both their first and warmed passes. All recorded input samples in the two matrices were trusted browser events. [Primary measurements](../tests/evidence/map-performance-2026-11-20/main-matrix.json) · [Clean reproduction](../tests/evidence/map-performance-2026-11-20/repro-matrix.json)

The measured revision is `c15823626a073540c3a8a5bff08f018eb360a091`, the merge of PR #49, with `dist/` tree `0d2f6427615a8aa272693621a45acf6e203f9e33`. The reproduction served the same bytes from a separate clean worktree at tooling commit `8b11fa16c8d2f189ccd66077ebb7edb24cd6c8a4`. Both ran headless Chromium 130.0.6723.31 with Playwright 1.48.2 and Node 24.22.0 on an Apple M5 Max MacBook Pro (Mac17,6, 18 logical CPUs, 128 GiB RAM, macOS 27.2.1). The runner digest and all HTTP checksums are in each raw archive. Physical phones, Safari, assistive technology, other hardware, production hosting, and larger or differently composed worlds remain unmeasured.

Each timing cell below gives primary / reproduction medians in milliseconds. Each median covers five unprofiled warmed journeys per run. The four seated familiar identities were Astra, Charm, Cody, and Echo at every workload.

| Projects | Missions | Tasks | Agents | Return to overview, desktop | Return to overview, narrow |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 7 | 23 | 114 | 28.8 / 31.7 | 34.9 / 57.2 |
| 32 | 56 | 184 | 912 | 65.6 / 79.0 | 67.1 / 75.2 |
| 128 | 224 | 736 | 3,648 | 128.4 / 115.8 | 121.2 / 122.6 |

The overview return had the largest median increase from 4 to 128 Projects on desktop in both runs (+99.6 and +84.1 ms) and on narrow in the primary run (+86.3 ms). In the narrow reproduction, opening Missions rose from 24.2 to 95.2 ms (+71.0), ahead of overview return (+65.4). Individual 128-Project overview returns ranged from 102.1 to 146.2 ms across the two matrices. At this density the p95 frame interval over the entire warmed journey was 50–67 ms on desktop and 50 ms on narrow. Both 32-Project runs were about 33 ms at p95.

The two dense desktop profiles each recorded 150 Layout events inside a single overview return. Layout occupied 61 and 54 ms and style recalculation occupied 43 and 40 ms in the respective windows. Paint occupied about 1 ms in each. Both CPU profiles sampled `project` and `atlasProjectGhost` during that input. The latter reads stage dimensions for each Project and updates its SVG attributes. The overview-return measurements below compare this baseline with a version that reads the stage dimensions once per frame.

Initial document load always boots the four-Project map. Across 30 fresh contexts per run, median navigation-to-load was 364 ms in the first matrix and 339 ms in the second. The larger presets have a separate first-use cost. For example, populating 128 Projects on desktop took 115 ms and 136 ms at the median. Each raw report also separates first use of Missions from repeated use of its existing drawer.

### Repeated navigation and replay

Each dense narrow soak used one document for its full duration and returned to the live simulation overview after every replay. The primary run completed 143 cycles in 1,800.31 seconds. The reproduction completed 146 in 1,801.72 seconds. Neither recorded a failed journey or page error. The p95 frame interval was 33.3 ms in both. The worst observed gaps were 133.4 and 233.7 ms. [Primary soak summary](../tests/evidence/map-performance-2026-11-20/main-soak.json) · [Reproduction soak summary](../tests/evidence/map-performance-2026-11-20/repro-soak.json)

| Same-overview checkpoint | Primary, first → last (peak) | Reproduction, first → last (peak) |
| --- | ---: | ---: |
| Attached elements | 11,844 → 12,244 (13,803) | 12,134 → 11,954 (12,904) |
| Used JS heap, MiB | 8.9 → 9.0 (14.6) | 8.2 → 10.2 (14.1) |
| CDP nodes, including detached nodes awaiting collection | 24,467 → 26,896 | 24,451 → 27,207 |

The attached-element endpoint increased in the first run and decreased in the reproduction. Renderer node counts ended higher in both runs, while used heap rose and fell during each run. These observations leave retained-object growth unresolved. A heap-retention investigation would need additional evidence such as object retainers across controlled garbage collections.

### Overview-return budget

The regression budget is **at most 100 ms** for the median warmed Project-to-overview return across five fresh contexts, evaluated separately at 4, 32, and 128 Projects on desktop and narrow. It applies to the reference hardware, Chromium version, sample composition and measurement runner above. Product support on other configurations requires its own evidence.

Run `python3 scripts/check-overview-budget.py <matrix-output-directory>` after the external browser matrix. It compares the unrounded median and prints each observed range. Exit 0 means all six cells met budget. Exit 1 identifies an over-budget cell. Exit 2 identifies incomplete or inapplicable evidence. Both historical baseline matrices exceeded budget at 128 Projects on both viewports.

### Renderer comparison

The baseline served `c15823626a073540c3a8a5bff08f018eb360a091`. The frame-scale change at `68ddbebc94243cabf823fbc455ab3f993c1d7309` reads the stage dimensions once per frame and shares its scale across Project tiles. The candidate at `e7bb5a38ef76536ef94148db91a586cec5f664be` also measures a mission name in a single SVG text run while fitting its words. Each column is a separate matrix on the reference host. Each value is an unprofiled warmed median in milliseconds over five fresh contexts.

| Viewport | Projects | Baseline | Frame scale | Frame scale repeat | Candidate | Candidate repeat |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | 4 | 27.3 | 27.0 | 27.1 | 24.8 | 24.7 |
| desktop | 32 | 71.1 | 42.1 | 36.7 | 45.6 | 34.1 |
| desktop | 128 | 118.3 | 91.8 | 114.2 | 102.3 | 83.9 |
| narrow | 4 | 57.4 | 29.1 | 58.9 | 37.1 | 29.1 |
| narrow | 32 | 71.4 | 74.7 | 69.2 | 65.9 | 61.3 |
| narrow | 128 | 131.2 | 112.7 | 110.3 | 116.0 | 104.2 |

Each matrix completed all 30 journeys, including checks on Project selection, mission counts, keyboard focus, replay and return to the overview. The two candidate matrices met the budget through 32 Projects on both viewports. The 128-Project workload remains a stress case. The observed latency includes the browser’s frame scheduling.

During the separately profiled 128-Project desktop return, the baseline recorded 150 Layout events. Each candidate run recorded 15. Across those same three windows, time in Layout was 73.6 ms, 49.2 ms and 46.5 ms, respectively. Each profile covers one return. The unprofiled medians above determine the budget result.

Run a fresh measurement and pass its output directory to the budget checker or to `scripts/summarize-map-performance.py` for the complete breakdown. Each archive includes the served-file checksums, input observations, frame records and Chromium profiles.

## Reproduction

Use Node 24, Python 3, Playwright 1.48.2 and the Chromium revision Playwright installs. The recorded hardware and OS are in each run's `run.json`. These commands assume a shell in the PR checkout and a free loopback port. Run the server in its own terminal.

```sh
python3 -m http.server 18742 --bind 127.0.0.1 --directory dist
```

```sh
scratch=$(mktemp -d)
mkdir -p "$scratch/tools"
npm install --prefix "$scratch/tools" playwright@1.48.2
"$scratch/tools/node_modules/.bin/playwright" install chromium
cp scripts/map-performance.mjs "$scratch/tools"/
revision=$(git rev-parse HEAD)
base=http://127.0.0.1:18742/
node "$scratch/tools/map-performance.mjs" "$base" "$revision" "$scratch/matrix" matrix
node "$scratch/tools/map-performance.mjs" "$base" "$revision" "$scratch/soak" soak
python3 scripts/summarize-map-performance.py "$scratch/matrix" > "$scratch/matrix-summary.json"
python3 scripts/summarize-map-performance.py "$scratch/soak" > "$scratch/soak-summary.json"
```

## Workload and clocks

The matrix runs five fresh contexts per workload and viewport in one browser process. It reverses the order of the six cells on alternate trials. Chromium renders at 1440 × 900 or 390 × 844 CSS pixels with device scale factor 1. The narrow context enables mobile layout and touch emulation on the same host. Camera input uses the stage's planar pan and zoom keys. Browser motion preferences stay at their defaults.

Every page loads the four-Project overview. Navigation Timing records the first document load. The 32- and 128-Project cells then measure the visitor's first activation of the layout preset. The runner takes a census through the simulation's existing worlds supplier and counts distinct seated familiar identities. The normal page registers and reads its simulation as usual. The census runs outside the timed interactions.

Each trial records one first journey, then repeats the same journey in the same document for its warmed sample. It filters Projects, selects psyche-build with Enter, pans and zooms, opens Missions, filters to Review readiness, focuses the single result with ArrowDown, opens it with Enter, and checks the names of all five tasks. It returns to the same filtered result, then the launcher, advances replay, restores the live simulation cursor, and returns to the overview. Keyboard focus, the selected mission and Project, result counts, camera movement, replay progress, and the overview route are checked along the way.

The latency clock starts at the browser's click, input, or keydown timestamp. At each animation frame the probe checks the expected DOM state. It stops at the next frame after the state matches and remains present through an intervening rendering opportunity. This includes browser scheduling and handler work and bounds time to the observable result. Physical display latency is unmeasured. Search replaces the field value in one input event. A sample's `trusted` flag records whether Chromium delivered genuine input. If a replay control is hidden, the runner uses DOM activation and reports `trusted: false`.

Frame records contain animation frame timestamps and intervals in milliseconds. Long tasks come from Chromium's PerformanceObserver. Both use the page's performance time origin. Summary frame and long-task distributions cover entire phases, including automation and replay dwell between inputs. The raw timestamps can be aligned with individual latency samples. Browser and OS caches can remain warm between fresh contexts.

The soak holds a single 128-Project narrow context open for at least 30 minutes of repeated warmed journeys. Each iteration includes an eight-second advancing replay and ends at the same live overview. The runner saves raw observations at each checkpoint. Attached element counts describe the current document. CDP node counts and JS heap include objects awaiting collection. Endpoint growth alone cannot establish a leak. The soak does not force garbage collection.

Use the summarizer on your own run directory to reproduce the report format. Maintainers retain the historical raw archives separately because they contain browser traces and machine metadata.

## Earlier candidate and retained failures

Issue #40 was claimed against the then-open PR #49 head `affeb1df608ba4a4d6145816784e2d74f2a929f4`. The first dense pilot timed out at both viewports because the harness expected opening Projects to focus its search field. Compass focuses the active Project row. Both corrected pilot journeys passed. The first soak on that head was interrupted during its seventeenth cycle after #49 merged with changes to the served map. The pilot reports, failed predicates, frame records, and partial soak are retained separately. Every reported baseline number above comes from the integrated build.

## Reading a run

`run.json` identifies the revision, runner digest, runtime, and host. `served.txt` contains the preflight HTTP digests. Per-scenario JSON contains input samples, workload census, heap and DOM checkpoints, and failure details. Concatenated gzip members in `*.frames.ndjson.gz` hold frame and long-task records with phase and iteration labels. Decompress with `gzip -dc`. The first dense trial in each matrix also records a separate profiled journey with CPU samples and a Chromium timeline. Decompress the timeline JSON for Chrome DevTools Performance or Perfetto and the CPU profile for the V8 profiler. User Timing marks bracket each input in the timeline. Profiled samples are reported separately from unprofiled latency.

A failed assertion or timeout ends that scenario, preserves its observations, and causes a nonzero run exit. The summary excludes failed journeys from the latency distributions and lists their failure details. It reports the sample count, minimum, median, nearest-rank p95, and maximum. With five observations p95 is the observed maximum.

The summary also aligns each profiled input's browser timestamp with the renderer timeline using the matching User Timing mark. Within that input's measured window it reports the number and union duration of style, layout and paint events on the renderer thread. Different categories can overlap. CPU sample counts use the nearest named Compass frame on each sampled stack. This helps locate code to investigate and cannot assign exclusive cost or predict an optimization's benefit.
