# Measuring the Compass map

Run the browser workload from an external Playwright installation. The runner uses the local simulation and opens a new Chromium context for every trial. It verifies every served file against the supplied Git revision before loading Compass. The checkout in which you invoke Node must contain that revision and its verifier. Choose a new output directory for each run.

## Reproduction

Use Node 24, Python 3, Playwright 1.48.2 and the Chromium revision Playwright installs. The recorded hardware and OS are in each run's `run.json`. These commands assume a shell in the PR checkout and a free loopback port. Run the server in its own terminal.

```sh
git worktree add --detach /tmp/compass-measured c15823626a073540c3a8a5bff08f018eb360a091
python3 -m http.server 18742 --bind 127.0.0.1 --directory /tmp/compass-measured/dist
```

```sh
mkdir -p /tmp/compass-perf-tools
npm install --prefix /tmp/compass-perf-tools playwright@1.48.2
/tmp/compass-perf-tools/node_modules/.bin/playwright install chromium
cp scripts/map-performance.mjs /tmp/compass-perf-tools/
revision=c15823626a073540c3a8a5bff08f018eb360a091
base=http://127.0.0.1:18742/
node /tmp/compass-perf-tools/map-performance.mjs "$base" "$revision" /tmp/compass-perf-matrix matrix
node /tmp/compass-perf-tools/map-performance.mjs "$base" "$revision" /tmp/compass-perf-soak soak
python3 scripts/summarize-map-performance.py /tmp/compass-perf-matrix > /tmp/compass-perf-matrix-summary.json
python3 scripts/summarize-map-performance.py /tmp/compass-perf-soak > /tmp/compass-perf-soak-summary.json
```

## Workload and clocks

The matrix runs five fresh contexts per workload and viewport in one browser process. It reverses the order of the six cells on alternate trials. Chromium renders at 1440 × 900 or 390 × 844 CSS pixels with device scale factor 1. The narrow context enables mobile layout and touch emulation on the same host. Camera input uses the stage's planar pan and zoom keys. Browser motion preferences stay at their defaults.

Every page loads the four-Project overview. Navigation Timing records the first document load. The 32- and 128-Project cells then measure the visitor's first activation of the layout preset. The runner takes a census through the simulation's existing worlds supplier and counts distinct seated familiar identities. The normal page registers and reads its simulation as usual. The census runs outside the timed interactions.

Each trial records one first journey, then repeats the same journey in the same document for its warmed sample. It filters Projects, selects psyche-build with Enter, pans and zooms, opens Missions, filters to Review readiness, focuses the single result with ArrowDown, opens it with Enter, and checks the names of all five tasks. It returns to the same filtered result, then the launcher, advances replay, restores the live simulation cursor, and returns to the overview. Keyboard focus, the selected mission and Project, result counts, camera movement, replay progress, and the overview route are checked along the way.

The latency clock starts at the browser's click, input, or keydown timestamp. At each animation frame the probe checks the expected DOM state. It stops at the next frame after the state matches and remains present through an intervening rendering opportunity. This includes browser scheduling and handler work and bounds time to the observable result. Physical display latency is unmeasured. Search replaces the field value in one input event. A sample's `trusted` flag records whether Chromium delivered genuine input. If a replay control is hidden, the runner uses DOM activation and reports `trusted: false`.

Frame records contain animation frame timestamps and intervals in milliseconds. Long tasks come from Chromium's PerformanceObserver. Both use the page's performance time origin. Summary frame and long-task distributions cover entire phases, including automation and replay dwell between inputs. The raw timestamps can be aligned with individual latency samples. Browser and OS caches can remain warm between fresh contexts.

The soak holds a single 128-Project narrow context open for at least 30 minutes of repeated warmed journeys. Each iteration includes an eight-second advancing replay and ends at the same live overview. The runner saves raw observations at each checkpoint. Attached element counts describe the current document. CDP node counts and JS heap include objects awaiting collection. Endpoint growth alone cannot establish a leak. The soak does not force garbage collection.

## Reading a run

`run.json` identifies the revision, runner digest, runtime, and host. `served.txt` contains the preflight HTTP digests. Per-scenario JSON contains input samples, workload census, heap and DOM checkpoints, and failure details. Concatenated gzip members in `*.frames.ndjson.gz` hold frame and long-task records with phase and iteration labels. Decompress with `gzip -dc`. The first dense trial in each matrix also records a separate profiled journey with CPU samples and a Chromium timeline. Decompress the timeline JSON for Chrome DevTools Performance or Perfetto and the CPU profile for the V8 profiler. User Timing marks bracket each input in the timeline. Profiled samples are reported separately from unprofiled latency.

A failed assertion or timeout ends that scenario, preserves its observations, and causes a nonzero run exit. The summary excludes failed journeys from the latency distributions and lists their failure details. It reports the sample count, minimum, median, nearest-rank p95, and maximum. With five observations p95 is the observed maximum.
