#!/usr/bin/env bash

set -euo pipefail

fail() {
    echo "error: $*" >&2
    exit 1
}

command -v xcodebuild >/dev/null 2>&1 || fail "xcodebuild is required"

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
ios_dir=$(cd "$script_dir/.." && pwd -P)
project_path="$ios_dir/Reguerta.xcodeproj"
project_file="$project_path/project.pbxproj"

[[ -d "$project_path" ]] || fail "Xcode project not found at $project_path"
[[ -f "$project_file" ]] || fail "Xcode project file not found at $project_file"

expected_default_isolation=${REGUERTA_EXPECT_DEFAULT_ACTOR_ISOLATION:-nonisolated}
expected_swift_version=${REGUERTA_EXPECT_SWIFT_VERSION:-6.0}
expected_strict_concurrency=${REGUERTA_EXPECT_STRICT_CONCURRENCY:-complete}
expected_approachable_concurrency=${REGUERTA_EXPECT_APPROACHABLE_CONCURRENCY:-YES}
expected_deployment_target=${REGUERTA_EXPECT_IOS_DEPLOYMENT_TARGET:-26.0}

isolation_setting_count=$(grep -c 'SWIFT_DEFAULT_ACTOR_ISOLATION = ' "$project_file" || true)
nonisolated_setting_count=$(grep -c 'SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated;' "$project_file" || true)
[[ "$isolation_setting_count" == 2 && "$nonisolated_setting_count" == 2 ]] || \
    fail "default actor isolation must have exactly two project-level nonisolated declarations"

read_setting() {
    local settings_output=$1
    local setting_name=$2
    local setting_value

    setting_value=$(awk -v key="$setting_name" '$1 == key && $2 == "=" { print $3; exit }' <<<"$settings_output")
    [[ -n "$setting_value" ]] || fail "missing effective setting $setting_name"
    printf '%s' "$setting_value"
}

assert_setting() {
    local settings_output=$1
    local target_name=$2
    local configuration_name=$3
    local setting_name=$4
    local expected_value=$5
    local actual_value

    actual_value=$(read_setting "$settings_output" "$setting_name")
    if [[ "$actual_value" != "$expected_value" ]]; then
        fail "$target_name/$configuration_name: $setting_name expected $expected_value, found $actual_value"
    fi
}

targets=(Reguerta ReguertaTests ReguertaUITests)
configurations=(Debug Release)

for target_name in "${targets[@]}"; do
    for configuration_name in "${configurations[@]}"; do
        if ! settings_output=$(xcodebuild \
            -project "$project_path" \
            -target "$target_name" \
            -configuration "$configuration_name" \
            -sdk iphonesimulator \
            -onlyUsePackageVersionsFromResolvedFile \
            -showBuildSettings 2>&1); then
            echo "$settings_output" >&2
            fail "could not read settings for $target_name/$configuration_name"
        fi

        assert_setting "$settings_output" "$target_name" "$configuration_name" \
            SWIFT_DEFAULT_ACTOR_ISOLATION "$expected_default_isolation"
        assert_setting "$settings_output" "$target_name" "$configuration_name" \
            SWIFT_VERSION "$expected_swift_version"
        assert_setting "$settings_output" "$target_name" "$configuration_name" \
            SWIFT_STRICT_CONCURRENCY "$expected_strict_concurrency"
        assert_setting "$settings_output" "$target_name" "$configuration_name" \
            SWIFT_APPROACHABLE_CONCURRENCY "$expected_approachable_concurrency"
        assert_setting "$settings_output" "$target_name" "$configuration_name" \
            IPHONEOS_DEPLOYMENT_TARGET "$expected_deployment_target"

        printf 'ok: %-16s %-7s isolation=%s swift=%s strict=%s approachable=%s ios=%s\n' \
            "$target_name" \
            "$configuration_name" \
            "$expected_default_isolation" \
            "$expected_swift_version" \
            "$expected_strict_concurrency" \
            "$expected_approachable_concurrency" \
            "$expected_deployment_target"
    done
done
