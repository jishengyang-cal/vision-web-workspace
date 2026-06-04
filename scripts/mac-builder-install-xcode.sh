#!/usr/bin/env bash
set -euo pipefail

XCODE_XIP_PATH="${XCODE_XIP_PATH:-}"
XCODE_S3_URI="${XCODE_S3_URI:-}"
XCODE_APP_NAME="${XCODE_APP_NAME:-Xcode.app}"
WORK_DIR="${WORK_DIR:-$HOME/.vision-web-workspace/xcode-install}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "mac-builder-install-xcode must run on macOS." >&2
  exit 2
fi

mkdir -p "$WORK_DIR"

if [[ -z "$XCODE_XIP_PATH" && -n "$XCODE_S3_URI" ]]; then
  XCODE_XIP_PATH="$WORK_DIR/Xcode.xip"
  aws s3 cp "$XCODE_S3_URI" "$XCODE_XIP_PATH"
fi

if [[ -z "$XCODE_XIP_PATH" || ! -f "$XCODE_XIP_PATH" ]]; then
  echo "Set XCODE_XIP_PATH to a downloaded Xcode.xip, or XCODE_S3_URI to an S3 object containing Xcode.xip." >&2
  exit 2
fi

rm -rf "$WORK_DIR/$XCODE_APP_NAME"
xip --expand "$XCODE_XIP_PATH" "$WORK_DIR"
sudo rm -rf "/Applications/$XCODE_APP_NAME"
sudo mv "$WORK_DIR/$XCODE_APP_NAME" "/Applications/$XCODE_APP_NAME"
sudo xcode-select --switch "/Applications/$XCODE_APP_NAME/Contents/Developer"
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
xcodebuild -version
xcrun simctl list runtimes
