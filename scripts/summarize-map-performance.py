"""Summarize one unmodified map-performance.mjs output directory to stdout."""
import gzip
import json
import math
import statistics
import sys
from collections import Counter, defaultdict
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


def profile_windows(directory, report):
    """Align performance.now() with CDP microseconds using each User Timing mark."""
    prefix = directory / report["id"]
    with gzip.open(str(prefix) + ".trace.json.gz", "rt") as stream:
        events = json.load(stream)["traceEvents"]
    with gzip.open(str(prefix) + ".cpuprofile.gz", "rt") as stream:
        profile = json.load(stream)
    nodes = {node["id"]: node for node in profile["nodes"]}
    parent = {child: key for key, node in nodes.items() for child in node.get("children", [])}
    clock = profile["startTime"]
    cpu = []
    for node_id, delta in zip(profile["samples"], profile["timeDeltas"], strict=True):
        clock += delta
        while node_id is not None:
            frame = nodes[node_id]["callFrame"]
            if frame["url"].startswith(report["navigation"]["name"].split("#")[0]) and frame["functionName"]:
                cpu.append((clock, frame["functionName"]))
                break
            node_id = parent.get(node_id)
    marks = {e["name"]: e for e in events if e["name"].startswith("before: ")}
    windows = {}
    for sample in report["samples"]:
        if sample["phase"] != "profile":
            continue
        mark = marks["before: " + sample["name"]]
        origin = mark["ts"] - mark["args"]["data"]["startTime"] * 1000
        start, end = (origin + sample[key] * 1000 for key in ("start", "end"))
        kinds = ("Layout", "UpdateLayoutTree", "Paint", "PrePaint")
        spans = defaultdict(list)
        for event in events:
            if (event["pid"], event["tid"]) != (mark["pid"], mark["tid"]) or event["name"] not in kinds:
                continue
            left = max(start, event["ts"])
            right = min(end, event["ts"] + event.get("dur", 0))
            if right > left:
                spans[event["name"]].append((left, right))
        renderer = {}
        for kind, intervals in spans.items():
            # Union nested spans of the same category. Categories may overlap one another.
            covered = 0
            previous_end = start
            for left, right in sorted(intervals):
                covered += max(0, right - max(left, previous_end))
                previous_end = max(previous_end, right)
            renderer[kind] = {"events": len(intervals), "ms": round(covered / 1000, 2)}
        app_frames = Counter(fn for ts, fn in cpu if start <= ts <= end)
        windows[sample["name"]] = {
            "latencyMs": round(sample["ms"], 2), "renderer": renderer,
            "nearestNamedAppFrameSamples": dict(app_frames.most_common(5)),
        }
    return windows


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
        profiles = {}
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
            if any(s["phase"] == "profile" for s in report["samples"]):
                if (directory / (report["id"] + ".trace.json.gz")).is_file():
                    profiles[report["id"]] = profile_windows(directory, report)
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
        if profiles:
            cell["profiledInputWindows"] = profiles
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
