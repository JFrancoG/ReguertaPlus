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
    kind: str
    article_number: int | None
    page_start: int
    page_end: int
    title: str
    text: str
    search_aliases: tuple[str, ...]


@dataclass(frozen=True)
class PageSlice:
    page_number: int
    start: int
    end: int


ARTICLE_SEARCH_ALIASES: dict[int, tuple[str, ...]] = {
    1: ("denominación", "nombre de la asociación", "naturaleza asociativa"),
    2: ("ámbito territorial", "sede de la asociación", "domicilio social"),
    3: ("fines de la asociación", "objetivos", "actividades agroecológicas"),
    4: (
        "requisitos para asociarse",
        "admisión de socios",
        "pérdida de la condición de persona asociada",
    ),
    5: ("derechos de los asociados", "derechos de los socios", "voz y voto"),
    6: ("deberes de los asociados", "obligaciones de los socios", "cuotas"),
    7: (
        "órganos de representación y dirección",
        "asamblea general y comisión rectora",
    ),
    8: ("composición de la asamblea", "máximo órgano de soberanía"),
    9: (
        "funciones de la asamblea general",
        "aprobar presupuesto anual",
        "proponer y aprobar vocalías",
        "revocar comisión rectora",
        "modificar estatutos",
    ),
    10: (
        "asamblea extraordinaria",
        "asamblea urgente",
        "convocatoria de la asamblea",
        "veinte por ciento del censo",
        "48 horas",
        "refrendar presupuesto",
    ),
    11: (
        "composición de la comisión rectora",
        "cargos de la comisión rectora",
        "altas y bajas de la comisión rectora",
        "vocalías",
        "suplentes",
    ),
    12: ("funcionamiento de la comisión rectora", "reuniones mensuales"),
    13: (
        "revocar miembros comisión rectora",
        "recusación de la comisión rectora",
        "moción de censura",
        "veinte por ciento de socios",
    ),
    14: (
        "funciones de la coordinación general",
        "ordenar cobros y pagos",
        "fondos de la asociación",
    ),
    15: (
        "dimisión de la coordinación general",
        "sustitución de la coordinación general",
        "socio de más edad",
        "gestora provisional",
    ),
    16: (
        "funciones de la secretaría",
        "registro de socios",
        "altas y bajas de socios",
        "publicación interna",
    ),
    17: (
        "funciones de la tesorería",
        "elaborar presupuesto anual",
        "pagos autorizados",
        "contabilidad",
    ),
    18: (
        "sustento económico",
        "cuotas mensuales y extraordinarias",
        "financiación de la asociación",
    ),
    19: (
        "patrimonio inicial",
        "patrimonio fundacional",
        "libro de cuentas",
    ),
    20: ("personal contratado", "asesoría jurídica"),
    21: (
        "modificar estatutos",
        "reforma de los estatutos",
        "mayoría absoluta",
        "veinticinco por ciento de socios",
    ),
    22: ("disolución de la asociación", "liquidación", "dos tercios"),
}


FINAL_PROVISION_SEARCH_ALIASES: dict[int, tuple[str, ...]] = {
    1: ("reglamento de funcionamiento interno", "desarrollo de los estatutos"),
    2: ("comisiones de trabajo", "funciones de las comisiones"),
    3: ("régimen disciplinario", "sanciones", "código deontológico"),
}


STRUCTURAL_HEADINGS = (
    "TÍTULO I Disposiciones generales",
    "TÍTULO II De los socios y las socias",
    "TÍTULO III De los órganos de representación y dirección",
    "TÍTULO IV Recursos económicos",
    "CAPÍTULO I. Asamblea General",
    "CAPÍTULO II. Comisión Rectora",
    "CAPÍTULO III. Coordinación General",
    "CAPÍTULO IV. Secretaría",
    "CAPÍTULO V. Tesorería",
    "DISPOSICIONES FINALES",
)


SECTION_PATTERN = re.compile(
    r"\b(?:"
    r"Artículo\s+(?P<article_number>\d+)\.\s*(?P<article_title>[^.]+)\."
    r"|"
    r"Disposición\s+(?P<provision_number>\d+)[ªa]\.\s*"
    r"(?P<provision_title>[^.]+)\."
    r")",
    flags=re.IGNORECASE,
)


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


def normalize_page_text(raw: str) -> str:
    text = normalize_text(raw)
    text = re.sub(r"^\d+\s+", "", text)
    for heading in STRUCTURAL_HEADINGS:
        text = re.sub(re.escape(heading), " ", text, flags=re.IGNORECASE)
    return normalize_text(text)


def build_document_stream(reader: PdfReader) -> tuple[str, list[PageSlice]]:
    parts: list[str] = []
    page_slices: list[PageSlice] = []
    cursor = 0

    for page_number, page in enumerate(reader.pages, start=1):
        text = normalize_page_text(page.extract_text() or "")
        if not text:
            continue
        if parts:
            parts.append(" ")
            cursor += 1
        start = cursor
        parts.append(text)
        cursor += len(text)
        page_slices.append(PageSlice(page_number=page_number, start=start, end=cursor))

    return "".join(parts), page_slices


def page_at_offset(offset: int, page_slices: list[PageSlice]) -> int:
    for page_slice in page_slices:
        if page_slice.start <= offset < page_slice.end:
            return page_slice.page_number
    raise RuntimeError(f"No se pudo resolver la página física para el offset {offset}.")


def build_chunks(reader: PdfReader) -> list[Chunk]:
    document, page_slices = build_document_stream(reader)
    matches = list(SECTION_PATTERN.finditer(document))
    chunks: list[Chunk] = []

    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(document)
        while end > match.start() and document[end - 1].isspace():
            end -= 1

        article_group = match.group("article_number")
        if article_group is not None:
            article_number = int(article_group)
            kind = "article"
            chunk_id = f"article-{article_number}"
            title = f"Artículo {article_number}. {normalize_text(match.group('article_title'))}"
            aliases = ARTICLE_SEARCH_ALIASES.get(article_number, ())
        else:
            provision_number = int(match.group("provision_number"))
            article_number = None
            kind = "finalProvision"
            chunk_id = f"final-provision-{provision_number}"
            title = (
                f"Disposición {provision_number}ª. "
                f"{normalize_text(match.group('provision_title'))}"
            )
            aliases = FINAL_PROVISION_SEARCH_ALIASES.get(provision_number, ())

        chunks.append(
            Chunk(
                id=chunk_id,
                kind=kind,
                article_number=article_number,
                page_start=page_at_offset(match.start(), page_slices),
                page_end=page_at_offset(end - 1, page_slices),
                title=title,
                text=normalize_text(document[match.start():end]),
                search_aliases=aliases,
            )
        )

    expected_ids = [f"article-{number}" for number in range(1, 23)]
    expected_ids.extend(f"final-provision-{number}" for number in range(1, 4))
    actual_ids = [chunk.id for chunk in chunks]
    if actual_ids != expected_ids:
        raise RuntimeError(
            "La segmentación del PDF no produjo los artículos y disposiciones esperados: "
            f"{actual_ids}"
        )
    if any(not chunk.search_aliases for chunk in chunks):
        raise RuntimeError("Todos los fragmentos deben tener aliases de búsqueda.")

    return chunks


def write_markdown(path: Path, source_name: str, chunks: list[Chunk]) -> None:
    lines: list[str] = []
    lines.append(f"# {source_name}")
    lines.append("")
    lines.append(f"_Generado automáticamente: {datetime.now(timezone.utc).isoformat()}_")
    lines.append("")
    for chunk in chunks:
        page_label = (
            f"página {chunk.page_start}"
            if chunk.page_start == chunk.page_end
            else f"páginas {chunk.page_start}-{chunk.page_end}"
        )
        lines.append(f"## {chunk.title} ({page_label})")
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
    page_count: int,
) -> None:
    payload = {
        "metadata": {
            "documentId": "reguerta-estatutos",
            "title": "Estatutos Asociación y Grupo de Consumo La Regüerta Ecológica del Aljarafe",
            "language": "es",
            "sourceFileName": source_pdf.name,
            "sourceDriveUrl": source_url,
            "sourceSha256": sha256_file(source_pdf),
            "pageCount": page_count,
            "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "schemaVersion": 2,
        },
        "chunks": [],
    }
    for chunk in chunks:
        chunk_payload = {
            "id": chunk.id,
            "kind": chunk.kind,
        }
        if chunk.article_number is not None:
            chunk_payload["articleNumber"] = chunk.article_number
        chunk_payload.update(
            {
                "pageStart": chunk.page_start,
                "pageEnd": chunk.page_end,
                "title": chunk.title,
                "text": chunk.text,
                "searchAliases": list(chunk.search_aliases),
            }
        )
        payload["chunks"].append(chunk_payload)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sync_runtime_assets(repo_root: Path, source_pdf: Path, json_index: Path) -> None:
    android_assets = repo_root / "android/Reguerta/app/src/main/assets/bylaws"
    ios_assets = repo_root / "ios/Reguerta/Reguerta/Resources/bylaws"
    for target_dir in (android_assets, ios_assets):
        target_dir.mkdir(parents=True, exist_ok=True)
        target_pdf = target_dir / "reguerta-estatutos.pdf"
        if target_pdf.exists() and sha256_file(target_pdf) != sha256_file(source_pdf):
            raise RuntimeError(f"El PDF runtime no coincide con la fuente: {target_pdf}")
        if not target_pdf.exists():
            shutil.copy2(source_pdf, target_pdf)
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
    write_json_index(
        output_json,
        source_pdf,
        args.source_url,
        chunks,
        page_count=len(reader.pages),
    )
    sync_runtime_assets(repo_root, source_pdf, output_json)

    print(f"PDF: {source_pdf}")
    print(f"Chunks: {len(chunks)}")
    print(f"JSON: {output_json}")
    print(f"MD: {output_md}")
    print("Runtime assets synced to Android and iOS.")


if __name__ == "__main__":
    main()
