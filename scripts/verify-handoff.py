#!/usr/bin/env python3
"""Verify handoff ZIP or extracted files (Python 3.10+); never execute bundled code."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
from typing import BinaryIO
import unicodedata
import zipfile
import zlib


ARCHIVE_ROOT = "Coven_Castles_Atlas_Handoff_2026-11-18"
BASELINE_COMMIT = "d7b6f1e655140036cca49f31687131352162de13"
MANIFEST = "HANDOFF_MANIFEST.json"
CHECKSUMS = "CHECKSUMS.sha256"
RESERVED = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)),
            *(f"lpt{i}" for i in range(1, 10))}
MAX_FILES = 10000
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_TOTAL_BYTES = 256 * 1024 * 1024
MAX_METADATA_BYTES = 8 * 1024 * 1024


class VerificationError(ValueError):
    pass


@dataclass
class Record:
    size: int
    digest: str
    content: bytes | None = None


def safe_path(value: str, *, directory: bool = False) -> str:
    if directory and value.endswith("/"):
        value = value[:-1]
    if not value or "\\" in value or any(ord(c) < 32 for c in value):
        raise VerificationError(f"Unsafe path: {value!r}")
    parts = value.split("/")
    if any(p in ("", ".", "..") or ":" in p or p.endswith((" ", ".")) for p in parts):
        raise VerificationError(f"Unsafe path: {value!r}")
    if any(p.split(".")[0].casefold() in RESERVED for p in parts):
        raise VerificationError(f"Reserved path: {value!r}")
    return value


def portable_key(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


def housekeeping(value: str) -> bool:
    return any(p == "__MACOSX" or p == ".DS_Store" or p.startswith("._") for p in PurePosixPath(value).parts)


def hash_stream(stream: BinaryIO, name: str) -> Record:
    digest = hashlib.sha256()
    size = 0
    pieces: list[bytes] | None = [] if name in (MANIFEST, CHECKSUMS) else None
    while chunk := stream.read(1024 * 1024):
        size += len(chunk)
        if size > MAX_FILE_BYTES:
            raise VerificationError(f"File exceeds the supported size limit: {name}")
        digest.update(chunk)
        if pieces is not None:
            if size > MAX_METADATA_BYTES:
                raise VerificationError(f"Metadata exceeds the supported size limit: {name}")
            pieces.append(chunk)
    return Record(size, digest.hexdigest(), b"".join(pieces) if pieces is not None else None)


def check_tree_paths(paths: dict[str, bool]) -> None:
    keys: dict[str, str] = {}
    kinds: dict[str, bool] = {}
    for name, is_directory in paths.items():
        # File-only ZIPs still imply every ancestor directory. Their spellings
        # must agree on case-insensitive and Unicode-normalizing filesystems.
        for candidate in (PurePosixPath(name), *PurePosixPath(name).parents):
            spelling = str(candidate)
            if spelling == ".":
                continue
            key = portable_key(spelling)
            directory = spelling != name or is_directory
            if key in keys and keys[key] != spelling:
                raise VerificationError(f"Duplicate or nonportable path collision: {spelling}, {keys[key]}")
            if key in kinds and kinds[key] != directory:
                raise VerificationError(f"A file is also used as a directory: {spelling}")
            keys[key] = spelling
            kinds[key] = directory


def load_zip(path: Path, ignore_housekeeping: bool) -> tuple[dict[str, Record], int]:
    records: dict[str, Record] = {}
    ignored = 0
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) > MAX_FILES * 2:
            raise VerificationError("ZIP has too many entries")
        paths: dict[str, bool] = {}
        total = 0
        for entry in entries:
            original = entry.orig_filename
            if original != entry.filename:
                raise VerificationError(f"ZIP path contains a truncated or invalid name: {original!r}")
            name = safe_path(original, directory=entry.is_dir())
            if name in paths:
                raise VerificationError(f"Duplicate ZIP entry: {name}")
            paths[name] = entry.is_dir()
            mode = entry.external_attr >> 16
            kind = stat.S_IFMT(mode)
            if stat.S_ISLNK(mode) or kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                raise VerificationError(f"Symlink or special ZIP entry: {name}")
            if (kind == stat.S_IFDIR) != entry.is_dir() and kind != 0:
                raise VerificationError(f"ZIP entry type disagrees with its path: {name}")
            if entry.flag_bits & 1:
                raise VerificationError(f"Encrypted ZIP entry is unsupported: {name}")
            if entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                raise VerificationError(f"Unsupported ZIP compression for {name}")
            if entry.file_size > MAX_FILE_BYTES:
                raise VerificationError(f"ZIP file exceeds the supported size limit: {name}")
            total += entry.file_size
            if total > MAX_TOTAL_BYTES:
                raise VerificationError("ZIP exceeds the supported total size limit")
        check_tree_paths(paths)
        for entry in entries:
            name = safe_path(entry.filename, directory=entry.is_dir())
            skip = ignore_housekeeping and housekeeping(name)
            if name == ARCHIVE_ROOT and entry.is_dir():
                continue
            if not name.startswith(ARCHIVE_ROOT + "/"):
                if not skip:
                    raise VerificationError(f"Entry is outside the required ZIP root: {name}")
                relative = name
            else:
                relative = name[len(ARCHIVE_ROOT) + 1:]
            if entry.is_dir():
                if entry.file_size:
                    raise VerificationError(f"Directory entry contains data: {name}")
                # Reading verifies the CRC even for directory entries.
                with archive.open(entry) as stream:
                    hash_stream(stream, relative)
                continue
            with archive.open(entry) as stream:
                record = hash_stream(stream, relative)
            if record.size != entry.file_size:
                raise VerificationError(f"ZIP length mismatch: {name}")
            if skip:
                ignored += 1
            else:
                records[relative] = record
        if len(records) > MAX_FILES:
            raise VerificationError("ZIP has too many payload files")
    return records, ignored


def load_directory(path: Path, ignore_housekeeping: bool) -> tuple[dict[str, Record], int]:
    records: dict[str, Record] = {}
    paths: dict[str, bool] = {}
    ignored = 0
    total = 0
    if path.is_symlink():
        raise VerificationError("Extracted root must not be a symlink")
    for current, directories, files in os.walk(path, followlinks=False):
        base = Path(current)
        for name in sorted(directories + files):
            entry = base / name
            relative = safe_path(entry.relative_to(path).as_posix())
            mode = entry.lstat().st_mode
            if stat.S_ISLNK(mode) or not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
                raise VerificationError(f"Symlink or special extracted entry: {relative}")
            is_directory = stat.S_ISDIR(mode)
            paths[relative] = is_directory
            if len(paths) > MAX_FILES * 2:
                raise VerificationError("Extracted tree has too many entries")
            if is_directory:
                continue
            if entry.stat().st_size > MAX_FILE_BYTES:
                raise VerificationError(f"Extracted file exceeds the size limit: {relative}")
            with entry.open("rb") as stream:
                record = hash_stream(stream, relative)
            total += record.size
            if total > MAX_TOTAL_BYTES:
                raise VerificationError("Extracted tree exceeds the total size limit")
            if ignore_housekeeping and housekeeping(relative):
                ignored += 1
            else:
                records[relative] = record
            if len(records) > MAX_FILES:
                raise VerificationError("Extracted tree has too many files")
    check_tree_paths(paths)
    return records, ignored


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise VerificationError(f"Duplicate JSON member in manifest: {key}")
        result[key] = value
    return result


def compare_names(label: str, expected: set[str], actual: set[str]) -> None:
    missing = sorted(expected - actual)
    unexpected = sorted(actual - expected)
    if missing or unexpected:
        parts = []
        if missing:
            parts.append("missing: " + ", ".join(missing[:8]))
        if unexpected:
            parts.append("unexpected: " + ", ".join(unexpected[:8]))
        raise VerificationError(f"{label} differs ({'; '.join(parts)})")


def verify_records(records: dict[str, Record]) -> tuple[int, int]:
    for name in (MANIFEST, CHECKSUMS):
        if name not in records:
            raise VerificationError(f"Missing {name}; pass the extracted bundle root, not its parent")
    manifest = json.loads(records[MANIFEST].content.decode("utf-8"), object_pairs_hook=unique_object)
    if not isinstance(manifest, dict) or type(manifest.get("format_version")) is not int or manifest["format_version"] != 1:
        raise VerificationError("Unsupported manifest format")
    if manifest.get("artifact") != ARCHIVE_ROOT:
        raise VerificationError("Manifest artifact name does not match this handoff")
    if manifest.get("baseline_source_commit") != BASELINE_COMMIT or type(manifest.get("baseline_site_version")) is not int or manifest["baseline_site_version"] != 3:
        raise VerificationError("Manifest does not identify the expected v3 provenance baseline")
    if manifest.get("conceptual_documents_are_canonical_contracts") is not False:
        raise VerificationError("Manifest must identify conceptual documents as noncanonical")
    inventory = manifest.get("files")
    if not isinstance(inventory, list):
        raise VerificationError("Manifest file inventory must be an array")
    declared: dict[str, tuple[int, str]] = {}
    portable: set[str] = set()
    for item in inventory:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            raise VerificationError("Invalid manifest inventory entry")
        name = safe_path(item["path"])
        key = portable_key(name)
        if name in declared or key in portable or name in (MANIFEST, CHECKSUMS):
            raise VerificationError(f"Duplicate or self-referential manifest entry: {name}")
        size, digest = item.get("bytes"), item.get("sha256")
        if type(size) is not int or size < 0 or not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise VerificationError(f"Invalid size or SHA-256 in manifest: {name}")
        declared[name] = (size, digest)
        portable.add(key)
    actual_payload = set(records) - {MANIFEST, CHECKSUMS}
    compare_names("Manifest inventory", set(declared), actual_payload)
    checksum_entries: dict[str, str] = {}
    for line in records[CHECKSUMS].content.decode("utf-8").splitlines():
        match = re.fullmatch(r"([0-9a-f]{64}) [ *](.+)", line)
        if not match:
            raise VerificationError("Malformed CHECKSUMS.sha256 line")
        digest, name = match.groups()
        safe_path(name)
        if name in checksum_entries or name == CHECKSUMS:
            raise VerificationError(f"Duplicate or self-referential checksum entry: {name}")
        checksum_entries[name] = digest
    compare_names("Checksum inventory", set(records) - {CHECKSUMS}, set(checksum_entries))
    for name, digest in checksum_entries.items():
        if records[name].digest != digest:
            raise VerificationError(f"SHA-256 mismatch: {name}")
    for name, (size, digest) in declared.items():
        if records[name].size != size or records[name].digest != digest:
            raise VerificationError(f"Manifest size or SHA-256 mismatch: {name}")
    return len(declared), len(checksum_entries)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, epilog="Strict by default: unexpected files, including OS unzip housekeeping, fail validation. SHA-256 detects changes; it does not authenticate the publisher. Limits: 10,000 files, 64 MiB each, 256 MiB total.")
    parser.add_argument("path", nargs="?", type=Path, default=Path("."), help="ZIP file or extracted bundle root (default: current directory)")
    parser.add_argument("--ignore-os-housekeeping", action="store_true", help="Explicitly ignore .DS_Store, __MACOSX, and ._* housekeeping files; paths and symlinks are still checked")
    args = parser.parse_args()
    try:
        path = args.path.absolute()
        if path.is_symlink():
            raise VerificationError("Input must not be a symlink")
        if path.is_dir():
            records, ignored = load_directory(path, args.ignore_os_housekeeping)
            kind = "extracted files and paths"
        elif path.is_file():
            records, ignored = load_zip(path, args.ignore_os_housekeeping)
            kind = "ZIP CRC and paths"
        else:
            raise VerificationError(f"Input does not exist: {path}")
        payload, checksums = verify_records(records)
        print(f"PASS: {len(records)} files; {payload} payload entries; {checksums} SHA-256 checks; {kind} verified")
        if ignored:
            print(f"Explicitly ignored {ignored} OS housekeeping file(s).")
        print("Digests verify integrity, not publisher identity or authentication.")
        return 0
    except (VerificationError, OSError, UnicodeError, json.JSONDecodeError, zipfile.BadZipFile, zlib.error, EOFError, RuntimeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
