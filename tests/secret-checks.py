"""Exercise the actual Git hooks, full-history guard and public site checker with synthetic values."""
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
        import gzip
        site = self.repo / "dist"
        site.mkdir()
        page = site / "index.html"
        page.write_bytes(CANARY)
        check = [sys.executable, SCANNER, "site", "dist"]
        self.assertIn(b"GitHub token", self.call(*check, fails=True))
        detail = b"/Us" + b"ers/sample-account/work"
        page.write_bytes(detail)
        self.assertIn(b"Private operational detail", self.call(*check, fails=True))
        page.write_bytes(gzip.compress(detail))
        self.assertIn(b"Archive in public site", self.call(*check, fails=True))
        page.write_text("<title>Compass</title>")
        for name in ("handoff", "downloads"):
            stale = site / name
            stale.mkdir()
            self.assertIn(b"Retired Handoff", self.call(*check, fails=True))
            stale.rmdir()
        self.call(*check)
        (site / ".env.local").write_text("harmless")
        self.assertIn(b"restricted credential filename", self.call(*check, fails=True))

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
