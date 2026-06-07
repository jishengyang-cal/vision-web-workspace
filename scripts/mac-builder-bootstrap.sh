#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:jishengyang-cal/vision-web-workspace.git}"
REPO_DIR="${REPO_DIR:-$HOME/vision-web-workspace}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3201}"
MAC_BUILDER_TOKEN="${MAC_BUILDER_TOKEN:-}"
MAC_BUILDER_SERVICE_MODE="${MAC_BUILDER_SERVICE_MODE:-agent}"
MAC_BUILDER_SERVICE_USER="${MAC_BUILDER_SERVICE_USER:-$(id -un)}"
MAC_BUILDER_PATH="${MAC_BUILDER_PATH:-/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"

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

TOKEN_PLIST_BLOCK=""
if [[ -n "$MAC_BUILDER_TOKEN" ]]; then
  TOKEN_PLIST_BLOCK="    <key>MAC_BUILDER_TOKEN</key>
    <string>$MAC_BUILDER_TOKEN</string>"
fi

write_plist() {
  local plist_path="$1"
  local user_block="$2"

  cat > "$plist_path" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.visionwebworkspace.mac-builder-agent</string>
$user_block
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
    <key>PATH</key>
    <string>$MAC_BUILDER_PATH</string>
    <key>MAC_BUILDER_WORK_ROOT</key>
    <string>$HOME/.vision-web-workspace/mac-builder/work</string>
    <key>MAC_BUILDER_ARTIFACT_ROOT</key>
    <string>$HOME/.vision-web-workspace/mac-builder/artifacts</string>
$TOKEN_PLIST_BLOCK
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
}

mkdir -p "$HOME/.vision-web-workspace/mac-builder"

if [[ "$MAC_BUILDER_SERVICE_MODE" == "daemon" ]]; then
  PLIST_PATH="/Library/LaunchDaemons/com.visionwebworkspace.mac-builder-agent.plist"
  TMP_PLIST="$(mktemp)"
  write_plist "$TMP_PLIST" "  <key>UserName</key>
  <string>$MAC_BUILDER_SERVICE_USER</string>"
  sudo mv "$TMP_PLIST" "$PLIST_PATH"
  sudo chown root:wheel "$PLIST_PATH"
  sudo chmod 644 "$PLIST_PATH"
  sudo launchctl bootout system/com.visionwebworkspace.mac-builder-agent >/dev/null 2>&1 || true
  sudo launchctl bootstrap system "$PLIST_PATH"
  sudo launchctl kickstart -k system/com.visionwebworkspace.mac-builder-agent
else
  mkdir -p "$HOME/Library/LaunchAgents"
  PLIST_PATH="$HOME/Library/LaunchAgents/com.visionwebworkspace.mac-builder-agent.plist"
  write_plist "$PLIST_PATH" ""
  launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
  launchctl load "$PLIST_PATH"
fi

echo "Mac Builder Agent installed on http://127.0.0.1:$PORT"
