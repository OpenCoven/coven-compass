"""Offline checks shared by Git hooks and the public site checker."""
import re
from pathlib import PurePosixPath


class SecretError(ValueError):
    """Messages identify the rule and object, never the matched bytes."""


PRIVATE_NAMES = {
    ".npmrc", ".pypirc", ".netrc", "_netrc", "credentials.json",
    "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", "terraform.tfstate",
}
EXAMPLE_ENV = {".env.example", ".env.sample", ".env.template"}
RULES = {
    "private key": rb"-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY(?: BLOCK)?-----",
    "GitHub token": rb"(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})",
    "cloud access key ID": rb"(?:AKIA|ASIA)[A-Z0-9]{16}\b",
    "provider API key": rb"(?<![a-zA-Z0-9])(?:sk-(?:proj-|svcacct-|ant-api\d+-)?[\w-]{32,}|(?:sk|rk)_live_[A-Za-z0-9]{16,}|AIza[\w-]{35})",
    "service token": rb"(?:xox[baprs]-[\w-]{20,}|npm_[A-Za-z0-9]{36}|glpat-[\w-]{20,})",
    "database credentials": rb"(?i)\b(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis(?:s)?)://[^\s/:@]+:[^\s/@${}<>]+@",
    "literal credential assignment": rb"""(?i)\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|auth[_-]?token|password)\b["']?\s*[:=]\s*["'][a-z0-9+/_=.@!:-]{12,}["']""",
}
PATTERNS = [(label, re.compile(expr)) for label, expr in RULES.items()]


def check_name(path):
    for part in PurePosixPath(path).parts:
        name = part.lower()
        dotenv = name == ".env" or (name.startswith(".env.") and name not in EXAMPLE_ENV)
        if dotenv or name in PRIVATE_NAMES or name in {".ssh", ".aws", ".gnupg"} or name.endswith((".p12", ".pfx", ".key", ".tfstate", ".tfstate.backup")):
            raise SecretError("restricted credential filename")


def check_content(data):
    for label, pattern in PATTERNS:
        if pattern.search(data):
            raise SecretError(label)
