"""Exercise the actual Git hooks, full-history guard and archive publisher with synthetic values."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCANNER = ROOT / "scripts/scan-secrets.py"
# Construct inert examples only in temporary repositories.
CANARY = b"gh" + b"p_" + b"aB47eZ" * 6


class SecretChecks(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.repo = Path(temp.name) / "repo"
        self.repo.mkdir()
        self.call("git", "init", "-q")
        self.call("git", "config", "user.email", "test@example.invalid")
        self.call("git", "config", "user.name", "Test")
        self.call("git", "config", "commit.gpgsign", "false")

    def call(self, *args, fails=False, env=None, input=None):
        result = subprocess.run(args, cwd=self.repo, input=input, capture_output=True, env=env)
        output = result.stdout + result.stderr
        self.assertNotIn(CANARY, output)
        self.assertEqual(result.returncode != 0, fails, output.decode(errors="replace"))
        return output

    def install(self):
        self.call(sys.executable, ROOT / "scripts/install-secret-hooks.py")

    def test_index_uses_staged_bytes_and_fails_closed(self):
        self.install()
        p = self.repo / "note"
        p.write_bytes(b"\0" + CANARY)
        self.call("git", "add", "note")
        p.write_text("clean working file")
        out = self.call("git", "commit", "-m", "sample", fails=True)
        self.assertIn(b"GitHub token", out)
        self.call("git", "add", "note")
        p.write_bytes(CANARY)
        self.call("git", "commit", "-m", "safe staged version")
        empty_path = self.repo.parent / "only-git"
        empty_path.mkdir()
        (empty_path / "git").symlink_to(shutil.which("git"))
        self.call(sys.executable, SCANNER, "staged", env={**os.environ, "PATH":str(empty_path)}, fails=True)

    def test_commit_message(self):
        self.install()
        out = self.call("git", "commit", "--allow-empty", "-m", CANARY.decode(), fails=True)
        self.assertIn(b"GitHub token", out)

    def test_rejected_name_even_with_inert_contents(self):
        self.install()
        p = self.repo / ".env.production"
        p.write_text("harmless")
        self.call("git", "add", "-f", p.name)
        self.assertIn(b"restricted credential filename", self.call("git", "commit", "-m", "sample", fails=True))

    def test_deleted_secret_blocks_push(self):
        destination = self.repo.parent / "remote.git"
        self.call("git", "init", "--bare", "-q", destination)
        p = self.repo / "note"
        p.write_bytes(CANARY)
        self.call("git", "add", p.name)
        self.call("git", "commit", "-qm", "historical candidate")
        self.call("git", "rm", p.name)
        self.call("git", "commit", "-qm", "remove note")
        self.install()
        self.assertIn(b"GitHub token", self.call(sys.executable, SCANNER, "history", fails=True))
        self.assertIn(b"GitHub token", self.call("git", "push", str(destination), "HEAD:refs/heads/check", fails=True))
        self.assertEqual(self.call("git", "--git-dir", str(destination), "show-ref", fails=True), b"")

    def test_publisher_scans_actual_bytes(self):
        for name in ("scripts", "docs", "tests", "examples", "dist"):
            shutil.copytree(ROOT / name, self.repo / name, ignore=shutil.ignore_patterns("downloads", "__pycache__"))
        for name in ("README.md", "START_HERE.md", "MOBILE_READINESS.md", "AGENTS.md"):
            shutil.copyfile(ROOT / name, self.repo / name)
        p = self.repo / "examples/notes.txt"
        p.write_bytes(CANARY)
        out = self.call(sys.executable, "scripts/build-handoff.py", fails=True)
        self.assertIn(b"Export secret check failed", out)
        self.assertFalse((self.repo / "artifacts").exists())
        p.unlink()
        self.call(sys.executable, "scripts/build-handoff.py", "--guide-only")
        self.assertTrue((self.repo / "dist/handoff/guide.html").is_file())
        self.assertFalse((self.repo / "artifacts").exists())
        self.assertFalse((self.repo / "dist/downloads").exists())
        downloads = self.repo / "dist/downloads"
        downloads.mkdir()
        (downloads / "legacy.zip").touch()
        self.assertIn(b"legacy dist/downloads", self.call(sys.executable, "scripts/build-handoff.py", "--guide-only", fails=True))
        (self.repo / "dist/.env.local").write_text("harmless")
        self.assertIn(b"restricted credential filename", self.call(sys.executable, SCANNER, "source", ".", fails=True))

    def test_gitleaks_default_rules_reach_an_archive(self):
        import zipfile
        # A synthetic Slack webhook exercises the external scanner rather than the offline patterns.
        data = ("https://hooks.slack.com/" + "services/" + "T01234567/B01234567/" + "aZ34" * 6).encode()
        with zipfile.ZipFile(self.repo / "sample.bin", "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("nested.txt", data)
        out = self.call(sys.executable, SCANNER, "source", ".", fails=True)
        self.assertNotIn(data, out)
        self.assertIn(b"Gitleaks detected", out)
        self.call("git", "add", "sample.bin")
        out = self.call(sys.executable, SCANNER, "staged", fails=True)
        self.assertIn(b"Gitleaks detected", out)
        self.assertNotIn(data, out)


if __name__ == "__main__":
    unittest.main()
