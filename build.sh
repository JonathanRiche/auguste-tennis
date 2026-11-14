#!/usr/bin/env bash
# Bundle the game and build the Android APK into dist/.
# Needs: bun, JDK 17, Gradle 8.11+, Android SDK (platform 36, build-tools 35.0.0).
# Set JAVA_HOME, ANDROID_HOME and GRADLE_BIN, or put them in an untracked local-env.sh.
set -euo pipefail
root=$(cd -- "$(dirname -- "$0")" && pwd)
[[ -f "$root/local-env.sh" ]] && source "$root/local-env.sh"
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK}"
export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"
[[ -n "${JAVA_HOME:-}" ]] && export PATH="$JAVA_HOME/bin:$PATH"
gradle_bin=${GRADLE_BIN:-gradle}

(cd "$root/game" && bun install --frozen-lockfile && bun run build)
"$gradle_bin" -p "$root/android" --no-daemon --console plain :app:assembleRelease
mkdir -p "$root/dist"
version=$(sed -n 's/.*versionName = "\(.*\)"/\1/p' "$root/android/app/build.gradle.kts")
cp "$root/android/app/build/outputs/apk/release/app-release.apk" "$root/dist/auguste-tennis-$version.apk"
echo "Built dist/auguste-tennis-$version.apk"
