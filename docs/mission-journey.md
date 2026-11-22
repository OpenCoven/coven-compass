# Review the mission journey

Start at the Coven overview and open Missions. Choose a Project, name a mission, choose a familiar and customize its brief. After creating it, close the brief and select the familiar’s task group on the map. The card identifies the group and its staffing. On a phone, opening Activity keeps the selected group visible above or beside the conversation.

For recorded work, import [the mission history recording](../tests/recordings/mission-history.jsonl) from the Trace menu. Open Publication review and choose History. Events 6 and 7 share a timestamp. The first moves worker-1 from Draft notes to Check sources. The second opens a decision. Event 8 records its resolution. Use Show on map, then Return to History to return to that event and its control.

## Candidate composition

The qualification branch started from `823c99ebc37722f5cf0dba3280a3a0355087484d` and incorporates remote main at `64e90a28feeddd5650dc210045e1ab4bd412727e`, including the viewport and layout migrations in #90 and #93. The following PR heads are present in its Git ancestry, in integration order.

| PR | Head | Contribution | PR dependency |
| --- | --- | --- | --- |
| [#88](https://github.com/OpenCoven/coven-compass/pull/88) | `02c9005ce7d8a03410ec37a73004d1270862db30` | Replay controls and mission cards | main |
| [#89](https://github.com/OpenCoven/coven-compass/pull/89) | `c4dc693d728562bfee6ef11491777efbd751d00f` | Mission-scoped request review | main |
| [#91](https://github.com/OpenCoven/coven-compass/pull/91) | `ba394dcca63ba2e6a4e3acbb0fa0f05a9f5753e8` | Exact recording bookmarks | #89 |
| [#92](https://github.com/OpenCoven/coven-compass/pull/92) | `851a797bddf6e035f54f7263a2347c882634549c` | Mission browser and creation entry | main |
| [#94](https://github.com/OpenCoven/coven-compass/pull/94) | `dd8da98746e981d90d10f6ce5efd46ae38f83b92` | Pending requests and resource limits | #92 |
| [#96](https://github.com/OpenCoven/coven-compass/pull/96) | `fb459189c564b9ac0b4f0d627efb327c453ba9b6` | Mission captions and task actions | main |
| [#97](https://github.com/OpenCoven/coven-compass/pull/97) | `4329ee3288fca1fd0ea27ac27c92dcdda0ccf280` | Responsive timeline and event detail | main |
| [#98](https://github.com/OpenCoven/coven-compass/pull/98) | `41a17b0ea8837137a22cb47942e6d6d0d21ee89e` | Compass branding in the workspace | main |
| [#99](https://github.com/OpenCoven/coven-compass/pull/99) | `ce3fa64079ab8ea4dd748538ed8fab7d31abad61` | Editable brief and immediate inspector | #92 |
| [#100](https://github.com/OpenCoven/coven-compass/pull/100) | `f08401144bd281ffd6c04946e294b813ea69c333` | Scaled cards and camera fit | main |

Val can merge the qualified integration PR once with a merge commit to preserve these heads and the conflict resolutions. For individual merges, follow the table order and apply the integration fixes before accepting the result. The blocked Castle identity, brief policy proposal, and Actions workflow PRs are independent of this journey.

## Reproduce the qualification

Use Node 24, Python 3 and Playwright 1.64.1 with its Chromium and WebKit binaries. Install browser tooling outside the checkout. From the candidate root, set `qa` to that external directory and serve the site in a separate terminal.

```sh
npm --prefix src ci
node scripts/verify-all.mjs --check
python3 -m http.server 18575 --bind 127.0.0.1 --directory dist
```

```sh
url=http://127.0.0.1:18575
shots=$(mktemp -d)
cp scripts/mission-{journey-qa,history-qa,request-qa,history-performance}.mjs scripts/{approval-replay,replay-bookmark,project-preview,plan}-qa.mjs "$qa/"
node scripts/verify-served.mjs "$url/" "$(git rev-parse HEAD)"
for engine in chromium webkit; do
  COMPASS_JOURNEY_SHOTS="$shots" node "$qa/mission-journey-qa.mjs" "$url" "$engine" || exit 1
  for mode in keyboard touch landscape; do
    node "$qa/mission-history-qa.mjs" "$url" "$engine" "$mode" tests/recordings/mission-history.jsonl "$shots" || exit 1
  done
  node "$qa/mission-request-qa.mjs" "$url" tests/recordings/approval-replay.jsonl "$engine" || exit 1
  node "$qa/replay-bookmark-qa.mjs" "$url" tests/recordings/approval-replay.jsonl "$engine" "$shots" || exit 1
done
node "$qa/approval-replay-qa.mjs" "$url" tests/recordings/approval-replay.jsonl
node "$qa/project-preview-qa.mjs" "$url"
node "$qa/plan-qa.mjs" "$url"
node "$qa/mission-history-performance.mjs" "$url"
```

The creation check reads the saved time limit and measures the selected task plane, each painted agent, and the detail card across a resize and after opening Psyche. The history check compares equal-timestamp events by trace position and checks the mission, range, scroll, and focused control on return. The dense-map runner reports its workload and five individual timings using the browser clock. These are local browser measurements. Physical-device accessibility and a supported capacity budget have separate tracking issues, #39 and #40.
