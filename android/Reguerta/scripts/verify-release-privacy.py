#!/usr/bin/env python3
"""Check final Android artifacts without loading Firebase or contacting a service.

The source manifest is not release evidence: merge directives and transitive SDK
manifests only become authoritative after packaging. APK/AAB inspection delegates
the binary XML formats to official Android tools. This verifies static defaults,
not runtime consent state, absence of all identifiers, or store compliance.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

ANDROID = "{http://schemas.android.com/apk/res/android}"
FORBIDDEN_PERMISSIONS = frozenset({
    "com.google.android.gms.permission.AD_ID",
    "android.permission.ACCESS_ADSERVICES_AD_ID",
    "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
})
DENIED_DEFAULTS = (
    "google_analytics_adid_collection_enabled",
    "google_analytics_default_allow_ad_storage",
    "google_analytics_default_allow_ad_user_data",
    "google_analytics_default_allow_ad_personalization_signals",
)


class PrivacyViolation(ValueError):
    """The final artifact does not establish the required static privacy contract."""


def verify_manifest(xml: str) -> dict[str, object]:
    """Require advertising denial without changing non-advertising consent.

    Indirect resource values are rejected: the checker cannot prove their effective
    value without resolving resources. Do not replace a missing proof with a pass.
    """
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as error:
        raise PrivacyViolation(f"Manifest XML cannot be parsed: {error}") from error
    if root.tag != "manifest":
        raise PrivacyViolation("Expected an Android manifest root")
    applications = root.findall("application")
    if len(applications) != 1:
        raise PrivacyViolation("Expected exactly one application declaration")

    permissions = {
        element.get(ANDROID + "name")
        for element in root
        if element.tag.startswith("uses-permission")
    }
    forbidden = sorted(
        permission for permission in permissions
        if permission in FORBIDDEN_PERMISSIONS
        or (permission is not None and permission.startswith("android.permission.ACCESS_ADSERVICES_"))
    )
    if forbidden:
        raise PrivacyViolation("Advertising permissions remain: " + ", ".join(forbidden))

    metadata: dict[str, list[str | None]] = {}
    for element in applications[0].findall("meta-data"):
        key = element.get(ANDROID + "name")
        if key:
            metadata.setdefault(key, []).append(element.get(ANDROID + "value"))
    invalid = [key for key in DENIED_DEFAULTS if metadata.get(key) != ["false"]]
    if invalid:
        raise PrivacyViolation("Expected one literal false advertising default: " + ", ".join(invalid))

    if "google_analytics_default_allow_analytics_storage" in metadata:
        raise PrivacyViolation("This change must preserve the existing analytics_storage consent default")
    if metadata.get("firebase_analytics_collection_deactivated", ["false"]) != ["false"]:
        raise PrivacyViolation("Non-advertising Analytics must not be permanently deactivated")
    if metadata.get("firebase_analytics_collection_enabled", ["true"]) != ["true"]:
        raise PrivacyViolation("Release must not globally disable non-advertising Analytics")

    return {
        "package": root.get("package"),
        "version_code": root.get(ANDROID + "versionCode"),
        "advertising_permissions_absent": True,
        "advertising_defaults_denied": list(DENIED_DEFAULTS),
        "analytics_collection_not_disabled_by_manifest": True,
        "runtime_consent_verified": False,
    }


def tool_output(command: list[str]) -> str:
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as error:
        raise PrivacyViolation("Required official Android tool is unavailable") from error
    except subprocess.CalledProcessError as error:
        raise PrivacyViolation(
            f"Android artifact inspection failed (exit {error.returncode}); run the tool separately for diagnostics"
        ) from error
    return result.stdout


def artifact_manifest(path: Path, kind: str, apkanalyzer: str, bundletool: str | None) -> str:
    if kind == "merged-manifest":
        return path.read_text(encoding="utf-8")
    if kind == "apk":
        return tool_output([apkanalyzer, "manifest", "print", str(path)])
    if bundletool is None:
        raise PrivacyViolation("AAB inspection requires --bundletool or the bundletool executable on PATH")
    if bundletool.endswith(".jar"):
        command = [shutil.which("java") or "java", "-jar", bundletool]
    else:
        command = [bundletool]
    return tool_output(command + ["dump", "manifest", "--bundle=" + str(path), "--module=base"])


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--merged-manifest", action="append", type=Path, default=[])
    parser.add_argument("--apk", action="append", type=Path, default=[])
    parser.add_argument("--aab", action="append", type=Path, default=[])
    parser.add_argument("--apkanalyzer", default=shutil.which("apkanalyzer") or "apkanalyzer")
    parser.add_argument("--bundletool", default=shutil.which("bundletool"), help="Official bundletool executable or JAR")
    arguments = parser.parse_args()
    inputs = (
        [("merged-manifest", p) for p in arguments.merged_manifest]
        + [("apk", p) for p in arguments.apk]
        + [("aab", p) for p in arguments.aab]
    )
    if not inputs:
        parser.error("Provide a final --merged-manifest, --apk, or --aab")
    reports = []
    for kind, path in inputs:
        try:
            if not path.is_file():
                raise PrivacyViolation("Artifact does not exist")
            result = verify_manifest(artifact_manifest(path, kind, arguments.apkanalyzer, arguments.bundletool))
            reports.append({"kind": kind, "path": str(path), "sha256": file_sha256(path), **result})
        except (OSError, PrivacyViolation) as error:
            print(json.dumps({"kind": kind, "path": str(path), "error": str(error)}), file=sys.stderr)
            return 1
    print(json.dumps({"artifacts": reports}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
