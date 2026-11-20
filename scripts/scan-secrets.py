#!/usr/bin/env python3
"""Scan immutable Git objects, including committed messages and deleted file versions."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

from secret_guard import SecretError, check_content, check_name


def git(*args):
    return subprocess.check_output(["git", *args])


def archive_suffix(data):
    # Git records blobs without extensions. Gitleaks selects archive readers by filename.
    signatures = ((b"PK\x03\x04", ".zip"), (b"\x1f\x8b", ".gz"), (b"BZh", ".bz2"),
                  (b"\xfd7zXZ\x00", ".xz"), (b"\x28\xb5\x2f\xfd", ".zst"),
                  (b"7z\xbc\xaf\x27\x1c", ".7z"))
    for prefix, suffix in signatures:
        if data.startswith(prefix):
            return suffix
    return ".tar" if data[257:262] == b"ustar" else ""


def scan_gitleaks(folder, private):
    # Supply our own config and ignore file, independent of checkout contents and local overrides.
    config = private / "defaults.toml"
    config.write_text("[extend]\nuseDefault = true\n")
    ignore = private / "empty.ignore"
    ignore.touch()
    report = private / "report.json"
    flags = ["--config", str(config), "--gitleaks-ignore-path", str(ignore), "--ignore-gitleaks-allow",
             "--redact=100", "--no-banner", "--max-archive-depth=3", "--max-decode-depth=3",
             "--report-format=json", "--report-path", str(report), "--exit-code=17"]
    env = {k: v for k, v in os.environ.items() if not k.startswith("GITLEAKS_")}
    result = subprocess.run(["gitleaks", "dir", *flags, str(folder)], env=env, cwd=private,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode == 17:
        for hit in json.loads(report.read_text()):
            # For Git scans filenames are object IDs. Paths in a publish directory may contain private data.
            name = Path(hit["File"]).stem
            where = name if re.fullmatch(r"[a-f0-9]{40,64}", name) else "publish directory"
            print(f"Secret check: {hit['RuleID']} in {where}, line {hit['StartLine']}", file=sys.stderr)
        raise SecretError("Gitleaks detected a candidate")
    if result.returncode:
        raise RuntimeError(f"Gitleaks could not complete (exit {result.returncode})")


def scan_objects(objects, folder):
    # Batch mode avoids one Git process per blob and reads binary content without text conversion.
    count = 0
    with subprocess.Popen(["git", "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE) as proc:
        try:
            for oid in dict.fromkeys(objects):
                proc.stdin.write(oid + b"\n")
                proc.stdin.flush()
                header = proc.stdout.readline().split()
                if len(header) != 3 or header[0] != oid:
                    raise RuntimeError("Git could not read a selected object")
                size = int(header[2])
                if size > 256 * 1024 * 1024:
                    raise RuntimeError("Git object exceeds scan limit: " + oid.decode())
                data = proc.stdout.read(size)
                if len(data) != size or proc.stdout.read(1) != b"\n":
                    raise RuntimeError("Incomplete Git object")
                try:
                    if header[1] == b"tree":
                        # ls-tree uses Git's own decoding for arbitrary filenames and object formats.
                        for name in git("ls-tree", "--full-tree", "-z", "--name-only", oid).split(b"\0"):
                            check_name(os.fsdecode(name))
                    check_content(data)
                except SecretError as err:
                    raise SecretError(f"{err} in object {oid.decode()}") from None
                if header[1] != b"tree":
                    (folder / (oid.decode() + archive_suffix(data))).write_bytes(data)
                count += 1
        finally:
            proc.stdin.close()
        if proc.wait():
            raise RuntimeError("git cat-file failed")
    return count


def scan_directory(folder, private):
    if not folder.is_dir():
        raise ValueError("Expected a directory")
    disguised_archives = private / "archives"
    for entry in folder.rglob("*"):
        check_name(entry.relative_to(folder).as_posix())
        if entry.is_symlink():
            raise SecretError("symlink in publish directory")
        if entry.is_file():
            data = entry.read_bytes()
            check_content(data)
            suffix = archive_suffix(data)
            if suffix and not entry.name.lower().endswith(suffix):
                disguised_archives.mkdir(exist_ok=True)
                (disguised_archives / (hashlib.sha256(data).hexdigest() + suffix)).write_bytes(data)
    if disguised_archives.exists():
        scan_gitleaks(disguised_archives, private)
    scan_gitleaks(folder, private)


def execute(mode, path):
    with tempfile.TemporaryDirectory(prefix="compass-secret-scan-") as tmp:
        private = Path(tmp).resolve()
        folder = private / "objects"
        folder.mkdir()
        if mode == "source":
            root = Path(path).resolve(strict=True)
            if private.is_relative_to(root):
                raise RuntimeError("Set TMPDIR outside the source tree")
            # These top-level directories belong to Git and Vercel. The entire dist/ is scanned.
            def platform_files(directory, names):
                return {".git", ".vercel"} if Path(directory) == root else set()
            shutil.copytree(root, folder, dirs_exist_ok=True, symlinks=True, ignore=platform_files)
            scan_directory(folder, private)
        elif mode == "directory":
            scan_directory(Path(path).resolve(strict=True), private)
        elif mode == "message":
            data = Path(path).read_bytes()
            check_content(data)
            (folder / "commit-message").write_bytes(data)
            scan_gitleaks(folder, private)
        else:
            if mode == "staged":
                # write-tree captures the entire index, including partial stages, renames and nested filenames.
                tip = git("write-tree").strip()
                objects = [tip] + [item.split(None, 3)[2] for item in git("ls-tree", "--full-tree", "-r", "-t", "-z", tip).split(b"\0") if item and item.split(None, 2)[1] != b"commit"]
            else:
                if git("rev-parse", "--is-shallow-repository").strip() != b"false":
                    raise RuntimeError("Fetch complete Git history before scanning")
                refs = ["--all"]
                if mode == "pre-push":
                    refs = []
                    for line in sys.stdin.buffer:
                        _, oid, _, _ = line.split()
                        if oid.strip(b"0"):
                            refs.append(oid.decode("ascii"))
                    if not refs:
                        return
                objects = git("rev-list", "--objects", "--no-object-names", *refs).splitlines()
            count = scan_objects(objects, folder)
            scan_gitleaks(folder, private)
            print(f"Scanned {count} unique Git objects ({mode})")
    print("Secret scan passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["history", "staged", "pre-push", "message", "directory", "source"])
    parser.add_argument("path", nargs="?")
    args = parser.parse_args()
    if (args.mode in {"message", "directory", "source"}) != bool(args.path):
        parser.error("message, source and directory require one path; Git modes take none")
    try:
        execute(args.mode, args.path)
    except (SecretError, OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print("Secret scan failed:", error, file=sys.stderr)
        sys.exit(1)
