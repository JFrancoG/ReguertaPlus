import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("generate_color_catalog.py")
SPEC = importlib.util.spec_from_file_location("generate_color_catalog", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
catalog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalog)


class ColorCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.contract = catalog.load_contract()
        cls.mode_ids, cls.token_index = catalog.validate_contract(cls.contract)

    def test_contract_matches_production_sources(self) -> None:
        catalog.validate_production_sources(
            self.contract,
            self.mode_ids,
            self.token_index,
        )

    def test_all_declared_pairs_meet_their_unrounded_threshold(self) -> None:
        catalog.validate_contrast_pairs(self.contract, self.token_index)
        borderline = catalog.contrast_ratio("#777777", "#FFFFFF")
        self.assertLess(borderline, 4.5)
        self.assertEqual(f"{borderline:.2f}", "4.48")

    def test_wcag_reference_black_and_white_ratio_is_twenty_one(self) -> None:
        self.assertAlmostEqual(catalog.contrast_ratio("#000000", "#FFFFFF"), 21.0)

    def test_ios_asset_parser_reads_increased_contrast_variants(self) -> None:
        values = catalog.parse_ios_asset(
            "ios/Reguerta/Reguerta/Resources/Assets.xcassets/Colors/"
            "actionPrimary.colorset/Contents.json"
        )
        self.assertEqual(values["highContrastLight"], "#315815")
        self.assertEqual(values["highContrastDark"], "#A8DD75")

    def test_render_is_deterministic_self_contained_and_current(self) -> None:
        first = catalog.render_catalog(self.contract, self.token_index)
        second = catalog.render_catalog(self.contract, self.token_index)
        self.assertEqual(first, second)
        self.assertNotIn("<script src=", first)
        self.assertNotIn("<link rel=", first)
        self.assertIn("@media (max-width: 820px)", first)
        self.assertEqual(catalog.OUTPUT_PATH.read_text(encoding="utf-8"), first)


if __name__ == "__main__":
    unittest.main()
