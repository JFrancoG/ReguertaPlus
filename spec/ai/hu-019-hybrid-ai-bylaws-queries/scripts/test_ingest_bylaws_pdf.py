"""Contract tests for the canonical bylaws index generator."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader

from ingest_bylaws_pdf import build_chunks, write_json_index


TRACK_DIR = Path(__file__).resolve().parent.parent
SOURCE_PDF = TRACK_DIR / "data/source/reguerta-estatutos.pdf"
QUESTIONS_FILE = TRACK_DIR / "data/test-questions-es.json"


class BylawsParserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.reader = PdfReader(str(SOURCE_PDF))
        cls.chunks = build_chunks(cls.reader)
        cls.chunks_by_id = {chunk.id: chunk for chunk in cls.chunks}

    def test_builds_one_chunk_per_article_and_final_provision(self) -> None:
        expected_ids = [f"article-{number}" for number in range(1, 23)]
        expected_ids.extend(f"final-provision-{number}" for number in range(1, 4))

        self.assertEqual([chunk.id for chunk in self.chunks], expected_ids)
        self.assertEqual(
            [chunk.article_number for chunk in self.chunks[:22]],
            list(range(1, 23)),
        )
        self.assertTrue(all(chunk.kind == "article" for chunk in self.chunks[:22]))
        self.assertTrue(
            all(chunk.kind == "finalProvision" for chunk in self.chunks[22:])
        )
        self.assertTrue(
            all(chunk.article_number is None for chunk in self.chunks[22:])
        )

    def test_preserves_physical_page_ranges_for_cross_page_articles(self) -> None:
        expected_ranges = {
            "article-1": (3, 3),
            "article-2": (3, 3),
            "article-3": (3, 4),
            "article-4": (5, 5),
            "article-5": (5, 5),
            "article-6": (6, 6),
            "article-7": (6, 6),
            "article-8": (6, 6),
            "article-9": (6, 7),
            "article-10": (7, 7),
            "article-11": (8, 8),
            "article-12": (8, 8),
            "article-13": (8, 9),
            "article-14": (9, 9),
            "article-15": (10, 10),
            "article-16": (10, 11),
            "article-17": (11, 11),
            "article-18": (11, 11),
            "article-19": (12, 12),
            "article-20": (12, 12),
            "article-21": (12, 12),
            "article-22": (13, 13),
            "final-provision-1": (13, 13),
            "final-provision-2": (13, 13),
            "final-provision-3": (13, 13),
        }

        actual_ranges = {
            chunk.id: (chunk.page_start, chunk.page_end) for chunk in self.chunks
        }
        self.assertEqual(actual_ranges, expected_ranges)

    def test_cross_page_content_stays_with_its_article(self) -> None:
        article_3 = self.chunks_by_id["article-3"].text
        article_9 = self.chunks_by_id["article-9"].text
        article_13 = self.chunks_by_id["article-13"].text
        article_16 = self.chunks_by_id["article-16"].text

        self.assertIn("Ofrecer asesoría a empresas", article_3)
        self.assertNotIn("Artículo 4.", article_3)
        self.assertIn("Revocar total o parcialmente la Comisión Rectora", article_9)
        self.assertNotIn("Artículo 10.", article_9)
        self.assertIn("Esta convocatoria no podrá demorarse más de un mes", article_13)
        self.assertIn("mayoría absoluta", article_13)
        self.assertIn("Firmar todos los documentos emanados", article_16)
        self.assertNotIn("Artículo 17.", article_16)

    def test_every_chunk_has_deterministic_search_aliases(self) -> None:
        self.assertTrue(all(chunk.search_aliases for chunk in self.chunks))
        self.assertIn(
            "modificar estatutos",
            self.chunks_by_id["article-21"].search_aliases,
        )
        self.assertIn(
            "sustento económico",
            self.chunks_by_id["article-18"].search_aliases,
        )
        self.assertIn(
            "revocar miembros comisión rectora",
            self.chunks_by_id["article-13"].search_aliases,
        )
        self.assertIn(
            "altas y bajas de socios",
            self.chunks_by_id["article-16"].search_aliases,
        )

    def test_json_uses_schema_v2_and_pdf_page_count(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "bylaws-index-es.json"
            write_json_index(
                output,
                SOURCE_PDF,
                "https://example.invalid/reguerta-estatutos.pdf",
                self.chunks,
                page_count=len(self.reader.pages),
            )
            payload = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual(payload["metadata"]["schemaVersion"], 2)
        self.assertEqual(payload["metadata"]["pageCount"], 13)
        self.assertEqual(len(payload["chunks"]), 25)
        self.assertEqual(
            set(payload["chunks"][0]),
            {
                "id",
                "kind",
                "articleNumber",
                "pageStart",
                "pageEnd",
                "title",
                "text",
                "searchAliases",
            },
        )
        self.assertNotIn("articleNumber", payload["chunks"][-1])


class CanonicalQuestionTests(unittest.TestCase):
    def test_questions_have_expected_evidence_and_safety_contracts(self) -> None:
        payload = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
        questions = payload["questions"]
        expected_article_ids = [
            ["article-21"],
            ["article-18"],
            ["article-9"],
            ["article-5"],
            ["article-4"],
            ["article-6"],
            ["article-10"],
            ["article-13", "article-9"],
            ["article-17"],
            ["article-11", "article-16"],
            ["article-9", "article-11"],
            ["article-19"],
            ["article-17", "article-10", "article-9"],
            ["article-15"],
            ["article-14", "article-17"],
        ]

        self.assertGreaterEqual(len(questions), 15)
        self.assertEqual(
            [question["expectedArticleIds"] for question in questions[:15]],
            expected_article_ids,
        )
        for question in questions:
            self.assertIsInstance(question["id"], str)
            self.assertIsInstance(question["question"], str)
            self.assertIsInstance(question["expectedArticleIds"], list)
            self.assertTrue(question["requiredFacts"])
            self.assertTrue(question["forbiddenFacts"])
            self.assertIn(
                question["polarity"],
                {"informational", "negative", "out-of-scope", "adversarial"},
            )


if __name__ == "__main__":
    unittest.main()
