#!/bin/bash
set -euo pipefail
base="$(cd "$(dirname "$0")/.." && pwd)"
rabbit_app="$base/release-v3/RabbitDesktop-darwin-arm64/RabbitDesktop.app"
[[ "$(uname -s)" == Darwin ]] || { echo '請在 Mac 上執行此簽章工具。'; exit 1; }
[[ -d "$rabbit_app" ]] || { echo '請先 npm run package:mac'; exit 1; }
/usr/bin/codesign --force --deep --sign - --entitlements "$base/packaging/Entitlements.plist" "$rabbit_app"
/usr/bin/codesign --verify --deep --strict "$rabbit_app"
echo '本機 ad-hoc 簽章完成。這不是 Developer ID 或 Apple 公證。'
