"""Fail closed if an OS/architecture or installer format is missing."""
import hashlib
import json
from pathlib import Path

version = json.loads(Path("src-tauri/tauri.conf.json").read_text())["version"]
root = Path("release-assets")
expected = []
for platform, extensions in {
    "macos-arm64": [".dmg"], "macos-x64": [".dmg"],
    "windows-x64": ["-setup.exe"], "windows-arm64": ["-setup.exe"],
    "linux-x64": [".deb", ".rpm", ".AppImage"],
    "linux-arm64": [".deb", ".rpm", ".AppImage"],
}.items():
    expected.extend(f"Synapse_{version}_{platform}{extension}" for extension in extensions)
actual = {path.name for path in root.iterdir() if path.is_file()}
if actual != set(expected):
    raise SystemExit(f"Installer mismatch. Missing: {set(expected)-actual}; unexpected: {actual-set(expected)}")
lines = [f"{hashlib.sha256((root/name).read_bytes()).hexdigest()}  {name}" for name in sorted(expected)]
(root / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n")
