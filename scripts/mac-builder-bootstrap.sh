#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:jishengyang-cal/vision-web-workspace.git}"
REPO_DIR="${REPO_DIR:-$HOME/vision-web-workspace}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3201}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "mac-builder-bootstrap must run on macOS." >&2
  exit 2
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required before bootstrap. Install it manually from https://brew.sh/." >&2
  exit 2
fi

brew install git git-lfs node pnpm xcodegen

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Full Xcode is not installed. Install it with scripts/mac-builder-install-xcode.sh after providing Xcode.xip." >&2
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
pnpm install
pnpm --filter @vision-web-workspace/mac-builder-agent build

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$HOME/Library/LaunchAgents/com.visionwebworkspace.mac-builder-agent.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.visionwebworkspace.mac-builder-agent</string>
  <key>WorkingDirectory</key>
  <string>$REPO_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v node)</string>
    <string>$REPO_DIR/services/mac-builder-agent/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>$PORT</string>
    <key>MAC_BUILDER_WORK_ROOT</key>
    <string>$HOME/.vision-web-workspace/mac-builder/work</string>
    <key>MAC_BUILDER_ARTIFACT_ROOT</key>
    <string>$HOME/.vision-web-workspace/mac-builder/artifacts</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$HOME/.vision-web-workspace/mac-builder/agent.out.log</string>
  <key>StandardErrorPath</key>
  <string>$HOME/.vision-web-workspace/mac-builder/agent.err.log</string>
</dict>
</plist>
PLIST

mkdir -p "$HOME/.vision-web-workspace/mac-builder"
launchctl unload "$HOME/Library/LaunchAgents/com.visionwebworkspace.mac-builder-agent.plist" >/dev/null 2>&1 || true
launchctl load "$HOME/Library/LaunchAgents/com.visionwebworkspace.mac-builder-agent.plist"

echo "Mac Builder Agent installed on http://127.0.0.1:$PORT"
