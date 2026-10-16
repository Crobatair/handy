"""Collect only installers from the current target, never local settings or builds."""
import json
import os
import shutil
from pathlib import Path

version = json.loads(Path("src-tauri/tauri.conf.json").read_text())["version"]
target = os.environ["TARGET"]
platform = os.environ["PLATFORM"]
root = Path("src-tauri/target") / target / "release/bundle"
output = Path("release-assets")
output.mkdir(exist_ok=True)
extensions = (".dmg",) if platform.startswith("macos") else ((".exe",) if platform.startswith("windows") else (".deb", ".rpm", ".AppImage"))
for extension in extensions:
    files = list(root.rglob(f"*{extension}"))
    if len(files) != 1:
        raise SystemExit(f"Expected one {extension} installer for {platform}; found {len(files)}")
    suffix = "-setup" if extension == ".exe" else ""
    shutil.copy2(files[0], output / f"Synapse_{version}_{platform}{suffix}{extension}")
