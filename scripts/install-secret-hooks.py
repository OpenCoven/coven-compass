#!/usr/bin/env python3
"""Install the guard in this clone. Other clones must opt in separately."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

SOURCE = Path(__file__).resolve().parent
MARK = "# Installed by Compass install-secret-hooks.py"
MODES = {"pre-commit": "staged", "commit-msg": 'message "$1"', "pre-push": "pre-push"}


def install():
    subprocess.run(["gitleaks", "version"], check=True)
    configured = subprocess.run(["git", "config", "--get", "core.hooksPath"], capture_output=True)
    if configured.returncode != 1:
        sys.exit("A custom hooks path is configured or unreadable. Integrate the three documented hook commands there.")
    common = Path(subprocess.check_output(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], text=True).strip())
    hooks = common / "hooks"
    hooks.mkdir(exist_ok=True)
    for name in MODES:
        dest = hooks / name
        if dest.is_symlink() or (dest.exists() and MARK not in dest.read_text().splitlines()[:2]):
            sys.exit(f"Existing {name} hook found. Integrate the documented command without replacing that hook.")
    sources = [SOURCE / "scan-secrets.py", SOURCE / "secret_guard.py"]
    version = hashlib.sha256(b"\0".join(p.read_bytes() for p in sources)).hexdigest()[:16]
    bundle = hooks / ("compass-guard-" + version)
    bundle.mkdir(exist_ok=True)
    for p in sources:
        shutil.copyfile(p, bundle / p.name)
    for name, mode in MODES.items():
        with tempfile.NamedTemporaryFile("w", dir=hooks, delete=False) as wrapper:
            wrapper.write(f'#!/bin/sh\n{MARK}\nexec python3 "$(dirname "$0")/{bundle.name}/scan-secrets.py" {mode}\n')
        os.chmod(wrapper.name, 0o755)
        os.replace(wrapper.name, hooks / name)
    print("Installed pre-commit, commit-msg and pre-push secret checks in this clone.")


if __name__ == "__main__":
    install()
