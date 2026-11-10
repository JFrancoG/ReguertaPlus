#!/usr/bin/env python3
"""Collect a paired HU-090 local benchmark on the validation app only.

No Firebase APIs are called by this script. The caller must prepare the local
QA fixture/emulators and provide an exact observable Home marker. APKs are
installed with -r; application data is never cleared. These local metrics are
not Play vitals, TTID, or proof about the exact production AAB.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import shutil
import statistics
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

PACKAGE = "com.reguerta.user.validation"
ANDROID = "{http://schemas.android.com/apk/res/android}"
PROTOCOL = {
    "startup_metric": "am start -W TotalTime (ms), not TTID",
    "memory_metric": "dumpsys meminfo total PSS (bytes), not Anon RSS + Swap",
    "warmups": 3,
    "process_cold_launches": 20,
    "memory_samples_per_state": 5,
    "settle_seconds_per_state": 60,
    "sample_interval_seconds": 1,
    "art_compilation_mode": "speed",
    "percentile_method": "nearest rank",
}


class BenchmarkError(ValueError):
    """Evidence is missing, unsafe, or not comparable; it cannot become a pass."""


def parse_total_time(output: str) -> int:
    if "Activity not started" in output or re.search(r"^Status:\s*(?!ok\b)\S+", output, re.MULTILINE):
        raise BenchmarkError("am start did not establish a fresh successful launch")
    values = re.findall(r"^\s*TotalTime:\s*(\d+)\s*$", output, re.MULTILINE)
    if len(values) != 1 or int(values[0]) <= 0:
        raise BenchmarkError("Expected one positive am start TotalTime")
    return int(values[0])


def parse_total_pss(output: str) -> int:
    for pattern in (r"^\s*TOTAL PSS:\s*(\d+)\b", r"^\s*TOTAL:\s*(\d+)\b", r"^\s*TOTAL\s+(\d+)\b"):
        values = re.findall(pattern, output, re.MULTILINE)
        if values:
            if len(values) != 1 or int(values[0]) <= 0:
                raise BenchmarkError("Expected one positive total-PSS value")
            return int(values[0]) * 1024
    raise BenchmarkError("No total PSS found in dumpsys meminfo output")


def home_marker_present(xml: str, marker: str) -> bool:
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return False
    return any(
        node.get("package") == PACKAGE
        and node.get("visible-to-user", "true") != "false"
        and marker in (node.get("text"), node.get("content-desc"))
        for node in root.iter("node")
    )


def cli_home_marker_present(output: str, marker: str) -> bool:
    """Read only an active app window, never a system overlay or hidden node."""
    try:
        windows = json.loads(output)
    except json.JSONDecodeError:
        return False
    if not isinstance(windows, list):
        return False

    def contains(node):
        if isinstance(node, list):
            return any(contains(child) for child in node)
        if not isinstance(node, dict) or node.get("visible") is False:
            return False
        return marker in (node.get("text"), node.get("content-desc")) or any(
            contains(node.get(key, [])) for key in ("content", "children")
        )

    return any(isinstance(window, dict) and window.get("type") == "APPLICATION"
               and window.get("active") is True and contains(window) for window in windows)


def parse_resumed_package(output: str) -> str:
    packages = set(re.findall(
        r"(?:mResumedActivity|topResumedActivity)\s*[:=]\s*ActivityRecord\{[^}\n]*?\s([A-Za-z0-9_.]+)/[A-Za-z0-9_.$]+",
        output,
    ))
    if len(packages) != 1:
        raise BenchmarkError("Cannot establish one resumed package for the memory-state sample")
    return packages.pop()


def require_validation_manifest(xml: str) -> dict[str, str | None]:
    try:
        manifest = ET.fromstring(xml)
    except ET.ParseError as error:
        raise BenchmarkError("APK manifest could not be parsed") from error
    if manifest.tag != "manifest" or manifest.get("package") != PACKAGE:
        raise BenchmarkError("Only com.reguerta.user.validation APKs may be installed or launched")
    return {"package": PACKAGE, "version_code": manifest.get(ANDROID + "versionCode"),
            "version_name": manifest.get(ANDROID + "versionName")}


def require_validation_component(component: str) -> str:
    if not re.fullmatch(re.escape(PACKAGE) + r"/[A-Za-z0-9_.$]+", component):
        raise BenchmarkError("Resolved launcher does not belong to the validation package")
    return component


def sdk_tool_version(executable: str) -> dict[str, str]:
    resolved = Path(shutil.which(executable) or executable).resolve()
    properties = resolved.parent.parent / "source.properties"
    revision = "unavailable"
    if properties.is_file():
        for line in properties.read_text().splitlines():
            if line.startswith("Pkg.Revision="):
                revision = line.split("=", 1)[1].strip()
    return {"executable": str(resolved), "sdk_package_revision": revision,
            "launcher_sha256": hashlib.sha256(resolved.read_bytes()).hexdigest()}


def summary(values: list[int]) -> dict[str, float | int]:
    if not values or any(type(value) is not int or value <= 0 for value in values):
        raise BenchmarkError("Expected positive integer samples")
    ordered = sorted(values)
    return {"count": len(values), "median": statistics.median(values),
            "p90": ordered[math.ceil(0.9 * len(ordered)) - 1], "max": max(values)}


def compare_reports(baseline: dict, optimized: dict) -> dict:
    if baseline.get("status") != "completed" or optimized.get("status") != "completed":
        raise BenchmarkError("Both measurement reports must be complete")
    if baseline.get("label") != "baseline" or optimized.get("label") != "optimized":
        raise BenchmarkError("Expected baseline then optimized reports")
    for key in ("schema_version", "protocol", "device", "tools", "home_text", "fixture_id"):
        if baseline.get(key) != optimized.get(key):
            raise BenchmarkError("Reports are not comparable: " + key)
    if baseline.get("protocol") != PROTOCOL or baseline.get("schema_version") != 1:
        raise BenchmarkError("Reports do not follow the approved local protocol")
    for key in ("platform", "logical_cpu_count"):
        if baseline.get("host", {}).get(key) != optimized.get("host", {}).get(key):
            raise BenchmarkError("Host measurement conditions differ: " + key)
    if not baseline.get("fixture_id") or baseline.get("fixture_id") == "unverified":
        raise BenchmarkError("A matching caller-supplied fixture identifier is required")
    for report in (baseline, optimized):
        device = report.get("device", {})
        properties = device.get("properties", {})
        if not device.get("serial") or type(device.get("page_size_bytes")) is not int:
            raise BenchmarkError("Exact serial and page-size metadata are required")
        if any(not properties.get(key) for key in ("ro.build.fingerprint", "ro.build.version.sdk", "ro.product.cpu.abi")):
            raise BenchmarkError("Device build/SDK/ABI metadata is incomplete")
        if not report.get("host", {}).get("platform") or not report.get("tools", {}).get("adb"):
            raise BenchmarkError("Host and tool metadata are incomplete")
        if not report.get("apk", {}).get("version_code"):
            raise BenchmarkError("APK version metadata is incomplete")
        if report.get("apk", {}).get("package") != PACKAGE or not report.get("home_verified"):
            raise BenchmarkError("Validation package and observable Home evidence are required")
        if not report.get("foreground_confirmed") or not report.get("background_confirmed"):
            raise BenchmarkError("Foreground and background states must be observed")
        if report.get("data_cleared") is not False:
            raise BenchmarkError("Application data must not be cleared between the pair")
        if len(report.get("startup_ms", [])) != 20:
            raise BenchmarkError("Expected 20 startup samples in each report")
        for state in ("foreground", "background"):
            if len(report.get("pss_bytes", {}).get(state, [])) != 5:
                raise BenchmarkError("Expected five PSS samples per state")
    if baseline["apk"].get("version_code") != optimized["apk"].get("version_code"):
        raise BenchmarkError("Version codes differ between the pair")

    comparisons = []
    for metric, before_values, after_values, fields, absolute in (
        ("startup_ms", baseline["startup_ms"], optimized["startup_ms"], ("median", "p90"), 50),
        ("foreground_pss_bytes", baseline["pss_bytes"]["foreground"], optimized["pss_bytes"]["foreground"],
         ("median", "max"), 10 * 1024 * 1024),
        ("background_pss_bytes", baseline["pss_bytes"]["background"], optimized["pss_bytes"]["background"],
         ("median", "max"), 10 * 1024 * 1024),
    ):
        before, after = summary(before_values), summary(after_values)
        for field in fields:
            allowed = max(before[field] * 0.1, absolute)
            increase = after[field] - before[field]
            comparisons.append({"metric": metric, "statistic": field, "baseline": before[field],
                                "optimized": after[field], "increase": increase,
                                "allowed_increase": allowed, "breach": increase > allowed})
    breached = any(item["breach"] for item in comparisons)
    return {
        "schema_version": 1,
        "status": "repeat_required" if breached else "within_proposed_local_limits",
        "comparisons": comparisons,
        "automatic_waiver": False,
        "next_action": (
            "Repeat the full matched pair; a repeated breach remains pending until fixed or accepted by the owner."
            if breached else "Local limits met for this pair; this is not Play vitals or publication approval."
        ),
    }


class Recorder:
    def __init__(self, report: dict, adb: str, serial: str, android: str):
        self.report, self.adb, self.serial, self.android = report, adb, serial, android

    def run(self, command: list[str], *, allowed=(0,), timeout=45, redact=False) -> str:
        started = time.monotonic()
        entry = {"command": command, "started_at": datetime.now(timezone.utc).isoformat()}
        self.report["commands"].append(entry)
        try:
            result = subprocess.run(command, text=True, capture_output=True, timeout=timeout)
        except (OSError, subprocess.TimeoutExpired) as error:
            entry.update({"elapsed_seconds": time.monotonic() - started, "error": type(error).__name__})
            raise BenchmarkError("Local command could not finish: " + command[0]) from error
        entry.update({"elapsed_seconds": time.monotonic() - started, "exit_code": result.returncode,
                      "stdout": "[verbose output omitted]" if redact else result.stdout[:16000],
                      "stderr": "[verbose output omitted]" if redact else result.stderr[:4000],
                      "stdout_truncated": len(result.stdout) > 16000})
        if result.returncode not in allowed:
            raise BenchmarkError(f"Local command failed with exit {result.returncode}: {command[0]}")
        return result.stdout

    def device(self, *args: str, **options) -> str:
        return self.run([self.adb, "-s", self.serial, *args], **options)

    def wait_for_home(self, marker: str) -> None:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            output = self.run([self.android, "layout", "--device", self.serial], redact=True)
            resumed = parse_resumed_package(self.device("shell", "dumpsys", "activity", "activities", redact=True))
            if resumed == PACKAGE and cli_home_marker_present(output, marker):
                return
            time.sleep(0.5)
        raise BenchmarkError("The exact validation-app Home marker was not observed")

    def launch(self, component: str, marker: str) -> int:
        self.device("shell", "am", "force-stop", PACKAGE)
        if self.device("shell", "pidof", PACKAGE, allowed=(0, 1)).strip():
            raise BenchmarkError("Validation process still runs after force-stop")
        output = self.device("shell", "am", "start", "-W", "-a", "android.intent.action.MAIN",
                             "-c", "android.intent.category.LAUNCHER", "-n", component, timeout=90)
        milliseconds = parse_total_time(output)
        self.wait_for_home(marker)
        return milliseconds

    def memory_samples(self, *, foreground: bool) -> list[int]:
        values = []
        for index in range(5):
            resumed = parse_resumed_package(self.device("shell", "dumpsys", "activity", "activities", redact=True))
            if (resumed == PACKAGE) != foreground:
                raise BenchmarkError("The observed memory-sample foreground/background state differs")
            if not self.device("shell", "pidof", PACKAGE, allowed=(0, 1)).strip():
                raise BenchmarkError("Validation process exited before a memory sample")
            values.append(parse_total_pss(self.device("shell", "dumpsys", "meminfo", PACKAGE)))
            if index < 4:
                time.sleep(1)
        return values


def measure(args, report: dict) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_.:\-]+", args.serial):
        raise BenchmarkError("Provide one exact adb serial")
    if not args.apk.is_file():
        raise BenchmarkError("APK does not exist")
    recorder = Recorder(report, args.adb, args.serial, args.android)
    manifest = recorder.run([args.apkanalyzer, "manifest", "print", str(args.apk)], redact=True)
    report["apk"] = {**require_validation_manifest(manifest), "path": str(args.apk.resolve()),
                     "sha256": hashlib.sha256(args.apk.read_bytes()).hexdigest()}
    if recorder.device("get-state").strip() != "device":
        raise BenchmarkError("The exact adb serial is not online")
    report["tools"] = {
        "adb": recorder.run([args.adb, "version"]).strip(),
        "apkanalyzer": sdk_tool_version(args.apkanalyzer),
        "android": recorder.run([args.android, "--version"]).strip(),
        "python": platform.python_version(),
    }
    props = {key: recorder.device("shell", "getprop", key).strip() for key in (
        "ro.build.fingerprint", "ro.build.version.release", "ro.build.version.sdk",
        "ro.product.model", "ro.product.cpu.abi", "ro.boot.qemu.avd_name", "ro.kernel.qemu",
    )}
    page_size = recorder.device("shell", "getconf", "PAGESIZE").strip()
    if not page_size.isdigit() or int(page_size) <= 0:
        raise BenchmarkError("Device page size is not observable")
    report["device"] = {"serial": args.serial, "properties": props, "page_size_bytes": int(page_size),
                        "screen_size": recorder.device("shell", "wm", "size").strip(),
                        "screen_density": recorder.device("shell", "wm", "density").strip()}
    report["host"] = {"platform": platform.platform(), "logical_cpu_count": os.cpu_count(),
                      "load_before": os.getloadavg()}
    report["label"], report["home_text"] = args.label, args.home_text
    report["fixture_id"] = args.fixture_id or "unverified"
    report["fixture_verification"] = "Caller-supplied identifier; backend state is not inspected by this script."
    report["protocol"], report["data_cleared"] = dict(PROTOCOL), False
    try:
        recorder.device("install", "-r", str(args.apk.resolve()), timeout=180)
        recorder.device("shell", "cmd", "package", "compile", "-m", "speed", "-f", PACKAGE, timeout=180)
        resolved = recorder.device("shell", "cmd", "package", "resolve-activity", "--brief",
                                   "-a", "android.intent.action.MAIN", "-c", "android.intent.category.LAUNCHER", PACKAGE)
        candidates = [line.strip() for line in resolved.splitlines() if "/" in line]
        if len(candidates) != 1:
            raise BenchmarkError("Expected one validation launcher component")
        component = require_validation_component(candidates[0])
        report["launcher_component"] = component
        report["warmup_ms"], report["startup_ms"] = [], []
        for index in range(3):
            report["warmup_ms"].append(recorder.launch(component, args.home_text))
            print(f"Warm-up {index + 1}/3 complete", flush=True)
        for index in range(20):
            value = recorder.launch(component, args.home_text)
            report["startup_ms"].append(value)
            print(f"Process-cold launch {index + 1}/20: TotalTime={value} ms", flush=True)
        print("Settling on confirmed Home for 60 seconds", flush=True)
        settled_at = time.monotonic()
        time.sleep(60)
        report["settle_actual_seconds"] = {"foreground": time.monotonic() - settled_at}
        recorder.wait_for_home(args.home_text)
        report["home_verified"] = True
        report["pss_bytes"] = {"foreground": recorder.memory_samples(foreground=True)}
        report["foreground_confirmed"] = True
        recorder.device("shell", "input", "keyevent", "KEYCODE_HOME")
        print("Settling in background for 60 seconds", flush=True)
        settled_at = time.monotonic()
        time.sleep(60)
        report["settle_actual_seconds"]["background"] = time.monotonic() - settled_at
        report["pss_bytes"]["background"] = recorder.memory_samples(foreground=False)
        report["background_confirmed"] = True
        report["summaries"] = {"startup_ms": summary(report["startup_ms"]),
                               "pss_bytes": {state: summary(values) for state, values in report["pss_bytes"].items()}}
        report["host"]["load_after"] = os.getloadavg()
        report["status"] = "completed"
        report["acceptance_eligible"] = report["fixture_id"] != "unverified"
    finally:
        # Android CLI owns its local layout transport; no app data is changed.
        pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", help="One exact adb device serial; no default device selection")
    parser.add_argument("--apk", type=Path)
    parser.add_argument("--label", choices=("baseline", "optimized"))
    parser.add_argument("--home-text", help="Exact visible text or content-description belonging to validation Home")
    parser.add_argument("--fixture-id", help="Same seed/dataset identifier for both sides of a pair")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--compare", nargs=2, type=Path, metavar=("BASELINE_JSON", "OPTIMIZED_JSON"))
    parser.add_argument("--adb", default=shutil.which("adb") or "adb")
    parser.add_argument("--apkanalyzer", default=shutil.which("apkanalyzer") or "apkanalyzer")
    parser.add_argument("--android", default=shutil.which("android") or "android")
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output already exists; choose a new path to retain prior evidence")
    if args.compare and any((args.serial, args.apk, args.label, args.home_text, args.fixture_id)):
        parser.error("Compare mode cannot also operate a device")
    if not args.compare and not all((args.serial, args.apk, args.label, args.home_text)):
        parser.error("Measurement requires --serial, --apk, --label and --home-text")
    report = {"schema_version": 1, "started_at": datetime.now(timezone.utc).isoformat(), "commands": []}
    exit_code = 0
    try:
        if args.compare:
            report = compare_reports(*(json.loads(path.read_text()) for path in args.compare))
            report["source_reports"] = [str(path.resolve()) for path in args.compare]
            exit_code = 2 if report["status"] == "repeat_required" else 0
        else:
            measure(args, report)
    except (BenchmarkError, OSError, json.JSONDecodeError, KeyError, TypeError) as error:
        report.update({"status": "error", "reason": str(error)})
        exit_code = 1
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": report["status"], "output": str(args.output)}), flush=True)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
