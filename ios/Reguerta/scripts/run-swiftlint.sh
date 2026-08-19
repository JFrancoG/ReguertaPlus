#!/usr/bin/env bash

set -euo pipefail

fail() {
    echo "error: $*" >&2
    exit 1
}

swiftlint_bin=$(command -v swiftlint 2>/dev/null) || \
    fail "swiftlint is required on PATH; see README.md#swiftlint-from-xcode-on-apple-silicon"
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
ios_dir=$(cd "$script_dir/.." && pwd -P)
config_path="$ios_dir/.swiftlint.yml"
version_path="$ios_dir/.swiftlint-version"

[[ -f "$config_path" ]] || fail "SwiftLint configuration not found at $config_path"
[[ -f "$version_path" ]] || fail "SwiftLint version pin not found at $version_path"

expected_version=$(tr -d '[:space:]' <"$version_path")
[[ -n "$expected_version" ]] || fail "SwiftLint version pin is empty"

swiftlint_version=$("$swiftlint_bin" version) || fail "could not read the SwiftLint version"
[[ "$swiftlint_version" == "$expected_version" ]] || \
    fail "SwiftLint $expected_version is required, found $swiftlint_version at $swiftlint_bin"
echo "SwiftLint $swiftlint_version ($swiftlint_bin)"

cd "$ios_dir"
exec "$swiftlint_bin" lint \
    --strict \
    --no-cache \
    --config "$config_path" \
    --reporter xcode
