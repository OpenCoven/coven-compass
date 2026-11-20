#!/bin/sh
# Run a build or CI command with the checksum-pinned scanner on PATH.
set -eu
case "$(uname -s)/$(uname -m)" in
  Linux/x86_64) platform=linux_x64; digest=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb ;;
  Linux/aarch64) platform=linux_arm64; digest=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080 ;;
  Darwin/arm64) platform=darwin_arm64; digest=b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5 ;;
  Darwin/x86_64) platform=darwin_x64; digest=dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709 ;;
  *) echo "Unsupported scanner platform" >&2; exit 1 ;;
esac
tools_dir=$(mktemp -d)
trap 'rm -rf "$tools_dir"' EXIT
archive="$tools_dir/scanner.tar.gz"
curl --fail --silent --show-error --location --retry 2 --max-time 120 --proto '=https' --proto-redir '=https' \
  "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_${platform}.tar.gz" -o "$archive"
python3 - "$archive" "$digest" <<'PY'
import hashlib, sys
from pathlib import Path
if hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest() != sys.argv[2]:
    sys.exit("Scanner checksum mismatch")
PY
tar -xzf "$archive" -C "$tools_dir" gitleaks
PATH="$tools_dir:$PATH" "$@"
