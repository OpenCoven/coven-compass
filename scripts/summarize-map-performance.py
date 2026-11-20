"""Summarize one unmodified map-performance.mjs output directory to stdout."""
import gzip
import json
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path


def stats(values):
    values = sorted(values)
    if not values:
        return {"n": 0}
    return {
        "n": len(values),
        "min": round(values[0], 2),
        "median": round(statistics.median(values), 2),
        "p95": round(values[math.ceil(len(values) * .95) - 1], 2),
        "max": round(values[-1], 2),
    }


def summarize(directory):
    meta = json.loads((directory / "run.json").read_text())
    cells = defaultdict(list)
    for file in sorted(directory.glob("*.json")):
        if file.name == "run.json":
            continue
        report = json.loads(file.read_text())
        cells[report["id"].rsplit("-", 1)[0]].append(report)
    summary = {"run": meta, "cells": {}, "failures": []}
    if meta["mode"] == "matrix":
        expected = {f"{size}-{n}" for size in ("desktop", "narrow") for n in (4, 32, 128)}
        if set(cells) != expected or any(len(reports) != 5 for reports in cells.values()):
            raise ValueError("Matrix is missing a workload, viewport or trial")
    if not meta.get("finished"):
        raise ValueError("Run has no terminal receipt")
    for key, reports in cells.items():
        samples = defaultdict(lambda: defaultdict(list))
        frame_times = defaultdict(list)
        long_tasks = defaultdict(list)
        attached = defaultdict(list)
        heap = defaultdict(list)
        checkpoints = []
        workloads = []
        loads = []
        for report in reports:
            if not report.get("passed"):
                summary["failures"].append({"id": report["id"], "failure": report.get("failure")})
                continue
            if report["workload"] not in workloads:
                workloads.append(report["workload"])
            loads.append(report["navigation"]["loadEventEnd"])
            for sample in report["samples"]:
                samples[sample["phase"]][sample["name"]].append(sample["ms"])
            with gzip.open(directory / (report["id"] + ".frames.ndjson.gz"), "rt") as stream:
                for line in stream:
                    chunk = json.loads(line)
                    phase = chunk["phase"]
                    frame_times[phase].extend(interval for _, interval in chunk["frames"])
                    long_tasks[phase].extend(duration for _, duration in chunk["longTasks"])
            if report["soak"]:
                checkpoints = [c for c in report["checkpoints"] if c["phase"] == "soak"]
            for c in report["checkpoints"]:
                attached[c["phase"]].append(c["attachedElements"])
                heap[c["phase"]].append(c["usedHeapBytes"])
        cell = {
            "scenarios": len(reports), "passed": len(loads), "workloads": workloads,
            "initialLoadEventEndMs": stats(loads),
            "latencyMs": {p: {op: stats(v) for op, v in ops.items()} for p, ops in samples.items()},
            "frameIntervalsMs": {p: stats(v) for p, v in frame_times.items()},
            "longTaskDurationMs": {p: stats(v) for p, v in long_tasks.items()},
            "attachedElements": {p: stats(v) for p, v in attached.items()},
            "usedHeapBytes": {p: stats(v) for p, v in heap.items()},
        }
        if checkpoints:
            cell["soakElapsedMs"] = reports[0]["soakElapsedMs"]
            cell["soakCheckpoints"] = {"first": checkpoints[0], "last": checkpoints[-1]}
        summary["cells"][key] = cell
    if len(summary["failures"]) != meta["failures"]:
        raise ValueError("Failure count differs from terminal receipt")
    return summary


if __name__ == "__main__":
    summary = summarize(Path(sys.argv[1]))
    print(json.dumps(summary, indent=2))
    sys.exit(bool(summary["failures"]))
