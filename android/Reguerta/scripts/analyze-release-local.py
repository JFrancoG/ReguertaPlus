#!/usr/bin/env python3
"""Evaluate HU-090's local Release AAB metrics using the official Android CLI.

This inspects a local artifact; it neither loads Firebase nor uploads the AAB.
It does not certify Play compliance, runtime journeys, or publication readiness.
The CLI may download its analysis tools on first use. Its complete stdout and
stderr are retained, including download progress preceding the JSON payload.

Only android analyze's bundleAnalysisResult.r8Json.stats are acceptance metrics;
configuration-analyzer scores and DEX/name heuristics cannot replace them.
Schema: https://developer.android.com/tools/agents/android-cli/commands/analyze
Size applicability: https://developer.android.com/google/play/vitals/code-optimization
The 10 MB app floor uses decimal bytes and includes the boundary. Ratio minimums
are HU-090's approved local gate; passing this script grants no release authority.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys

EXPECTED_PACKAGE = "com.reguerta.user"
DEX_FLOOR_BYTES = 10_000_000
MINIMUM_RATIO = 0.25
RATIOS = ("shrinkingRatio", "optimizationRatio", "obfuscationRatio")


class AnalysisError(ValueError):
    """The analysis does not establish the local artifact contract."""


def _object(value: object, name: str) -> dict:
    if not isinstance(value, dict):
        raise AnalysisError(f"Missing or invalid SDK object: {name}")
    return value


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise AnalysisError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def parse_sdk_output(raw: str) -> dict:
    """Accept a progress prefix, followed by exactly one complete SDK JSON object.

    Looking for a line-start object avoids treating braces in progress messages
    as the report. Extra JSON payloads or trailing non-whitespace fail closed.
    """
    def reject_constant(value: str):
        raise AnalysisError(f"Non-standard JSON numeric constant: {value}")

    decoder = json.JSONDecoder(object_pairs_hook=_unique_object, parse_constant=reject_constant)
    match = re.search(r"(?m)^[ \t]*\{", raw)
    if not match:
        raise AnalysisError("No complete android analyze JSON report with results")
    try:
        value, end = decoder.raw_decode(raw, match.end() - 1)
    except json.JSONDecodeError as error:
        raise AnalysisError("Invalid android analyze JSON report") from error
    if not isinstance(value, dict) or "results" not in value:
        raise AnalysisError("No complete android analyze JSON report with results")
    if raw[end:].strip():
        raise AnalysisError("Unexpected content after SDK JSON")
    return value


def _text(value: object) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _boolean(value: object) -> bool | None:
    return value if type(value) is bool else None


def evaluate_analysis(data: dict, artifact: Path) -> dict:
    """Evaluate actual SDK fields; absent proof is a failed gate, never a fallback."""
    results = _object(data, "report").get("results")
    if not isinstance(results, list) or len(results) != 1:
        raise AnalysisError("Expected exactly one SDK artifact in results")
    result = _object(results[0], "results[0]")
    reported_path = result.get("artifactPath")
    if not isinstance(reported_path, str) or Path(reported_path).resolve() != artifact.resolve():
        raise AnalysisError("SDK artifactPath does not match the requested AAB")
    info = _object(_object(result.get("basic"), "basic").get("appInfo"), "basic.appInfo")
    bundle = _object(
        _object(result.get("optimization"), "optimization").get("bundleAnalysisResult"),
        "optimization.bundleAnalysisResult",
    )
    reasons = []
    if info.get("packageName") != EXPECTED_PACKAGE:
        reasons.append(f"Expected package {EXPECTED_PACKAGE}")
    size = bundle.get("uncompressedDexSizeBytes")
    if isinstance(size, str) and re.fullmatch(r"0|[1-9][0-9]*", size):
        size = int(size)
    if type(size) is not int or size <= 0:
        raise AnalysisError("Expected a positive uncompressedDexSizeBytes integer")
    marker = bundle.get("r8DexMarkerMetadata")
    if not isinstance(marker, dict):
        marker = {}
        reasons.append("Missing SDK r8DexMarkerMetadata")
    if marker.get("r8Enabled") is not True:
        reasons.append("R8 is not proven enabled in DEX metadata")
    if marker.get("fullModeEnabled") is not True:
        reasons.append("R8 full mode is not proven enabled in DEX metadata")
    metadata = bundle.get("r8Json")
    if not isinstance(metadata, dict):
        metadata = {}
        reasons.append("Missing SDK r8Json artifact metadata")
    if metadata.get("r8DexChecksumStatus") != "EXACT_MATCH":
        reasons.append("R8 DEX checksum is not EXACT_MATCH")
    for field, value in (("agpVersion", bundle.get("agpVersion")), ("r8Json.version", metadata.get("version"))):
        if not isinstance(value, str) or not value.strip():
            reasons.append(f"Missing SDK {field}")
    stats = metadata.get("stats")
    if not isinstance(stats, dict):
        stats = {}
    ratios = {}
    applicable = size >= DEX_FLOOR_BYTES
    for name in RATIOS:
        value = stats.get(name)
        if type(value) not in (int, float) or not 0 <= value <= 1 or not math.isfinite(value):
            ratios[name] = None
            reasons.append(f"Missing or invalid r8Json.stats.{name}")
        else:
            ratios[name] = value
            if applicable and value < MINIMUM_RATIO:
                reasons.append(f"{name} is below {MINIMUM_RATIO}")
    return {
        "metrics": {
            "package": _text(info.get("packageName")), "version_code": _text(info.get("versionCode")),
            "version_name": _text(info.get("versionName")), "agp_version": _text(bundle.get("agpVersion")),
            "r8_version": _text(metadata.get("version")), "uncompressed_dex_size_bytes": size,
            "r8_enabled": _boolean(marker.get("r8Enabled")),
            "r8_full_mode_enabled": _boolean(marker.get("fullModeEnabled")),
            "d8_enabled": _boolean(marker.get("d8Enabled")),
            "r8_dex_checksum_status": _text(metadata.get("r8DexChecksumStatus")),
            "resource_optimization_status": _text(metadata.get("resourceOptimizationStatus")), "ratios": ratios,
        },
        "gate": {
            "passed": not reasons, "reasons": reasons,
            "ratio_threshold": {
                "applicable": applicable, "app_dex_floor_bytes_inclusive": DEX_FLOOR_BYTES,
                "minimum_each_ratio": MINIMUM_RATIO,
                "status": "applicable" if applicable else "not_applicable_below_10_MB",
            },
            "r8_metadata_required_below_size_floor": True,
        },
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aab", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--android", default="android", help="Official Android CLI executable")
    parser.add_argument("--analysis-json", type=Path, help="Replay SDK stdout for diagnosis; cannot pass a fresh-artifact gate")
    args = parser.parse_args(argv)
    artifact, output = args.aab.resolve(), args.output.resolve()
    raw_output = output.with_suffix(".stdout.raw").resolve()
    raw_errors = output.with_suffix(".stderr.raw").resolve()
    raw_version = output.with_suffix(".version.raw").resolve()
    destinations = (output, raw_output, raw_errors, raw_version)
    inputs = {artifact}
    if args.analysis_json:
        inputs.add(args.analysis_json.resolve())
    if len(set(destinations)) != len(destinations) or inputs.intersection(destinations):
        parser.error("Report/sidecar destinations must be distinct from all input files")
    report = {
        "schema_version": 1, "status": "rejected",
        "scope": {
            "local_artifact_metrics_only": True, "store_compliance_certified": False,
            "runtime_behavior_verified": False, "publication_authorized": False,
        },
        "artifact": {"path": str(artifact)},
        "analyzer": {"mode": "replayed" if args.analysis_json else "executed"},
        "gate": {"passed": False, "reasons": []},
    }
    try:
        if artifact.suffix.lower() != ".aab" or not artifact.is_file() or artifact.stat().st_size == 0:
            raise AnalysisError("--aab must name a nonempty existing AAB")
        output.parent.mkdir(parents=True, exist_ok=True)
        artifact_hash = sha256(artifact)
        report["artifact"].update({"sha256": artifact_hash, "size_bytes": artifact.stat().st_size})
        report["analyzer"].update({
            "stdout_path": str(raw_output), "stderr_path": str(raw_errors),
            "version_output_path": str(raw_version),
        })
        if args.analysis_json:
            raw = args.analysis_json.read_bytes()
            raw_output.write_bytes(raw)
            raw_errors.write_bytes(b"")
            raw_version.write_bytes(b"")
            report["analyzer"].update({"version": None, "source_path": str(args.analysis_json.resolve())})
        else:
            executable = shutil.which(args.android)
            if not executable:
                raise AnalysisError("Official Android CLI executable not found")
            report["analyzer"]["executable"] = str(Path(executable).resolve())
            version = subprocess.run([executable, "--version"], capture_output=True, check=False)
            raw_version.write_bytes(version.stdout + version.stderr)
            if version.returncode != 0 or not version.stdout.strip():
                raise AnalysisError("Android CLI version could not be established")
            report["analyzer"]["version"] = version.stdout.decode("utf-8").strip()
            command = [executable, "analyze", "--format=json", str(artifact)]
            report["analyzer"]["command"] = command
            result = subprocess.run(command, capture_output=True, check=False)
            raw = result.stdout
            raw_output.write_bytes(raw)
            raw_errors.write_bytes(result.stderr)
            report["analyzer"]["exit_code"] = result.returncode
            report["analyzer"]["stdout_sha256"] = hashlib.sha256(raw).hexdigest()
            if result.returncode != 0:
                raise AnalysisError(f"Android CLI analysis failed with exit code {result.returncode}; inspect raw stderr")
        report["analyzer"]["stdout_sha256"] = hashlib.sha256(raw).hexdigest()
        if sha256(artifact) != artifact_hash:
            raise AnalysisError("AAB changed during analysis")
        report.update(evaluate_analysis(parse_sdk_output(raw.decode("utf-8")), artifact))
        if args.analysis_json:
            report["gate"]["passed"] = False
            report["gate"]["reasons"].append("Replayed SDK JSON does not establish a fresh analysis of this AAB")
        report["status"] = "passed" if report["gate"]["passed"] else "rejected"
    except (AnalysisError, OSError, UnicodeError) as error:
        report["gate"] = {"passed": False, "reasons": [str(error)]}
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    except OSError as error:
        print(f"Cannot save analysis report: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"status": report["status"], "report": str(output), "gate": report["gate"]}))
    return 0 if report["gate"]["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
