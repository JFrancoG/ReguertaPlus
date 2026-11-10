"""Policy-oracle tests for the final artifact guard; no Android/Firebase services."""

import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name("verify-release-privacy.py")
SPEC = importlib.util.spec_from_file_location("verify_release_privacy", SCRIPT)
privacy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(privacy)


class ReleasePrivacyTests(unittest.TestCase):
    def manifest(self, permission="", replacement="", extra=""):
        defaults = '''
            <meta-data android:name="google_analytics_adid_collection_enabled" android:value="false" />
            <meta-data android:name="google_analytics_default_allow_ad_storage" android:value="false" />
            <meta-data android:name="google_analytics_default_allow_ad_user_data" android:value="false" />
            <meta-data android:name="google_analytics_default_allow_ad_personalization_signals" android:value="false" />
        '''
        if replacement:
            defaults = defaults.replace('android:value="false"', replacement, 1)
        return f'''<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="example.test">
            {permission}<application>{defaults}{extra}</application></manifest>'''

    def test_denies_advertising_while_preserving_ordinary_collection(self):
        result = privacy.verify_manifest(self.manifest(
            permission='<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
            extra='<meta-data android:name="firebase_messaging_installation_id_enabled" android:value="true" />',
        ))
        self.assertTrue(result["advertising_permissions_absent"])
        self.assertTrue(result["analytics_collection_not_disabled_by_manifest"])
        self.assertFalse(result["runtime_consent_verified"])

    def test_each_advertising_permission_is_rejected_even_on_sdk_scoped_tag(self):
        for permission in (
            "com.google.android.gms.permission.AD_ID",
            "android.permission.ACCESS_ADSERVICES_AD_ID",
            "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
            "android.permission.ACCESS_ADSERVICES_TOPICS",
        ):
            with self.subTest(permission=permission):
                xml = self.manifest(permission=f'<uses-permission-sdk-23 android:name="{permission}" />')
                with self.assertRaisesRegex(privacy.PrivacyViolation, "Advertising permissions remain"):
                    privacy.verify_manifest(xml)

    def test_true_missing_resource_and_duplicate_ad_defaults_do_not_count_as_denied(self):
        bad = [
            self.manifest(replacement='android:value="true"'),
            self.manifest().replace(
                '<meta-data android:name="google_analytics_default_allow_ad_user_data" android:value="false" />', ""
            ),
            self.manifest(replacement='android:resource="@bool/disabled"'),
            self.manifest(extra='<meta-data android:name="google_analytics_adid_collection_enabled" android:value="false" />'),
        ]
        for xml in bad:
            with self.subTest(xml=xml):
                with self.assertRaisesRegex(privacy.PrivacyViolation, "literal false advertising default"):
                    privacy.verify_manifest(xml)

    def test_global_analytics_disable_and_consent_grants_are_rejected(self):
        for extra in (
            '<meta-data android:name="firebase_analytics_collection_deactivated" android:value="true" />',
            '<meta-data android:name="firebase_analytics_collection_enabled" android:value="false" />',
            '<meta-data android:name="google_analytics_default_allow_analytics_storage" android:value="true" />',
        ):
            with self.subTest(extra=extra):
                with self.assertRaises(privacy.PrivacyViolation):
                    privacy.verify_manifest(self.manifest(extra=extra))

    def test_missing_or_multiple_applications_are_rejected(self):
        for xml in ("<manifest />", "<manifest><application/><application/></manifest>", "<other/>"):
            with self.subTest(xml=xml):
                with self.assertRaises(privacy.PrivacyViolation):
                    privacy.verify_manifest(xml)


if __name__ == "__main__":
    unittest.main()
