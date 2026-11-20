#!/usr/bin/env python3
"""Build the standalone Coven Compass handoff (Python 3.10+, standard library)."""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import tempfile
from datetime import date
import unicodedata
from urllib.parse import unquote, urlsplit
import zipfile


ROOT = Path(__file__).resolve().parents[1]
EDITION = date(2026, 11, 19)
ARCHIVE_ROOT = f"Coven_Compass_Handoff_{EDITION.isoformat()}"
BASELINE_COMMIT = "d7b6f1e655140036cca49f31687131352162de13"
MANIFEST = "HANDOFF_MANIFEST.json"
CHECKSUMS = "CHECKSUMS.sha256"
ALLOW_FILES = ("AGENTS.md", "README.md", "START_HERE.md", "MOBILE_READINESS.md", ".gitignore")
ALLOW_DIRS = ("dist", "docs/handoff", "examples", "tests", "scripts")
REQUIRED = (
    "README.md", "START_HERE.md", "MOBILE_READINESS.md", "dist/index.html",
    "dist/handoff/index.html", "dist/handoff/handoff.css",
    "tests/presentation.test.cjs", "tests/fixtures/baseline.json",
    "scripts/check-source.mjs", "scripts/build-handoff.py", "scripts/verify-handoff.py",
    "examples/README.md",
)
EXCLUDED_PARTS = {
    ".git", "node_modules", "__pycache__", ".cache", ".pytest_cache",
    ".venv", "venv", ".env", "env", ".ssh", ".aws", ".gnupg", ".coven",
    "credentials", "secrets", "runtime", "runtime-data", ".runtime", "sessions",
}
RESERVED = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)),
            *(f"lpt{i}" for i in range(1, 10))}
MAX_FILES = 10000
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_TOTAL_BYTES = 256 * 1024 * 1024


class BuildError(ValueError):
    pass


def safe_relative(value: str) -> str:
    if not value or "\\" in value or any(ord(c) < 32 for c in value):
        raise BuildError(f"Unsafe path: {value!r}")
    parts = value.split("/")
    if any(p in ("", ".", "..") or ":" in p or p.endswith((" ", ".")) for p in parts):
        raise BuildError(f"Unsafe path: {value!r}")
    if any(p.split(".")[0].casefold() in RESERVED for p in parts):
        raise BuildError(f"Nonportable reserved path: {value!r}")
    return value


def excluded(relative: str) -> bool:
    parts = PurePosixPath(relative).parts
    lower = [p.casefold() for p in parts]
    if any(p in EXCLUDED_PARTS or p.startswith(".env.") for p in lower):
        return True
    if relative == "dist/downloads" or relative.startswith("dist/downloads/"):
        return True
    if relative == "docs/screenshots" or relative.startswith("docs/screenshots/"):
        return True
    if relative.startswith("tests/evidence/") and Path(relative).suffix.casefold() in {".png", ".jpg", ".jpeg", ".webp"}:
        return True
    name = parts[-1]
    low = name.casefold()
    return (
        name in (MANIFEST, CHECKSUMS, ".DS_Store") or name.startswith("._")
        or "__MACOSX" in parts or low.endswith((".zip", ".zip.sha256", ".env", ".pem", ".key", ".p12", ".pfx", ".pyc"))
        or low in ("credentials.json", "credentials.yaml", "credentials.yml", "secrets.json", "secrets.yaml", "secrets.yml")
    )


def plain_source_parents(path: Path) -> None:
    relative = path.relative_to(ROOT)
    current = ROOT
    for part in relative.parts[:-1]:
        current /= part
        if current.is_symlink():
            raise BuildError(f"Source directory is a symlink: {current}")


def regular_file(path: Path) -> None:
    plain_source_parents(path)
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode):
        raise BuildError(f"Expected a regular file, not a symlink or special file: {path}")


def source_bytes(path: Path) -> bytes:
    regular_file(path)
    if path.stat().st_size > MAX_FILE_BYTES:
        raise BuildError(f"File exceeds {MAX_FILE_BYTES} bytes: {path}")
    data = path.read_bytes()
    if len(data) > MAX_FILE_BYTES:
        raise BuildError(f"File grew beyond the export size limit: {path}")
    return data


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        raise BuildError(f"Refusing to replace a symlink: {path}")
    fd, temporary = tempfile.mkstemp(prefix=".handoff-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def slug(text: str) -> str:
    text = re.sub(r"[`*_]", "", text).casefold()
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    return re.sub(r"[\s-]+", "-", text).strip("-") or "section"


class Markdown:
    """Small escaped Markdown renderer; no raw HTML or executable extensions."""

    def __init__(self, path: Path, chapter_id: str, chapter_ids: dict[str, str]):
        self.path = path
        self.chapter_id = chapter_id
        self.chapter_ids = chapter_ids
        self.references: dict[str, str] = {}
        self.heading_counts: dict[str, int] = {}

    def destination(self, value: str) -> str | None:
        value = html.unescape(value.strip().strip("<>"))
        parsed = urlsplit(value)
        if parsed.scheme:
            return value if parsed.scheme.casefold() in ("https", "http", "mailto") else None
        if parsed.netloc:
            return None
        if not parsed.path:
            return f"#{self.chapter_id}--{unquote(parsed.fragment)}" if parsed.fragment else f"#{self.chapter_id}"
        resolved = (self.path.parent / unquote(parsed.path)).resolve()
        try:
            relative = resolved.relative_to(ROOT).as_posix()
        except ValueError:
            return None
        if relative in self.chapter_ids:
            anchor = self.chapter_ids[relative]
            return f"#{anchor}--{unquote(parsed.fragment)}" if parsed.fragment else f"#{anchor}"
        # Only files actually served inside dist can become local web links.
        if relative.startswith("dist/") and resolved.is_file() and resolved.suffix.casefold() in (".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".pdf"):
            target = os.path.relpath(resolved, ROOT / "dist/handoff").replace(os.sep, "/")
            return target + ("#" + parsed.fragment if parsed.fragment else "")
        return None

    def inline(self, value: str) -> str:
        tokens: list[str] = []

        def keep(fragment: str) -> str:
            tokens.append(fragment)
            return f"\x00{len(tokens) - 1}\x00"

        value = re.sub(r"(`+)(.+?)\1", lambda m: keep("<code>" + html.escape(m[2]) + "</code>"), value)

        def link(label: str, target: str, is_image: bool = False) -> str:
            label_html = html.escape(label)
            if is_image:
                return keep(f"<span>{label_html} (image reference: <code>{html.escape(target)}</code>)</span>")
            destination = self.destination(target)
            if destination is None:
                return keep(label_html + f" <code>({html.escape(target)})</code>")
            return keep(f'<a href="{html.escape(destination, quote=True)}">{label_html}</a>')

        value = re.sub(r"(!?)\[([^\]]+)\]\((<[^>]*>|[^\s)]+)(?:\s+[\"'][^)]*[\"'])?\)",
                       lambda m: link(m[2], m[3], bool(m[1])), value)

        def reference(match: re.Match[str]) -> str:
            key = (match[3] or match[2]).strip().casefold()
            return link(match[2], self.references[key], bool(match[1])) if key in self.references else match[0]

        value = re.sub(r"(!?)\[([^\]]+)\]\[([^\]]*)\]", reference, value)
        value = re.sub(r"(?<!!)\[([^\]]+)\]", lambda m: link(m[1], self.references[m[1].strip().casefold()])
                       if m[1].strip().casefold() in self.references else m[0], value)
        value = re.sub(r"<(https?://[^>]+)>", lambda m: link(m[1], m[1]), value)
        escaped = html.escape(value)
        escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
        escaped = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", escaped)
        # Tokens can contain earlier inline-code tokens inside link labels.
        for _ in range(3):
            escaped = re.sub(r"\x00(\d+)\x00", lambda m: tokens[int(m[1])], escaped)
        return escaped

    @staticmethod
    def cells(line: str) -> list[str]:
        return [cell.strip().replace("\\|", "|") for cell in re.split(r"(?<!\\)\|", line.strip().strip("|"))]

    @classmethod
    def separator(cls, line: str) -> bool:
        cells = cls.cells(line)
        return "|" in line and bool(cells) and all(re.fullmatch(r":?-{3,}:?", c) for c in cells)

    def render(self, text: str) -> str:
        lines = text.splitlines()
        cleaned: list[str] = []
        fence: tuple[str, int] | None = None
        for line in lines:
            marker = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
            if marker:
                if fence is None:
                    fence = (marker[1][0], len(marker[1]))
                elif marker[1][0] == fence[0] and len(marker[1]) >= fence[1] and not line[marker.end():].strip():
                    fence = None
            definition = re.match(r"^\s{0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))(?:\s+.*)?$", line)
            if definition and fence is None:
                self.references[definition[1].strip().casefold()] = definition[2] or definition[3]
            else:
                cleaned.append(line)
        return self.blocks(cleaned)

    def blocks(self, lines: list[str]) -> str:
        out: list[str] = []
        i = 0
        while i < len(lines):
            line = lines[i]
            if not line.strip():
                i += 1
                continue
            fence = re.match(r"^\s{0,3}(`{3,}|~{3,})\s*([^\s]*)", line)
            if fence:
                code: list[str] = []
                i += 1
                while i < len(lines) and not re.match(r"^\s{0,3}" + re.escape(fence[1][0]) + "{" + str(len(fence[1])) + r",}\s*$", lines[i]):
                    code.append(lines[i])
                    i += 1
                if i >= len(lines):
                    raise BuildError(f"Unclosed Markdown fence in {self.path}")
                language = re.sub(r"[^a-zA-Z0-9_-]", "", fence[2])
                out.append(f'<pre><code class="language-{language}">{html.escape(chr(10).join(code))}</code></pre>')
                i += 1
                continue
            heading = re.match(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$", line)
            if heading:
                name = slug(heading[2])
                number = self.heading_counts.get(name, 0)
                self.heading_counts[name] = number + 1
                anchor = f"{self.chapter_id}--{name}" + (f"-{number}" if number else "")
                level = min(4, len(heading[1]) + 1)
                out.append(f'<h{level} id="{html.escape(anchor)}">{self.inline(heading[2])}</h{level}>')
                i += 1
                continue
            if i + 1 < len(lines) and "|" in line and self.separator(lines[i + 1]):
                headings = self.cells(line)
                out.append("<table><thead><tr>" + "".join("<th>" + self.inline(c) + "</th>" for c in headings) + "</tr></thead><tbody>")
                i += 2
                while i < len(lines) and lines[i].strip() and "|" in lines[i]:
                    values = self.cells(lines[i])
                    values = (values + [""] * len(headings))[:len(headings)]
                    out.append("<tr>" + "".join("<td>" + self.inline(c) + "</td>" for c in values) + "</tr>")
                    i += 1
                out.append("</tbody></table>")
                continue
            item = re.match(r"^(\s*)([-+*]|\d+[.)])\s+(.*)$", line)
            if item:
                base = len(item[1])
                ordered = item[2][0].isdigit()
                tag = "ol" if ordered else "ul"
                first_number = int(re.match(r"\d+", item[2])[0]) if ordered else None
                start = f' start="{first_number}"' if ordered else ""
                out.append(f"<{tag}{start}>")
                while i < len(lines):
                    current = re.match(r"^(\s*)([-+*]|\d+[.)])\s+(.*)$", lines[i])
                    if not current or len(current[1]) != base or current[2][0].isdigit() != ordered:
                        break
                    content = [current[3]]
                    indentation = len(current[1]) + len(current[2]) + 1
                    i += 1
                    while i < len(lines):
                        next_line = lines[i]
                        if not next_line.strip():
                            if i + 1 < len(lines) and (len(lines[i + 1]) - len(lines[i + 1].lstrip()) > base):
                                content.append("")
                                i += 1
                                continue
                            break
                        if len(next_line) - len(next_line.lstrip()) <= base:
                            break
                        content.append(next_line[min(indentation, len(next_line) - len(next_line.lstrip())):])
                        i += 1
                    out.append("<li>" + self.blocks(content) + "</li>")
                    while i < len(lines) and not lines[i].strip():
                        i += 1
                out.append(f"</{tag}>")
                continue
            if line.lstrip().startswith(">"):
                quoted: list[str] = []
                while i < len(lines) and lines[i].lstrip().startswith(">"):
                    quoted.append(re.sub(r"^\s*> ?", "", lines[i]))
                    i += 1
                out.append("<blockquote>" + self.blocks(quoted) + "</blockquote>")
                continue
            if re.fullmatch(r"\s*(?:-{3,}|\*{3,}|_{3,})\s*", line):
                out.append("<hr>")
                i += 1
                continue
            paragraph = [line.strip()]
            i += 1
            while i < len(lines) and lines[i].strip():
                if re.match(r"^\s{0,3}(?:#{1,6}\s|`{3,}|~{3,}|>|[-+*]\s|\d+[.)]\s)", lines[i]):
                    break
                if i + 1 < len(lines) and "|" in lines[i] and self.separator(lines[i + 1]):
                    break
                paragraph.append(lines[i].strip())
                i += 1
            out.append("<p>" + self.inline(" ".join(paragraph)) + "</p>")
        return "\n".join(out)


def write_guide() -> int:
    docs = ROOT / "docs/handoff"
    numbered = sorted(p for p in docs.glob("*.md") if re.match(r"^\d{2}-", p.name))
    if not numbered:
        raise BuildError("No numbered documents found in docs/handoff/")
    extras = sorted(p for p in docs.rglob("*.md") if p not in numbered)
    templates = sorted((docs / "templates").glob("*.csv"))
    example_readme = ROOT / "examples/README.md"
    root_readmes = [ROOT / name for name in ("README.md", "START_HERE.md", "MOBILE_READINESS.md") if (ROOT / name).is_file()]
    paths = numbered + extras + templates + root_readmes + ([example_readme] if example_readme.is_file() else [])
    chapter_ids: dict[str, str] = {}
    used: set[str] = set()
    for path in paths:
        relative = path.relative_to(ROOT).as_posix()
        chapter_id = "doc-" + slug(path.stem)
        if chapter_id in used:
            chapter_id = "doc-" + slug(relative.replace("/", "-"))
        if chapter_id in used:
            raise BuildError(f"Duplicate guide chapter ID: {relative}")
        used.add(chapter_id)
        chapter_ids[relative] = chapter_id
    toc: list[str] = []
    chapters: list[str] = []
    for path in paths:
        text = source_bytes(path).decode("utf-8")
        relative = path.relative_to(ROOT).as_posix()
        chapter_id = chapter_ids[relative]
        title_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
        title = title_match[1] if title_match else path.stem.replace("-", " ").capitalize()
        toc.append(f'<li><a href="#{chapter_id}">{html.escape(title)}</a></li>')
        if path.suffix == ".csv":
            rows = list(csv.reader(io.StringIO(text)))
            content = f"<h2>{html.escape(title)}</h2><table>"
            for row_number, row in enumerate(rows):
                tag = "th" if row_number == 0 else "td"
                content += "<tr>" + "".join(f"<{tag}>{html.escape(c)}</{tag}>" for c in row) + "</tr>"
            content += "</table>"
        else:
            content = Markdown(path, chapter_id, chapter_ids).render(text)
        chapters.append(f'<article class="chapter" id="{chapter_id}"><p class="chapter-source"><code>{html.escape(relative)}</code></p>\n{content}\n</article>')
    page = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Coven Compass · Complete implementation guide</title><link rel="stylesheet" href="handoff.css"></head>
<body><header class="page-header"><a class="wordmark" href="index.html">Coven Compass</a><span class="header-context">Implementation handoff</span><a class="text-link" href="../">Return to Compass</a></header>
<div class="guide-layout">
<nav class="guide-toc" aria-label="Guide chapters"><h2>Chapters</h2><ol>
""" + "\n".join(toc) + "\n</ol></nav><main class=\"guide-main\" id=\"guide-main\"><h1>Complete implementation guide</h1><p>Source-backed prototype evidence and proposed implementation work. Conceptual documents and examples are not canonical production contracts.</p>\n" + "\n".join(chapters) + "\n</main></div></body></html>\n"
    guide_path = ROOT / "dist/handoff/guide.html"
    plain_source_parents(guide_path)
    atomic_write(guide_path, page.encode("utf-8"))
    return len(paths)


def collect_files() -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    portable_names: dict[str, str] = {}
    total_bytes = 0

    def add(path: Path) -> None:
        nonlocal total_bytes
        relative = path.relative_to(ROOT).as_posix()
        if excluded(relative):
            return
        if relative in files:
            return
        if len(files) >= MAX_FILES:
            raise BuildError("Export exceeds the supported file count limit")
        safe_relative(relative)
        # ZIPs contain file entries only; include implicit directory spellings.
        for candidate in (PurePosixPath(relative), *PurePosixPath(relative).parents):
            spelling = str(candidate)
            if spelling == ".":
                continue
            key = unicodedata.normalize("NFC", spelling).casefold()
            if key in portable_names and portable_names[key] != spelling:
                raise BuildError(f"Portable filename collision: {spelling}, {portable_names[key]}")
            portable_names[key] = spelling
        data = source_bytes(path)
        if total_bytes + len(data) > MAX_TOTAL_BYTES:
            raise BuildError("Export exceeds the supported total size limit")
        files[relative] = data
        total_bytes += len(data)

    for name in ALLOW_FILES:
        path = ROOT / name
        if path.exists() or path.is_symlink():
            add(path)
    for name in ALLOW_DIRS:
        directory = ROOT / name
        if directory.is_symlink():
            raise BuildError(f"Export directory is a symlink: {directory}")
        if not directory.is_dir():
            raise BuildError(f"Required export directory is missing: {directory}")
        for current, dirs, names in os.walk(directory, followlinks=False):
            base = Path(current)
            allowed_dirs = []
            for child in sorted(dirs):
                path = base / child
                relative = path.relative_to(ROOT).as_posix()
                if excluded(relative):
                    continue
                if path.is_symlink():
                    raise BuildError(f"Symlink directory is not exportable: {relative}")
                safe_relative(relative)
                allowed_dirs.append(child)
            dirs[:] = allowed_dirs
            for child in sorted(names):
                add(base / child)
    return dict(sorted(files.items()))


def build(output: Path) -> tuple[int, str, int]:
    if output.suffix.casefold() != ".zip":
        raise BuildError("--output must name a .zip file")
    for relative in REQUIRED:
        path = ROOT / relative
        if not path.is_file():
            raise BuildError(f"Required handoff source is missing: {relative}")
        regular_file(path)
    chapters = write_guide()
    files = collect_files()
    manifest = {
        "format_version": 1,
        "artifact": ARCHIVE_ROOT,
        "edition_date": EDITION.isoformat(),
        "baseline_site_version": 3,
        "baseline_source_commit": BASELINE_COMMIT,
        "baseline_relationship": "The v3 source revision is a provenance reference, not a claim that these exported files equal that commit. This handoff includes new documentation, packaging tools, and Site additions.",
        "conceptual_documents_are_canonical_contracts": False,
        "documentation_status": "Implementation proposals and example fixtures require discovery against canonical production repositories; they do not grant authority.",
        "integrity_notice": "SHA-256 digests detect content changes. They are not authentication signatures and do not establish publisher identity or trust.",
        "inventory_scope": "All payload files, excluding HANDOFF_MANIFEST.json and CHECKSUMS.sha256. CHECKSUMS.sha256 also includes the manifest hash and excludes itself.",
        "files": [{"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for name, data in files.items()],
    }
    files[MANIFEST] = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    files[CHECKSUMS] = "".join(f"{hashlib.sha256(data).hexdigest()}  {name}\n" for name, data in sorted(files.items())).encode("utf-8")
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.is_symlink():
        raise BuildError(f"Refusing to replace a symlink: {output}")
    fd, temporary = tempfile.mkstemp(prefix=".handoff-", suffix=".zip", dir=output.parent)
    os.close(fd)
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, data in sorted(files.items()):
                info = zipfile.ZipInfo(f"{ARCHIVE_ROOT}/{name}", date_time=(EDITION.year, EDITION.month, EDITION.day, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        os.replace(temporary, output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    atomic_write(Path(str(output) + ".sha256"), f"{digest}  {output.name}\n".encode("utf-8"))
    return len(files), digest, chapters


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, epilog="No Git, npm, network, or third-party packages are required. Digests provide integrity checks, not authenticated signatures.")
    parser.add_argument("--output", type=Path, default=ROOT / "dist/downloads" / f"{ARCHIVE_ROOT}.zip", help="ZIP output path (default: dist/downloads/Coven_Compass_Handoff_2026-11-19.zip)")
    args = parser.parse_args()
    try:
        output = args.output.absolute()
        count, digest, chapters = build(output)
        print(f"PASS: built {count} files and a {chapters}-chapter static guide")
        print(f"ZIP: {output}\nSHA-256: {digest}\nSidecar: {output}.sha256")
        print("Digests are integrity checks, not authentication signatures.")
        return 0
    except (BuildError, OSError, UnicodeError, csv.Error, zipfile.BadZipFile) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
