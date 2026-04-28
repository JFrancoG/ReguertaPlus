#!/usr/bin/env python3
"""Build local bylaws knowledge artifacts from a source PDF.

Outputs:
- Canonical JSON index for retrieval.
- Markdown extraction for quick review/diff.
- Synced runtime assets for Android and iOS bundles.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


@dataclass(frozen=True)
class Chunk:
    id: str
    page: int
    title: str
    text: str


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            block = f.read(1024 * 1024)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def normalize_text(raw: str) -> str:
    text = raw.replace("\x00", " ")
    text = text.replace("ﬁ", "fi").replace("ﬂ", "fl")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def infer_title(text: str, page: int) -> str:
    article_match = re.search(
        r"(Artículo\s+\d+)\.\s*([A-ZÁÉÍÓÚÑa-záéíóúñ][^\.]{2,120})",
        text,
        flags=re.IGNORECASE,
    )
    if article_match:
        return f"{article_match.group(1).strip()}. {article_match.group(2).strip()}"

    chapter_match = re.search(
        r"(TÍTULO\s+[IVXLCDM]+|CAPÍTULO\s+[IVXLCDM]+)\.?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ][^\.]{2,120})?",
        text,
        flags=re.IGNORECASE,
    )
    if chapter_match:
        suffix = (chapter_match.group(2) or "").strip()
        return f"{chapter_match.group(1).strip()}{f'. {suffix}' if suffix else ''}"

    return f"Página {page}"


def build_chunks(reader: PdfReader) -> list[Chunk]:
    chunks: list[Chunk] = []
    for page_number, page in enumerate(reader.pages, start=1):
        raw = page.extract_text() or ""
        text = normalize_text(raw)
        if len(text) < 20:
            continue
        title = infer_title(text, page_number)
        chunks.append(
            Chunk(
                id=f"page-{page_number}",
                page=page_number,
                title=title,
                text=text,
            )
        )
    return chunks


def write_markdown(path: Path, source_name: str, chunks: list[Chunk]) -> None:
    lines: list[str] = []
    lines.append(f"# {source_name}")
    lines.append("")
    lines.append(f"_Generado automáticamente: {datetime.now(timezone.utc).isoformat()}_")
    lines.append("")
    for chunk in chunks:
        lines.append(f"## {chunk.title} (página {chunk.page})")
        lines.append("")
        lines.append(chunk.text)
        lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def write_json_index(
    path: Path,
    source_pdf: Path,
    source_url: str,
    chunks: list[Chunk],
) -> None:
    payload = {
        "metadata": {
            "documentId": "reguerta-estatutos",
            "title": "Estatutos Asociación y Grupo de Consumo La Regüerta Ecológica del Aljarafe",
            "language": "es",
            "sourceFileName": source_pdf.name,
            "sourceDriveUrl": source_url,
            "sourceSha256": sha256_file(source_pdf),
            "pageCount": len(chunks),
            "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "schemaVersion": 1,
        },
        "chunks": [
            {
                "id": chunk.id,
                "pageStart": chunk.page,
                "pageEnd": chunk.page,
                "title": chunk.title,
                "text": chunk.text,
            }
            for chunk in chunks
        ],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sync_runtime_assets(repo_root: Path, source_pdf: Path, json_index: Path) -> None:
    android_assets = repo_root / "android/Reguerta/app/src/main/assets/bylaws"
    ios_assets = repo_root / "ios/Reguerta/Reguerta/Resources/bylaws"
    for target_dir in (android_assets, ios_assets):
        target_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_pdf, target_dir / "reguerta-estatutos.pdf")
        shutil.copy2(json_index, target_dir / "bylaws-index-es.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--source-pdf", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-md", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    source_pdf = Path(args.source_pdf).resolve()
    output_json = Path(args.output_json).resolve()
    output_md = Path(args.output_md).resolve()

    reader = PdfReader(str(source_pdf))
    chunks = build_chunks(reader)
    if not chunks:
        raise RuntimeError("No se pudo extraer texto del PDF de estatutos.")

    write_markdown(output_md, source_pdf.name, chunks)
    write_json_index(output_json, source_pdf, args.source_url, chunks)
    sync_runtime_assets(repo_root, source_pdf, output_json)

    print(f"PDF: {source_pdf}")
    print(f"Chunks: {len(chunks)}")
    print(f"JSON: {output_json}")
    print(f"MD: {output_md}")
    print("Runtime assets synced to Android and iOS.")


if __name__ == "__main__":
    main()
