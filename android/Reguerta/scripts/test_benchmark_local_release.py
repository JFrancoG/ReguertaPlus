"""Independent fixtures for local benchmark parsing, safety fences and limits."""

import copy
import importlib.util
import json
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location(
    "benchmark_local_release", Path(__file__).with_name("benchmark-local-release.py")
)
benchmark = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(benchmark)


class LocalBenchmarkTests(unittest.TestCase):
    def test_startup_records_total_time_instead_of_wait_or_this_time(self):
        self.assertEqual(benchmark.parse_total_time(
            "Status: ok\nThisTime: 100\nTotalTime: 250\nWaitTime: 340\nComplete\n"
        ), 250)
        for invalid in (
            "Status: timeout\nTotalTime: 250\n",
            "Warning: Activity not started\nTotalTime: 250\n",
            "Status: ok\nWaitTime: 250\n",
            "TotalTime: 0\n", "TotalTime: 2\nTotalTime: 3\n",
        ):
            with self.subTest(output=invalid):
                with self.assertRaises(benchmark.BenchmarkError):
                    benchmark.parse_total_time(invalid)

    def test_pss_uses_kib_and_not_rss_or_swap(self):
        for output in (
            "TOTAL PSS: 1234     TOTAL RSS: 9999\n",
            "TOTAL: 1234    TOTAL SWAP PSS: 99\n",
            "        TOTAL 1234 555 444 0 0 0\n",
        ):
            with self.subTest(output=output):
                self.assertEqual(benchmark.parse_total_pss(output), 1263616)
        for output in ("TOTAL RSS: 999\n", "No process found for package\n", "TOTAL PSS: 0\n"):
            with self.assertRaises(benchmark.BenchmarkError):
                benchmark.parse_total_pss(output)

    def test_home_marker_must_be_exact_and_belong_to_validation_app(self):
        good = '<hierarchy><node package="com.reguerta.user.validation" text="QA Home"/></hierarchy>'
        self.assertTrue(benchmark.home_marker_present(good, "QA Home"))
        for bad in (
            good.replace("com.reguerta.user.validation", "com.reguerta.user"),
            good.replace('text="QA Home"', 'text="Other QA Home screen"'),
            good.replace('text="QA Home"', 'text="QA Home" visible-to-user="false"'),
            "not XML",
        ):
            self.assertFalse(benchmark.home_marker_present(bad, "QA Home"))

    def test_memory_state_uses_resumed_package_not_any_activity_in_history(self):
        output = """Hist #1: ActivityRecord{one u0 com.reguerta.user.validation/.MainActivity t1}
          mResumedActivity: ActivityRecord{two u0 com.android.launcher/.Launcher t2}
        """
        self.assertEqual(benchmark.parse_resumed_package(output), "com.android.launcher")
        self.assertEqual(benchmark.parse_resumed_package(
            "topResumedActivity=ActivityRecord{a u0 com.reguerta.user.validation/com.reguerta.user.MainActivity t1}"
        ), "com.reguerta.user.validation")
        with self.assertRaises(benchmark.BenchmarkError):
            benchmark.parse_resumed_package("No resumed activity")
        with self.assertRaises(benchmark.BenchmarkError):
            benchmark.parse_resumed_package(output + "\n mResumedActivity: ActivityRecord{x u0 other.app/.Main t3}")

    def test_cli_marker_requires_an_active_application_window(self):
        window = {"type": "APPLICATION", "active": True,
                  "content": [{"children": [{"text": "Latest news"}]}]}
        self.assertTrue(benchmark.cli_home_marker_present(json.dumps([window]), "Latest news"))
        for change in ({"type": "SYSTEM"}, {"active": False}, {"visible": False},
                       {"content": [{"text": "Other Latest news"}]}):
            self.assertFalse(benchmark.cli_home_marker_present(json.dumps([{**window, **change}]), "Latest news"))
        self.assertFalse(benchmark.cli_home_marker_present("invalid", "Latest news"))

    def test_only_validation_apk_and_launcher_are_accepted(self):
        valid = '<manifest package="com.reguerta.user.validation"/>'
        self.assertEqual(benchmark.require_validation_manifest(valid)["package"], "com.reguerta.user.validation")
        for package in ("com.reguerta.user", "com.reguerta.user.debug", "another.app"):
            with self.assertRaises(benchmark.BenchmarkError):
                benchmark.require_validation_manifest(f'<manifest package="{package}"/>')
        self.assertEqual(benchmark.require_validation_component(
            "com.reguerta.user.validation/com.reguerta.user.MainActivity"
        ), "com.reguerta.user.validation/com.reguerta.user.MainActivity")
        with self.assertRaises(benchmark.BenchmarkError):
            benchmark.require_validation_component("com.reguerta.user/com.reguerta.user.MainActivity")

    def report(self, label, startup=100, pss=40 * 1024 * 1024):
        return {
            "schema_version": 1, "status": "completed", "label": label,
            "protocol": dict(benchmark.PROTOCOL),
            "device": {"serial": "emulator-test", "page_size_bytes": 4096, "properties": {
                "ro.build.fingerprint": "same-build", "ro.build.version.sdk": "29", "ro.product.cpu.abi": "arm64-v8a",
            }},
            "tools": {"adb": "fixed"}, "host": {"platform": "same-host", "logical_cpu_count": 8},
            "home_text": "QA Home", "home_verified": True, "fixture_id": "seed-v1", "data_cleared": False,
            "foreground_confirmed": True, "background_confirmed": True,
            "apk": {"package": "com.reguerta.user.validation", "version_code": "37"},
            "startup_ms": [startup] * 20,
            "pss_bytes": {"foreground": [pss] * 5, "background": [pss] * 5},
        }

    def test_nearest_rank_p90_and_median_are_named(self):
        result = benchmark.summary(list(range(1, 21)))
        self.assertEqual(result["median"], 10.5)
        self.assertEqual(result["p90"], 18)
        self.assertEqual(result["max"], 20)
        with self.assertRaises(benchmark.BenchmarkError):
            benchmark.summary([1, -1])

    def test_absolute_limits_and_repeated_breach_are_not_automatically_waived(self):
        baseline = self.report("baseline")
        at_limit = self.report("optimized", startup=150, pss=50 * 1024 * 1024)
        self.assertEqual(benchmark.compare_reports(baseline, at_limit)["status"], "within_proposed_local_limits")
        over_limit = self.report("optimized", startup=151, pss=50 * 1024 * 1024 + 1)
        for _ in range(2):
            result = benchmark.compare_reports(baseline, over_limit)
            self.assertEqual(result["status"], "repeat_required")
            self.assertFalse(result["automatic_waiver"])
            self.assertTrue(all(item["breach"] for item in result["comparisons"]))

    def test_relative_ten_percent_limit_applies_above_absolute_floor(self):
        result = benchmark.compare_reports(
            self.report("baseline", startup=1000, pss=200 * 1024 * 1024),
            self.report("optimized", startup=1101, pss=221 * 1024 * 1024),
        )
        self.assertEqual(result["status"], "repeat_required")
        self.assertEqual(result["comparisons"][0]["allowed_increase"], 100)

    def test_mismatched_incomplete_or_unverified_pairs_cannot_pass(self):
        original = self.report("optimized")
        for mutate in (
            lambda r: r.update(status="error"),
            lambda r: r["device"].update(page_size_bytes=16384),
            lambda r: r["device"]["properties"].update({"ro.build.fingerprint": ""}),
            lambda r: r.update(fixture_id="unverified"),
            lambda r: r.update(data_cleared=True),
            lambda r: r.update(home_verified=False),
            lambda r: r.update(background_confirmed=False),
            lambda r: r["startup_ms"].pop(),
            lambda r: r["pss_bytes"]["background"].pop(),
            lambda r: r["apk"].update(package="com.reguerta.user"),
            lambda r: r["apk"].update(version_code="38"),
            lambda r: r["host"].update(logical_cpu_count=16),
        ):
            changed = copy.deepcopy(original)
            mutate(changed)
            with self.assertRaises(benchmark.BenchmarkError):
                benchmark.compare_reports(self.report("baseline"), changed)


if __name__ == "__main__":
    unittest.main()
