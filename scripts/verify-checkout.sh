#!/bin/sh
# Run from the repository root using Node 24 and Python 3.10+.
set -eu

run() {
    label=$1
    shift
    printf '\nChecking %s\n' "$label"
    "$@" || {
        result=$?
        printf 'Failed at %s (exit %s)\n' "$label" "$result" >&2
        exit "$result"
    }
}

archive=dist/downloads/Coven_Compass_Handoff_2026-11-19.zip
run 'source' node scripts/check-source.mjs
run 'Node tests' node --test tests/*.test.cjs
run 'crown' node scripts/test-atlas-crown.mjs
run 'handoff build' python3 scripts/build-handoff.py --output "$archive"
run 'archive verification' python3 scripts/verify-handoff.py "$archive"
