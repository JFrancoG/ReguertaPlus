#!/usr/bin/env bash

set -euo pipefail

usage() {
    cat <<'EOF'
Usage: audit-swift-existentials.sh [--diff | --all] [--base <git-ref>]

Runs Swift's opt-in ExistentialType diagnostic for the iOS app and test targets.

  --diff       Report diagnostics only on Swift lines changed from the merge base
               with origin/main (default).
  --all        Report every project-source diagnostic.
  --base REF   Compare --diff with the merge base of REF instead of origin/main.
  --help       Show this help.

This is an informational audit. Findings do not make the command fail; invalid
arguments, Git errors, build failures, and report-processing errors do.
EOF
}

fail() {
    echo "error: $*" >&2
    exit 1
}

mode="diff"
mode_was_set=false
base_ref="origin/main"
base_was_set=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --diff)
            [[ "$mode_was_set" == false ]] || fail "choose --diff or --all only once"
            mode="diff"
            mode_was_set=true
            shift
            ;;
        --all)
            [[ "$mode_was_set" == false ]] || fail "choose --diff or --all only once"
            mode="all"
            mode_was_set=true
            shift
            ;;
        --base)
            [[ "$base_was_set" == false ]] || fail "provide --base only once"
            [[ $# -ge 2 && -n "$2" ]] || fail "--base requires a Git ref"
            base_ref="$2"
            base_was_set=true
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

[[ "$mode" == "diff" || "$base_was_set" == false ]] || fail "--base can only be used with --diff"

command -v git >/dev/null 2>&1 || fail "git is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"
command -v xcodebuild >/dev/null 2>&1 || fail "xcodebuild is required"

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
ios_dir=$(cd "$script_dir/.." && pwd -P)
repo_root=$(git -C "$ios_dir" rev-parse --show-toplevel 2>/dev/null) || fail "the script is not inside a Git worktree"

project_path="$ios_dir/Reguerta.xcodeproj"
[[ -d "$project_path" ]] || fail "Xcode project not found at $project_path"

merge_base=""
if [[ "$mode" == "diff" ]]; then
    git -C "$repo_root" rev-parse --verify --quiet "${base_ref}^{commit}" >/dev/null || fail "invalid base ref: $base_ref"
    merge_base=$(git -C "$repo_root" merge-base "$base_ref" HEAD) || fail "no merge base found for $base_ref and HEAD"
    [[ -n "$merge_base" ]] || fail "no merge base found for $base_ref and HEAD"
fi

audit_tmp=$(mktemp -d "${TMPDIR:-/tmp}/reguerta-existential-audit.XXXXXX") || fail "could not create a temporary directory"

cleanup() {
    local directory_name
    directory_name=$(basename "$audit_tmp")
    if [[ -d "$audit_tmp" && "$directory_name" == reguerta-existential-audit.* ]]; then
        rm -rf -- "$audit_tmp"
    fi
}
trap cleanup EXIT

audit_log="$audit_tmp/xcodebuild.log"

echo "Building Reguerta with Swift ExistentialType diagnostics enabled..."
if ! xcodebuild -quiet \
    -project "$project_path" \
    -scheme Reguerta \
    -configuration Debug \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$audit_tmp/DerivedData" \
    build-for-testing \
    'SWIFT_TREAT_WARNINGS_AS_ERRORS=NO' \
    'SWIFT_SUPPRESS_WARNINGS=NO' \
    'OTHER_SWIFT_FLAGS=$(inherited) -Wwarning ExistentialType' \
    >"$audit_log" 2>&1; then
    cat "$audit_log" >&2
    fail "xcodebuild failed; the existential report was not generated"
fi

python3 - "$audit_log" "$repo_root" "$ios_dir" "$mode" "$merge_base" "$base_ref" <<'PYTHON'
import os
import re
import subprocess
import sys
from pathlib import Path


def fail(message):
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def git(repo_root, *arguments):
    result = subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        fail(detail or f"git {' '.join(arguments)} failed")
    return result.stdout


def relative_to(path, parent):
    try:
        return path.relative_to(parent)
    except ValueError:
        return None


def changed_swift_lines(repo_root, merge_base):
    changed = {}
    tracked_output = git(repo_root, "diff", "--name-only", "-z", merge_base, "--")
    untracked_output = git(repo_root, "ls-files", "--others", "--exclude-standard", "-z", "--")

    tracked_paths = [Path(os.fsdecode(item)) for item in tracked_output.split(b"\0") if item]
    untracked_paths = [Path(os.fsdecode(item)) for item in untracked_output.split(b"\0") if item]

    hunk_pattern = re.compile(rb"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
    for relative_path in tracked_paths:
        if relative_path.suffix != ".swift":
            continue
        absolute_path = repo_root / relative_path
        if not absolute_path.is_file():
            continue
        diff = git(
            repo_root,
            "diff",
            "--unified=0",
            "--no-color",
            "--no-ext-diff",
            "--no-renames",
            merge_base,
            "--",
            str(relative_path),
        )
        line_numbers = changed.setdefault(relative_path.as_posix(), set())
        for line in diff.splitlines():
            match = hunk_pattern.match(line)
            if match is None:
                continue
            start = int(match.group(1))
            count = int(match.group(2)) if match.group(2) is not None else 1
            line_numbers.update(range(start, start + count))

    for relative_path in untracked_paths:
        if relative_path.suffix != ".swift":
            continue
        absolute_path = repo_root / relative_path
        if not absolute_path.is_file():
            continue
        try:
            line_count = len(absolute_path.read_bytes().splitlines())
        except OSError as error:
            fail(f"could not read untracked file {relative_path}: {error}")
        changed[relative_path.as_posix()] = set(range(1, line_count + 1))

    return changed


if len(sys.argv) != 7:
    fail("internal argument error")

log_path = Path(sys.argv[1])
repo_root = Path(sys.argv[2]).resolve()
ios_dir = Path(sys.argv[3]).resolve()
mode = sys.argv[4]
merge_base = sys.argv[5]
base_ref = sys.argv[6]

source_roots = tuple(
    (ios_dir / directory).resolve()
    for directory in ("Reguerta", "ReguertaTests", "ReguertaUITests")
)
ansi_pattern = re.compile(r"\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
diagnostic_pattern = re.compile(
    r"^(?P<path>.+\.swift):(?P<line>\d+):(?P<column>\d+): warning: "
    r"(?P<message>.+)$"
)

try:
    log_lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
except OSError as error:
    fail(f"could not read xcodebuild output: {error}")

diagnostics = set()
for raw_line in log_lines:
    line = ansi_pattern.sub("", raw_line).strip()
    match = diagnostic_pattern.match(line)
    if match is None:
        continue

    # xcodebuild currently removes the diagnostic identifier that swiftc prints,
    # so retain the stable diagnostic category and its central wording instead.
    message = match.group("message")
    identifier = " [#ExistentialType]"
    if message.endswith(identifier):
        message = message[:-len(identifier)]
    if not message.startswith("Performance: ") or " uses an existential" not in message:
        continue

    source_path = Path(match.group("path"))
    if not source_path.is_absolute():
        source_path = ios_dir / source_path
    source_path = source_path.resolve()
    if not any(relative_to(source_path, root) is not None for root in source_roots):
        continue

    repo_relative = relative_to(source_path, repo_root)
    if repo_relative is None:
        continue
    diagnostics.add(
        (
            repo_relative.as_posix(),
            int(match.group("line")),
            int(match.group("column")),
            message,
        )
    )

ordered_diagnostics = sorted(diagnostics)
selected_diagnostics = ordered_diagnostics
if mode == "diff":
    changed = changed_swift_lines(repo_root, merge_base)
    selected_diagnostics = [
        diagnostic
        for diagnostic in ordered_diagnostics
        if diagnostic[1] in changed.get(diagnostic[0], set())
    ]

for path, line, column, message in selected_diagnostics:
    print(f"{path}:{line}:{column}: warning: {message} [#ExistentialType]")

if mode == "diff":
    print(
        "Existential audit completed: "
        f"{len(selected_diagnostics)} diagnostic(s) on Swift lines changed from "
        f"the merge base of {base_ref} ({merge_base[:12]}); "
        f"{len(ordered_diagnostics)} total project diagnostic(s)."
    )
else:
    print(
        "Existential audit completed: "
        f"{len(ordered_diagnostics)} total project diagnostic(s)."
    )
PYTHON
