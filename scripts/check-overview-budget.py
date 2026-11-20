"""Check the Compass overview-return budget in a completed map-performance.mjs matrix."""
import argparse
import json
import math
import statistics
import sys
from pathlib import Path


BUDGET_MS = 100
REFERENCE = {
    "mode": "matrix", "model": "Mac17,6", "cpu": "Apple M5 Max", "ramBytes": 128 * 1024**3,
    "runnerSha256": "a75e5a455ca9117a530b2b1b91ec7507fbeb4235ff6b61cd1676894583f05816",
    "logicalCpus": 18, "node": "v24.22.0", "macOS": "27.2.1", "browser": "130.0.6723.31", "playwright": "1.48.2",
}
WORKLOADS = {4: (7, 23, 114), 32: (56, 184, 912), 128: (224, 736, 3648)}
VIEWPORTS = {"desktop": (1440, 900), "narrow": (390, 844)}


def warmed_return(directory, size, projects, trial):
    name = f"{size}-{projects}-{trial}"
    row = json.loads((directory / f"{name}.json").read_text())
    width, height = VIEWPORTS[size]
    workload = row["workload"]
    if (row["id"] != name or row["trial"] != trial or row["passed"] is not True or row["errors"] != []
            or row["soak"] is not False or row["projects"] != projects
            or row["viewport"] != {"width": width, "height": height}
            or workload["projects"] != projects
            or (workload["missions"], workload["tasks"], workload["agents"]) != WORKLOADS[projects]
            or workload["seatedFamiliars"] != ["astra", "charm", "cody", "echo"]):
        raise ValueError(f"{name}: expected a successful journey at the requested workload and viewport")
    returns = [s for s in row["samples"] if s["phase"] == "warm" and s["name"] == "return to overview"]
    if len(returns) != 1 or returns[0].get("trusted") is not True:
        raise ValueError(f"{name}: expected one warmed return from trusted input")
    ms = returns[0]["ms"]
    if type(ms) not in (float, int) or not math.isfinite(ms) or ms <= 0:
        raise ValueError(f"{name}: invalid elapsed time {ms!r}")
    return ms


def check(directory):
    meta = json.loads((directory / "run.json").read_text())
    if not isinstance(meta, dict):
        raise ValueError("Expected matrix metadata in run.json")
    for key, expected in REFERENCE.items():
        if meta.get(key) != expected:
            raise ValueError(f"{key}: budget applies to {expected!r}, observed {meta.get(key)!r}")
    if not meta.get("finished") or meta.get("failures") != 0:
        raise ValueError("A complete matrix with all journeys passing is required")

    passed = True
    print(f"Overview return on {meta['revision']}, budget <= {BUDGET_MS} ms")
    for size in VIEWPORTS:
        for projects in WORKLOADS:
            values = [warmed_return(directory, size, projects, trial) for trial in range(1, 6)]
            median = statistics.median(values)
            within = median <= BUDGET_MS
            print(f"{'PASS' if within else 'OVER'} {size:7} {projects:3} Projects: {median:.3f} ms median "
                  f"(n={len(values)}, {min(values):.3f}–{max(values):.3f} ms)")
            passed = passed and within
    return 0 if passed else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    try:
        sys.exit(check(parser.parse_args().directory))
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(2, f"Unqualified measurement: {error}\n")
