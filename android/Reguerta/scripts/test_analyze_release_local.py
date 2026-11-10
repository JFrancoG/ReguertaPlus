"""Independent SDK-shaped fixtures exercise local artifact evidence and failures."""

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("analyze-release-local.py")
SPEC = importlib.util.spec_from_file_location("analyze_release_local", SCRIPT)
analysis = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(analysis)


class ReleaseAnalysisTests(unittest.TestCase):
    def fixture(self, artifact=Path("/tmp/example-release.aab"), size="20000000", ratio=0.8):
        # SDK application report, deliberately distinct from library/config scores.
        return {"results": [{
            "artifactPath": str(artifact),
            "basic": {"appInfo": {"packageName": "com.reguerta.user", "versionCode": "37", "versionName": "0.3.0.1"}},
            "optimization": {"bundleAnalysisResult": {
                "agpVersion": "9.5.1", "uncompressedDexSizeBytes": size,
                "r8DexMarkerMetadata": {"r8Enabled": True, "d8Enabled": False, "fullModeEnabled": True},
                "r8Json": {
                    "version": "9.5.17", "r8DexChecksumStatus": "EXACT_MATCH",
                    "stats": {"shrinkingRatio": ratio, "optimizationRatio": ratio, "obfuscationRatio": ratio},
                    "resourceOptimizationStatus": "R8_RESOURCE_OPTIMIZATION_STATUS_ENABLED",
                },
                "dexHeuristicObfuscationRatio": 1.0, "mappingObfuscationRatio": 1.0,
            }},
        }]}

    def evaluate(self, data):
        return analysis.evaluate_analysis(data, Path("/tmp/example-release.aab"))

    def bundle(self, data):
        return data["results"][0]["optimization"]["bundleAnalysisResult"]

    def test_valid_metadata_and_all_three_artifact_ratios_pass(self):
        result = self.evaluate(self.fixture(ratio=0.25))
        self.assertTrue(result["gate"]["passed"])
        self.assertEqual(result["metrics"]["uncompressed_dex_size_bytes"], 20_000_000)
        self.assertEqual(result["metrics"]["r8_dex_checksum_status"], "EXACT_MATCH")
        self.assertEqual(result["metrics"]["ratios"], {
            "shrinkingRatio": 0.25, "optimizationRatio": 0.25, "obfuscationRatio": 0.25,
        })

    def test_each_ratio_is_required_and_cannot_be_replaced_by_other_scores(self):
        for name in ("shrinkingRatio", "optimizationRatio", "obfuscationRatio"):
            for value in (0.2499, None, True, "0.9", -0.1, 1.1, float("nan"), float("inf")):
                with self.subTest(name=name, value=value):
                    data = self.fixture()
                    self.bundle(data)["r8Json"]["stats"][name] = value
                    self.bundle(data)["configurationAnalyzer"] = {name: 1.0}
                    self.assertFalse(self.evaluate(data)["gate"]["passed"])

    def test_size_floor_is_inclusive_and_below_it_metadata_is_still_required(self):
        below = self.evaluate(self.fixture(size="9999999", ratio=0.01))
        self.assertTrue(below["gate"]["passed"])
        self.assertFalse(below["gate"]["ratio_threshold"]["applicable"])
        self.assertEqual(below["gate"]["ratio_threshold"]["status"], "not_applicable_below_10_MB")
        self.assertFalse(self.evaluate(self.fixture(size="10000000", ratio=0.01))["gate"]["passed"])
        for missing in ("r8Json", "r8DexMarkerMetadata"):
            data = self.fixture(size="1000", ratio=0.01)
            del self.bundle(data)[missing]
            self.assertFalse(self.evaluate(data)["gate"]["passed"])
        data = self.fixture(size="1000")
        del self.bundle(data)["r8Json"]["stats"]["optimizationRatio"]
        self.assertFalse(self.evaluate(data)["gate"]["passed"])

    def test_unoptimized_actual_sdk_shape_cannot_pass(self):
        data = self.fixture(size="68675776")
        bundle = self.bundle(data)
        del bundle["r8Json"]
        bundle["r8DexMarkerMetadata"] = {"r8Enabled": False, "d8Enabled": True, "fullModeEnabled": False}
        result = self.evaluate(data)
        self.assertFalse(result["gate"]["passed"])
        self.assertEqual(result["metrics"]["uncompressed_dex_size_bytes"], 68_675_776)
        self.assertIsNone(result["metrics"]["ratios"]["obfuscationRatio"])

    def test_package_marker_metadata_version_and_exact_checksum_are_required(self):
        for field, value in (("r8Enabled", False), ("fullModeEnabled", False), ("r8Enabled", 1)):
            data = self.fixture()
            self.bundle(data)["r8DexMarkerMetadata"][field] = value
            self.assertFalse(self.evaluate(data)["gate"]["passed"])
        for status in (None, "MISMATCH", "UNKNOWN", "exact_match"):
            data = self.fixture()
            self.bundle(data)["r8Json"]["r8DexChecksumStatus"] = status
            self.assertFalse(self.evaluate(data)["gate"]["passed"])
        data = self.fixture()
        data["results"][0]["basic"]["appInfo"]["packageName"] = "com.reguerta.user.validation"
        self.assertFalse(self.evaluate(data)["gate"]["passed"])
        for owner, key in (("bundle", "agpVersion"), ("r8", "version")):
            data = self.fixture()
            target = self.bundle(data) if owner == "bundle" else self.bundle(data)["r8Json"]
            del target[key]
            self.assertFalse(self.evaluate(data)["gate"]["passed"])

    def test_library_legacy_ambiguous_and_wrong_artifact_schemas_fail_closed(self):
        source = self.fixture()
        invalid = [{}, {"result": source["results"]}, {"results": []},
                   {"results": source["results"] * 2}, {"results": [None]}]
        library = copy.deepcopy(source)
        library["results"][0]["optimization"] = {"libraryAnalysisResult": {"dex": {"keepRatio": 1.0}}}
        invalid.append(library)
        wrong_path = copy.deepcopy(source)
        wrong_path["results"][0]["artifactPath"] = "/tmp/different-release.aab"
        invalid.append(wrong_path)
        for data in invalid:
            with self.subTest(data=data):
                with self.assertRaises(analysis.AnalysisError):
                    self.evaluate(data)

    def test_invalid_sizes_are_not_coerced(self):
        for size in (True, 1.2, "010000000", "1e7", "-1", 0, None):
            with self.subTest(size=size):
                with self.assertRaises(analysis.AnalysisError):
                    self.evaluate(self.fixture(size=size))

    def test_download_prefix_is_retained_outside_a_single_json_payload(self):
        expected = self.fixture()
        raw = "Downloading archive {progress}\n42%\n" + json.dumps(expected) + "\n"
        self.assertEqual(analysis.parse_sdk_output(raw), expected)
        for invalid in (
            "Downloading only", '{"results":', json.dumps(expected) + "\nerror",
            json.dumps(expected) + json.dumps(expected),
            '{"results": [], "results": []}',
            '{"outer":\n' + json.dumps(expected),
            '{"results": [], "invalid": NaN}',
        ):
            with self.subTest(raw=invalid):
                with self.assertRaises(analysis.AnalysisError):
                    analysis.parse_sdk_output(invalid)

    def invoke(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], capture_output=True, text=True)

    def test_cli_records_fresh_artifact_hash_version_and_unmodified_stdout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / "candidate.aab"
            artifact.write_bytes(b"local synthetic artifact")
            payload = self.fixture(artifact)
            raw = "Downloading tools\n[=====] 100%\n" + json.dumps(payload) + "\n"
            executable = root / "fake-android"
            executable.write_text(
                "#!/usr/bin/env python3\nimport sys\n"
                "if sys.argv[1:] == ['--version']: print('1.1.16717390')\n"
                f"elif sys.argv[1:] == ['analyze', '--format=json', {str(artifact.resolve())!r}]: sys.stdout.write({raw!r})\n"
                "else: sys.exit(19)\n"
            )
            executable.chmod(0o755)
            output = root / "report.json"
            result = self.invoke("--aab", artifact, "--output", output, "--android", executable)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            report = json.loads(output.read_text())
            self.assertEqual(report["status"], "passed")
            self.assertEqual(report["artifact"]["sha256"], hashlib.sha256(artifact.read_bytes()).hexdigest())
            self.assertEqual(report["analyzer"]["version"], "1.1.16717390")
            self.assertEqual(report["analyzer"]["mode"], "executed")
            self.assertEqual(output.with_suffix(".stdout.raw").read_text(), raw)
            self.assertFalse(report["scope"]["store_compliance_certified"])

    def test_replay_cannot_claim_fresh_evidence_or_overwrite_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, source, output = root / "candidate.aab", root / "sdk.json", root / "report.json"
            artifact.write_bytes(b"keep this artifact")
            source.write_text(json.dumps(self.fixture(artifact)))
            result = self.invoke("--aab", artifact, "--output", output, "--analysis-json", source)
            self.assertEqual(result.returncode, 1)
            report = json.loads(output.read_text())
            self.assertFalse(report["gate"]["passed"])
            self.assertEqual(report["analyzer"]["mode"], "replayed")
            self.assertIn("Replayed", report["gate"]["reasons"][-1])
            for destination in (artifact, source):
                previous = destination.read_bytes()
                result = self.invoke("--aab", artifact, "--output", destination, "--analysis-json", source)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(destination.read_bytes(), previous)

    def test_command_failure_keeps_diagnostics_and_cannot_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact, executable, output = root / "candidate.aab", root / "fake-android", root / "report.json"
            artifact.write_bytes(b"local synthetic artifact")
            executable.write_text(
                "#!/bin/sh\nif [ \"$1\" = '--version' ]; then echo '1.1.16717390'; exit 0; fi\n"
                "echo 'partial stdout'; echo 'analyzer failed' >&2; exit 7\n"
            )
            executable.chmod(0o755)
            result = self.invoke("--aab", artifact, "--output", output, "--android", executable)
            self.assertEqual(result.returncode, 1)
            self.assertFalse(json.loads(output.read_text())["gate"]["passed"])
            self.assertEqual(output.with_suffix(".stdout.raw").read_text(), "partial stdout\n")
            self.assertEqual(output.with_suffix(".stderr.raw").read_text(), "analyzer failed\n")


if __name__ == "__main__":
    unittest.main()
