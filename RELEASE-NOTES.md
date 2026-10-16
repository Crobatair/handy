# Synapse 0.10.0 — desktop preview

Handy-based dictation with local speech models, optional Deepgram, task modes, and compact live prompt guidance. No separate Synapse backend is needed.

## Choose your installer

| Computer                          | File                                      |
| --------------------------------- | ----------------------------------------- |
| Mac with Apple Silicon (M-series) | `macos-arm64.dmg`                         |
| Mac with Intel processor          | `macos-x64.dmg`                           |
| Windows on Intel/AMD              | `windows-x64-setup.exe`                   |
| Windows on ARM (e.g. Snapdragon)  | `windows-arm64-setup.exe`                 |
| Linux on Intel/AMD                | `linux-x64.deb`, `.rpm`, or `.AppImage`   |
| Linux on ARM64                    | `linux-arm64.deb`, `.rpm`, or `.AppImage` |

The full filenames start with `Synapse_0.10.0_`. `SHA256SUMS.txt` contains checksums for all ten installers. GitHub's Source code archives are not installers.

## Install and update

- **macOS:** open the DMG and copy Synapse to Applications. Grant Microphone and Accessibility access when needed for dictation and inserting text. These builds are ad-hoc signed, not Apple notarized; macOS may block an unverified download.
- **Windows:** run the setup EXE. The installer provisions WebView2 if needed. These builds are not Windows code-signed, so Windows may show an unknown-publisher warning.
- **Linux:** built on Ubuntu 24.04; older distributions may not have compatible runtime libraries. For Debian/Ubuntu use `sudo apt install ./Synapse_0.10.0_linux-x64.deb` (substitute `arm64` where appropriate) to resolve dependencies. For RPM-based distributions use your package manager. Make the AppImage executable before running it. Wayland shortcut/typing support depends on the desktop environment.
- **Setup:** download a local speech model in Models, or select Deepgram and add your own key. Rewriting/live guidance needs its own valid AI provider key or localhost endpoint. Plain dictation does not need an AI provider.
- **Updates are manual:** download the new installer from this repository's Releases and install over the existing app. Quit Synapse before updating. Automatic updates remain disabled; signed updater packages and an update feed are not configured yet.

## Changes

- Separate plain and guided dictation shortcuts.
- Selectable live transcript, floating task modes, and title-bar feedback timing.
- Side-by-side key parts/improvements, three short hints, a 300-token guide budget, and provider-reported token counts.
- macOS Spaces panel behavior, queued-shortcut timing, background paste workers, and modifier cleanup after input errors.
- Provider errors are surfaced and authentication failures pause repeated guidance requests.

This is a preview. Builds passing does not establish successful real-world microphone, paste, or local-model inference on every supported computer. The cause of reported whole-system freezes has not been confirmed. Signing/notarization and automatic updates are separate follow-up work.

Based on [Handy](https://github.com/cjpais/Handy), MIT licensed. No API keys, recordings, local diagnostics, or account settings are included.
