"""Independent fixtures for local benchmark parsing, safety fences and limits."""

import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "benchmark_local_release", Path(__file__).with_name("benchmark-local-release.py")
)
benchmark = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(benchmark)
VALIDATION_COMPONENT = "com.reguerta.user.validation/com.reguerta.user.MainActivity"
HOME_COMPONENT = "com.android.launcher/com.android.launcher.Launcher"


class LocalBenchmarkTests(unittest.TestCase):
    def test_startup_records_total_time_instead_of_wait_or_this_time(self):
        good = ("Status: ok\nLaunchState: COLD\nActivity: " + VALIDATION_COMPONENT +
                "\nThisTime: 100\nTotalTime: 250\nWaitTime: 340\nComplete\n")
        self.assertEqual(benchmark.parse_total_time(good, VALIDATION_COMPONENT), 250)
        self.assertEqual(benchmark.parse_total_time(good.replace("LaunchState: COLD\n", ""),
                                                   VALIDATION_COMPONENT), 250)
        for invalid in (
            good.replace("Status: ok", "Status: timeout"),
            "Warning: Activity not started\n" + good,
            good.replace("TotalTime: 250\n", ""),
            good.replace("TotalTime: 250", "TotalTime: 0"),
            good + "TotalTime: 3\n",
        ):
            with self.subTest(output=invalid):
                with self.assertRaises(benchmark.BenchmarkError):
                    benchmark.parse_total_time(invalid, VALIDATION_COMPONENT)

    def test_reported_launcher_race_is_rejected_even_with_ok_status_and_cold_state(self):
        # Real rejected output: observing QA Home later cannot make this launcher time valid.
        output = ("Status: ok\nLaunchState: COLD\n"
                  "Activity: com.google.android.apps.nexuslauncher/.NexusLauncherActivity\n"
                  "TotalTime: 7\nWaitTime: 8\nComplete\n")
        with self.assertRaises(benchmark.BenchmarkError):
            benchmark.parse_total_time(output, VALIDATION_COMPONENT)

    def test_missing_or_ambiguous_status_activity_and_non_cold_states_cannot_produce_a_sample(self):
        good = "Status: ok\nActivity: " + VALIDATION_COMPONENT + "\nTotalTime: 250\n"
        for invalid in (
            good.replace("Status: ok\n", ""),
            good + "Status: ok\n",
            good + "Status: timeout extra\n",
            good.replace("Activity: " + VALIDATION_COMPONENT + "\n", ""),
            good + "Activity: " + VALIDATION_COMPONENT + "\n",
            good + "LaunchState: WARM\n",
            good + "LaunchState: HOT\n",
            good + "LaunchState: \n",
            good + "LaunchState: COLD\nLaunchState: COLD\n",
        ):
            with self.subTest(output=invalid):
                with self.assertRaises(benchmark.BenchmarkError):
                    benchmark.parse_total_time(invalid, VALIDATION_COMPONENT)

    def test_equivalent_android_component_shorthand_is_matched_by_identity(self):
        output = ("Status: ok\nActivity: com.reguerta.user.validation/com.reguerta.user.validation.MainActivity\n"
                  "TotalTime: 250\n")
        self.assertEqual(benchmark.parse_total_time(output, "com.reguerta.user.validation/.MainActivity"), 250)

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
            "ui_automation_control": {
                "controller_package": benchmark.LAYOUT_CONTROLLER,
                "snapshots": [{"home_verified": True, "controller_pid_absent": True} for _ in range(24)],
                "memory_states": {
                    state: {"controller_absent_before_settle": True,
                            "home_verified_before_settle": state == "foreground",
                            "samples": [{"controller_pid_absent": True} for _ in range(5)]}
                    for state in ("foreground", "background")
                },
            },
            "apk": {"package": "com.reguerta.user.validation", "version_code": "37"},
            "launcher_component": VALIDATION_COMPONENT,
            "home_launcher_component": HOME_COMPONENT,
            "prelaunch_fences": [{"home_observations": [HOME_COMPONENT, HOME_COMPONENT],
                                   "target_pid_absent_before_start": True,
                                   "timed_activity": VALIDATION_COMPONENT} for _ in range(23)],
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
            lambda r: r["prelaunch_fences"].pop(),
            lambda r: r["prelaunch_fences"][0].update(home_observations=[HOME_COMPONENT]),
            lambda r: r["prelaunch_fences"][0].update(timed_activity=HOME_COMPONENT),
            lambda r: r.pop("ui_automation_control"),
            lambda r: r["ui_automation_control"]["snapshots"].pop(),
            lambda r: r["ui_automation_control"]["memory_states"]["foreground"].update(
                home_verified_before_settle=False,
            ),
            lambda r: r["ui_automation_control"]["memory_states"]["background"]["samples"][0].update(
                controller_pid_absent=False,
            ),
        ):
            changed = copy.deepcopy(original)
            mutate(changed)
            with self.assertRaises(benchmark.BenchmarkError):
                benchmark.compare_reports(self.report("baseline"), changed)

    def test_foreground_samples_follow_quiesced_home_and_a_full_settle_without_reopening_layout(self):
        recorder = FakeMemoryRecorder()
        with patch.object(benchmark.time, "monotonic", lambda: recorder.now), \
                patch.object(benchmark.time, "sleep", recorder.sleep):
            values = recorder.settle_and_sample_memory(foreground=True, marker="QA Home")

        self.assertEqual(values, [1263616] * 5)
        layout = recorder.events.index(("command", ("android", "layout", "--device", "emulator-owned")))
        stopped = recorder.events.index(("command", recorder.adb_command(
            "shell", "am", "force-stop", benchmark.LAYOUT_CONTROLLER,
        )))
        absent = recorder.events.index(("command", recorder.adb_command(
            "shell", "pidof", benchmark.LAYOUT_CONTROLLER,
        )))
        settled = recorder.events.index(("sleep", 60))
        samples = [index for index, event in enumerate(recorder.events) if event == (
            "command", recorder.adb_command("shell", "dumpsys", "meminfo", benchmark.PACKAGE),
        )]
        self.assertLess(layout, stopped)
        self.assertLess(stopped, absent)
        self.assertLess(absent, settled)
        self.assertEqual(len(samples), 5)
        self.assertTrue(all(index > settled for index in samples))
        self.assertFalse(any(event[0] == "command" and event[1][0] == "android"
                             for event in recorder.events[settled + 1:]))
        self.assertEqual(recorder.report["settle_actual_seconds"]["foreground"], 60)
        proof = recorder.report["ui_automation_control"]["memory_states"]["foreground"]
        self.assertTrue(proof["home_verified_before_settle"])
        self.assertEqual(len(proof["samples"]), 5)

    def test_background_sampling_uses_home_key_without_starting_a_layout_session(self):
        recorder = FakeMemoryRecorder()
        with patch.object(benchmark.time, "monotonic", lambda: recorder.now), \
                patch.object(benchmark.time, "sleep", recorder.sleep):
            values = recorder.settle_and_sample_memory(foreground=False, marker="QA Home")

        self.assertEqual(values, [1263616] * 5)
        self.assertFalse(recorder.foreground)
        self.assertEqual(recorder.events[0], ("command", recorder.adb_command(
            "shell", "input", "keyevent", "KEYCODE_HOME",
        )))
        self.assertFalse(any(event[0] == "command" and event[1][0] == "android"
                             for event in recorder.events))
        self.assertEqual(recorder.report["settle_actual_seconds"]["background"], 60)

    def test_persisting_or_unstoppable_layout_controller_aborts_before_settle_or_pss(self):
        for option in ("sticky_controller", "stop_fails"):
            with self.subTest(option=option):
                recorder = FakeMemoryRecorder(**{option: True})
                with patch.object(benchmark.time, "monotonic", lambda: recorder.now), \
                        patch.object(benchmark.time, "sleep", recorder.sleep):
                    with self.assertRaises(benchmark.BenchmarkError):
                        recorder.settle_and_sample_memory(foreground=True, marker="QA Home")
                self.assertNotIn(("sleep", 60), recorder.events)
                self.assertFalse(any(event == ("command", recorder.adb_command(
                    "shell", "dumpsys", "meminfo", benchmark.PACKAGE,
                )) for event in recorder.events))

    def test_controller_reactivation_during_settle_aborts_before_reading_pss(self):
        recorder = FakeMemoryRecorder(reactivate_during_settle=True)
        with patch.object(benchmark.time, "monotonic", lambda: recorder.now), \
                patch.object(benchmark.time, "sleep", recorder.sleep):
            with self.assertRaises(benchmark.BenchmarkError):
                recorder.settle_and_sample_memory(foreground=True, marker="QA Home")
        self.assertIn(("sleep", 60), recorder.events)
        self.assertFalse(any(event == ("command", recorder.adb_command(
            "shell", "dumpsys", "meminfo", benchmark.PACKAGE,
        )) for event in recorder.events))
        self.assertEqual(recorder.report["ui_automation_control"]["memory_states"]["foreground"]["samples"], [])

    def test_failed_snapshot_still_stops_its_controller_and_does_not_measure(self):
        recorder = FakeMemoryRecorder(snapshot_fails=True)
        with patch.object(benchmark.time, "monotonic", lambda: recorder.now), \
                patch.object(benchmark.time, "sleep", recorder.sleep):
            with self.assertRaises(benchmark.BenchmarkError):
                recorder.settle_and_sample_memory(foreground=True, marker="QA Home")
        self.assertFalse(recorder.controller_running)
        self.assertNotIn(("sleep", 60), recorder.events)
        self.assertEqual(recorder.report["ui_automation_control"]["snapshots"][0]["home_verified"], False)

    def test_launch_waits_for_two_resolved_home_observations_before_stopping_or_starting_target(self):
        recorder = FakeLaunchRecorder(home_sequence=[VALIDATION_COMPONENT, HOME_COMPONENT, HOME_COMPONENT])
        with patch.object(benchmark.time, "monotonic", lambda: recorder.now), \
                patch.object(benchmark.time, "sleep", recorder.sleep):
            measured = recorder.launch(VALIDATION_COMPONENT, "QA Home", home_component=HOME_COMPONENT)

        self.assertEqual(measured, 250)
        fence = recorder.report["prelaunch_fences"][0]
        self.assertEqual(fence["home_observations"], [VALIDATION_COMPONENT, HOME_COMPONENT, HOME_COMPONENT])
        self.assertTrue(fence["target_pid_absent_before_start"])
        self.assertEqual(fence["timed_activity"], VALIDATION_COMPONENT)
        home = recorder.events.index(("command", recorder.adb_command(
            "shell", "input", "keyevent", "KEYCODE_HOME",
        )))
        stopped = recorder.events.index(("command", recorder.adb_command(
            "shell", "am", "force-stop", benchmark.PACKAGE,
        )))
        pid_gone = recorder.events.index(("command", recorder.adb_command("shell", "pidof", benchmark.PACKAGE)))
        started = recorder.events.index(("command", recorder.start_command()))
        self.assertLess(home, stopped)
        self.assertLess(stopped, pid_gone)
        self.assertLess(pid_gone, started)
        self.assertEqual(recorder.observations_before_target_stop, 3)

    def test_unstable_or_unobservable_home_aborts_without_force_stopping_or_timing_the_target(self):
        for sequence in ([HOME_COMPONENT, VALIDATION_COMPONENT, HOME_COMPONENT, VALIDATION_COMPONENT], [None]):
            with self.subTest(sequence=sequence):
                recorder = FakeLaunchRecorder(home_sequence=sequence)
                with patch.object(benchmark.time, "monotonic", lambda: recorder.now), \
                        patch.object(benchmark.time, "sleep", recorder.sleep):
                    with self.assertRaises(benchmark.BenchmarkError):
                        recorder.launch(VALIDATION_COMPONENT, "QA Home", home_component=HOME_COMPONENT)
                self.assertTrue(recorder.target_running)
                self.assertNotIn(("command", recorder.adb_command(
                    "shell", "am", "force-stop", benchmark.PACKAGE,
                )), recorder.events)
                self.assertNotIn(("command", recorder.start_command()), recorder.events)

    def test_late_home_observation_cannot_rescue_a_wrong_activity_timing(self):
        output = ("Status: ok\nLaunchState: COLD\n"
                  "Activity: com.google.android.apps.nexuslauncher/.NexusLauncherActivity\nTotalTime: 7\n")
        recorder = FakeLaunchRecorder(start_output=output)
        with patch.object(benchmark.time, "monotonic", lambda: recorder.now), \
                patch.object(benchmark.time, "sleep", recorder.sleep):
            with self.assertRaises(benchmark.BenchmarkError):
                recorder.launch(VALIDATION_COMPONENT, "QA Home", home_component=HOME_COMPONENT)
        self.assertTrue(recorder.foreground)  # The app can appear after the wrong timing was returned.
        self.assertFalse(any(event[0] == "command" and event[1][0] == "android" for event in recorder.events))
        self.assertNotIn("timed_activity", recorder.report["prelaunch_fences"][0])


class FakeMemoryRecorder(benchmark.Recorder):
    """Model the app/controller independently; no subprocess, device or real sleep."""

    def __init__(self, *, sticky_controller=False, stop_fails=False, snapshot_fails=False,
                 reactivate_during_settle=False):
        super().__init__({"commands": []}, "adb", "emulator-owned", "android")
        self.events = []
        self.now = 0
        self.controller_running = False
        self.foreground = True
        self.sticky_controller = sticky_controller
        self.stop_fails = stop_fails
        self.snapshot_fails = snapshot_fails
        self.reactivate_during_settle = reactivate_during_settle

    def adb_command(self, *parts):
        return ("adb", "-s", "emulator-owned", *parts)

    def sleep(self, seconds):
        self.events.append(("sleep", seconds))
        self.now += seconds
        if seconds == 60 and self.reactivate_during_settle:
            self.controller_running = True

    def run(self, command, **options):
        command = tuple(command)
        self.events.append(("command", command))
        if command == ("android", "layout", "--device", "emulator-owned"):
            self.controller_running = True
            if self.snapshot_fails:
                raise benchmark.BenchmarkError("Fake layout transport failed")
            return json.dumps([{"type": "APPLICATION", "active": True,
                                "content": [{"text": "QA Home"}]}])
        if command == self.adb_command("shell", "am", "force-stop", benchmark.LAYOUT_CONTROLLER):
            if self.stop_fails:
                raise benchmark.BenchmarkError("Fake controller stop failed")
            if not self.sticky_controller:
                self.controller_running = False
            return ""
        if command == self.adb_command("shell", "pidof", benchmark.LAYOUT_CONTROLLER):
            return "123\n" if self.controller_running else ""
        if command == self.adb_command("shell", "input", "keyevent", "KEYCODE_HOME"):
            self.foreground = False
            return ""
        if command == self.adb_command("shell", "dumpsys", "activity", "activities"):
            package = benchmark.PACKAGE if self.foreground else "com.android.launcher"
            return "mResumedActivity: ActivityRecord{abc u0 " + package + "/.Main t1}\n"
        if command == self.adb_command("shell", "pidof", benchmark.PACKAGE):
            return "456\n"
        if command == self.adb_command("shell", "dumpsys", "meminfo", benchmark.PACKAGE):
            return "TOTAL PSS: 1234   TOTAL RSS: 9999\n"
        raise AssertionError("Unexpected local command: " + str(command))


class FakeLaunchRecorder(FakeMemoryRecorder):
    def __init__(self, *, home_sequence=None, start_output=None):
        super().__init__()
        self.home_sequence = list(home_sequence if home_sequence is not None else [HOME_COMPONENT, HOME_COMPONENT])
        self.last_observation = self.home_sequence[-1]
        self.prelaunch = False
        self.target_running = True
        self.observations_before_target_stop = 0
        self.observed_home = []
        self.start_output = start_output or ("Status: ok\nLaunchState: COLD\nActivity: " +
                                              VALIDATION_COMPONENT + "\nTotalTime: 250\n")

    def start_command(self):
        return self.adb_command("shell", "am", "start", "-W", "-a", "android.intent.action.MAIN",
                                "-c", "android.intent.category.LAUNCHER", "-n", VALIDATION_COMPONENT)

    def run(self, command, **options):
        command = tuple(command)
        if command == self.adb_command("shell", "input", "keyevent", "KEYCODE_HOME"):
            self.prelaunch = True
            return super().run(command, **options)
        if command == self.adb_command("shell", "dumpsys", "activity", "activities") and self.prelaunch:
            self.events.append(("command", command))
            if self.home_sequence:
                self.last_observation = self.home_sequence.pop(0)
            self.observed_home.append(self.last_observation)
            if self.last_observation is None:
                return "No observable resumed activity\n"
            return "mResumedActivity: ActivityRecord{abc u0 " + self.last_observation + " t1}\n"
        if command == self.adb_command("shell", "am", "force-stop", benchmark.PACKAGE):
            self.events.append(("command", command))
            if self.observed_home[-2:] != [HOME_COMPONENT, HOME_COMPONENT]:
                raise AssertionError("Target was stopped before two stable HOME observations")
            self.observations_before_target_stop = len(self.observed_home)
            self.target_running = False
            self.prelaunch = False
            return ""
        if command == self.adb_command("shell", "pidof", benchmark.PACKAGE):
            self.events.append(("command", command))
            return "456\n" if self.target_running else ""
        if command == self.start_command():
            self.events.append(("command", command))
            self.target_running = True
            self.foreground = True
            return self.start_output
        return super().run(command, **options)


if __name__ == "__main__":
    unittest.main()
