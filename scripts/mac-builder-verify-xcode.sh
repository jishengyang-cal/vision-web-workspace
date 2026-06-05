#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "mac-builder-verify-xcode must run on macOS." >&2
  exit 2
fi

command -v xcodebuild >/dev/null
command -v xcrun >/dev/null
command -v xcodegen >/dev/null

xcodebuild -version
xcode-select -p
xcrun --sdk xrsimulator --show-sdk-path
xcrun simctl list runtimes | grep -i "visionOS"
xcodegen --version

echo "Mac Builder Xcode toolchain verified."
