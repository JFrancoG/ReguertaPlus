#!/usr/bin/env bash

set -euo pipefail

usage() {
    cat <<'EOF'
Usage: validate-ios.sh <lane> --destination <xcode-destination> [options]

Lanes:
  fast-unit     Run the complete unit-test target with fast-unit-v1.
  ui-smoke      Run the four deterministic UI journeys with ui-smoke-v1.
  release-gate  Run lint, settings, Debug/Release builds, and the complete
                release-gate-v1 test plan.
  coverage      Run fast-unit-v1 with coverage and print the target report.

Required:
  --destination VALUE       Exact iOS 26 destination. Use a simulator ID or
                            include both name and OS version.

Result bundles:
  --result-bundle-path PATH New .xcresult path to create and report. Required
                            for coverage and optional for release-gate. The
                            release gate creates and retains a temporary bundle
                            outside the repository by default.

Example:
  ./scripts/validate-ios.sh fast-unit \
    --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'
EOF
}

fail() {
    echo "error: $*" >&2
    exit 1
}

[[ $# -gt 0 ]] || {
    usage >&2
    exit 1
}

if [[ "$1" == --help || "$1" == -h ]]; then
    usage
    exit 0
fi

lane=$1
shift
destination=""
result_bundle_path=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --destination)
            [[ $# -ge 2 && -n "$2" ]] || fail "--destination requires a value"
            destination=$2
            shift 2
            ;;
        --result-bundle-path)
            [[ $# -ge 2 && -n "$2" ]] || fail "--result-bundle-path requires a value"
            result_bundle_path=$2
            shift 2
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            fail "unknown argument: $1"
            ;;
    esac
done

case "$lane" in
    fast-unit|ui-smoke|release-gate|coverage)
        ;;
    *)
        fail "unknown lane: $lane"
        ;;
esac

[[ -n "$destination" ]] || fail "--destination is required"

if [[ "$lane" == coverage ]]; then
    [[ -n "$result_bundle_path" ]] || fail "coverage requires --result-bundle-path"
elif [[ -n "$result_bundle_path" && "$lane" != release-gate ]]; then
    fail "--result-bundle-path is only valid for release-gate or coverage"
fi

command -v xcodebuild >/dev/null 2>&1 || fail "xcodebuild is required"
command -v xcrun >/dev/null 2>&1 || fail "xcrun is required"
command -v plutil >/dev/null 2>&1 || fail "plutil is required"

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
ios_dir=$(cd "$script_dir/.." && pwd -P)
project_path="$ios_dir/Reguerta.xcodeproj"

[[ -d "$project_path" ]] || fail "Xcode project not found at $project_path"

validate_destination() {
    local id_pattern='(^|,)id=([^,]+)($|,)'
    local name_pattern='(^|,)name=([^,]+)($|,)'
    local os_26_pattern='(^|,)OS=26([.][0-9]+)*($|,)'
    local uuid_pattern='^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$'
    local simulator_id
    local simulator_runtime
    local simulator_listing

    [[ ",$destination," == *",platform=iOS Simulator,"* ]] || \
        fail "destination must use platform=iOS Simulator"

    if [[ "$destination" =~ $id_pattern ]]; then
        simulator_id=${BASH_REMATCH[2]}
        [[ "$simulator_id" =~ $uuid_pattern ]] || fail "simulator id must be a UUID: $simulator_id"
        simulator_listing=$(xcrun simctl list devices available)
        simulator_runtime=$(awk -v id="$simulator_id" '
            /^-- iOS [0-9]/ { runtime = $3 }
            index($0, "(" id ")") { print runtime; exit }
        ' <<<"$simulator_listing")
        [[ "$simulator_runtime" == 26 || "$simulator_runtime" == 26.* ]] || \
            fail "simulator id $simulator_id is not an available iOS 26 destination"
        return
    fi

    [[ "$destination" =~ $name_pattern && "$destination" =~ $os_26_pattern ]] || \
        fail "destination must include an iOS 26 simulator id or both name and OS=26.x"
}

prepare_result_bundle() {
    local temporary_directory

    if [[ -z "$result_bundle_path" ]]; then
        temporary_directory=$(mktemp -d -t reguerta-release-gate)
        result_bundle_path="$temporary_directory/release-gate-v1.xcresult"
    fi

    [[ ! -e "$result_bundle_path" ]] || fail "result bundle path already exists: $result_bundle_path"
    printf 'Result bundle: %s\n' "$result_bundle_path"
}

summary_value() {
    local summary_json=$1
    local key=$2

    plutil -extract "$key" raw -o - - <<<"$summary_json"
}

report_test_summary() {
    local bundle_path=$1
    local summary_json

    summary_json=$(xcrun xcresulttool get test-results summary --path "$bundle_path")
    printf 'Test summary: total=%s passed=%s skipped=%s failed=%s result=%s\n' \
        "$(summary_value "$summary_json" totalTestCount)" \
        "$(summary_value "$summary_json" passedTests)" \
        "$(summary_value "$summary_json" skippedTests)" \
        "$(summary_value "$summary_json" failedTests)" \
        "$(summary_value "$summary_json" result)"
}

validate_destination

test_arguments=(
    -quiet
    -project "$project_path"
    -scheme Reguerta
    -configuration Debug
    -destination "$destination"
    -onlyUsePackageVersionsFromResolvedFile
)

run_test_plan() {
    local plan_name=$1
    shift

    xcodebuild "${test_arguments[@]}" -testPlan "$plan_name" "$@" test
}

run_test_plan_with_summary() {
    local plan_name=$1
    local bundle_path=$2
    local test_status=0
    shift 2

    run_test_plan "$plan_name" -resultBundlePath "$bundle_path" "$@" || test_status=$?
    [[ -d "$bundle_path" ]] || fail "xcodebuild did not create result bundle: $bundle_path"
    report_test_summary "$bundle_path"
    return "$test_status"
}

case "$lane" in
    fast-unit)
        run_test_plan fast-unit-v1
        ;;
    ui-smoke)
        run_test_plan ui-smoke-v1
        ;;
    release-gate)
        prepare_result_bundle
        "$script_dir/run-swiftlint.sh"
        "$script_dir/verify-swift-settings.sh"

        xcodebuild \
            -quiet \
            -project "$project_path" \
            -scheme Reguerta \
            -configuration Debug \
            -destination 'generic/platform=iOS Simulator' \
            -onlyUsePackageVersionsFromResolvedFile \
            build \
            CODE_SIGNING_ALLOWED=NO

        xcodebuild \
            -quiet \
            -project "$project_path" \
            -scheme Reguerta-Production \
            -configuration Release \
            -destination 'generic/platform=iOS Simulator' \
            -onlyUsePackageVersionsFromResolvedFile \
            build \
            CODE_SIGNING_ALLOWED=NO

        run_test_plan_with_summary release-gate-v1 "$result_bundle_path"
        ;;
    coverage)
        prepare_result_bundle
        run_test_plan_with_summary \
            fast-unit-v1 \
            "$result_bundle_path" \
            -enableCodeCoverage YES

        xcrun xccov view --report --only-targets "$result_bundle_path"
        ;;
esac
