#!/usr/bin/env python3
"""Generate and verify Reguerta's self-contained color catalog."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = REPO_ROOT / "docs/design-system/color-tokens.json"
OUTPUT_PATH = REPO_ROOT / "docs/design-system/color-catalog.html"
GENERATOR_VERSION = "1.0.0"
PLATFORMS = ("ios", "android")
HEX_PATTERN = re.compile(r"^#[0-9A-F]{6}(?:[0-9A-F]{2})?$")


class CatalogError(RuntimeError):
    """Raised when the contract or a production source is inconsistent."""


def load_contract() -> dict[str, Any]:
    try:
        return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CatalogError(f"Cannot load {CONTRACT_PATH.relative_to(REPO_ROOT)}: {error}") from error


def normalized_hex(value: str) -> str:
    value = value.upper()
    if not HEX_PATTERN.fullmatch(value):
        raise CatalogError(f"Invalid color value: {value}")
    return value


def color_component(value: str) -> int:
    if value.lower().startswith("0x"):
        return int(value, 16)
    numeric = float(value)
    return round(numeric * 255) if numeric <= 1 else round(numeric)


def rgba_hex(red: int, green: int, blue: int, alpha: int = 255) -> str:
    rgb = f"#{red:02X}{green:02X}{blue:02X}"
    return rgb if alpha == 255 else f"{rgb}{alpha:02X}"


def parse_ios_asset(relative_path: str) -> dict[str, str]:
    path = REPO_ROOT / relative_path
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CatalogError(f"Cannot parse iOS asset {relative_path}: {error}") from error

    variants: dict[tuple[bool, bool], str] = {}
    for entry in payload.get("colors", []):
        components = entry.get("color", {}).get("components", {})
        if not {"red", "green", "blue"}.issubset(components):
            continue
        appearances = {
            item.get("appearance"): item.get("value")
            for item in entry.get("appearances", [])
        }
        is_dark = appearances.get("luminosity") == "dark"
        is_high_contrast = appearances.get("contrast") == "high"
        variants[(is_dark, is_high_contrast)] = rgba_hex(
            color_component(components["red"]),
            color_component(components["green"]),
            color_component(components["blue"]),
            color_component(components.get("alpha", "1")),
        )

    if (False, False) not in variants:
        raise CatalogError(f"iOS asset has no default color: {relative_path}")

    light = variants[(False, False)]
    dark = variants.get((True, False), light)
    return {
        "light": light,
        "dark": dark,
        "highContrastLight": variants.get((False, True), light),
        "highContrastDark": variants.get((True, True), dark),
    }


def parse_kotlin_symbols(source: dict[str, Any]) -> dict[str, str]:
    relative_path = source["path"]
    path = REPO_ROOT / relative_path
    try:
        content = path.read_text(encoding="utf-8")
    except OSError as error:
        raise CatalogError(f"Cannot read Kotlin source {relative_path}: {error}") from error

    values: dict[str, str] = {}
    for mode in ("light", "dark"):
        symbol = source["symbols"][mode]
        match = re.search(
            rf"\bval\s+{re.escape(symbol)}\s*=\s*Color\(0x([0-9A-Fa-f]{{8}})\)",
            content,
        )
        if match is None:
            raise CatalogError(f"Kotlin color symbol not found: {symbol} in {relative_path}")
        argb = match.group(1).upper()
        alpha, red, green, blue = (
            int(argb[0:2], 16),
            int(argb[2:4], 16),
            int(argb[4:6], 16),
            int(argb[6:8], 16),
        )
        values[mode] = rgba_hex(red, green, blue, alpha)

    values["highContrastLight"] = values["light"]
    values["highContrastDark"] = values["dark"]
    return values


def parse_swift_theme_hex(source: dict[str, Any]) -> dict[str, str]:
    relative_path = source["path"]
    path = REPO_ROOT / relative_path
    try:
        content = path.read_text(encoding="utf-8")
    except OSError as error:
        raise CatalogError(f"Cannot read Swift source {relative_path}: {error}") from error

    light_match = re.search(r"static var light:.*?(?=static var dark:)", content, re.DOTALL)
    dark_match = re.search(r"static var dark:.*", content, re.DOTALL)
    if light_match is None or dark_match is None:
        raise CatalogError(f"Cannot locate light/dark token blocks in {relative_path}")

    property_name = source["property"]

    def find_value(block: str, mode: str) -> str:
        match = re.search(
            rf"\b{re.escape(property_name)}\s*:\s*Color\(hex:\s*0x([0-9A-Fa-f]{{6}})\)",
            block,
        )
        if match is None:
            raise CatalogError(
                f"Swift token {property_name} ({mode}) not found in {relative_path}"
            )
        return f"#{match.group(1).upper()}"

    light = find_value(light_match.group(0), "light")
    dark = find_value(dark_match.group(0), "dark")
    return {
        "light": light,
        "dark": dark,
        "highContrastLight": light,
        "highContrastDark": dark,
    }


def validate_contract(contract: dict[str, Any]) -> tuple[list[str], dict[str, dict[str, Any]]]:
    if contract.get("schemaVersion") != 1:
        raise CatalogError("color-tokens.json must use schemaVersion 1")

    modes = contract.get("modes", [])
    mode_ids = [mode.get("id") for mode in modes]
    if len(mode_ids) != len(set(mode_ids)) or len(mode_ids) != 4:
        raise CatalogError("The contract must define four unique visual modes")

    tokens = contract.get("tokens", [])
    token_index = {token.get("id"): token for token in tokens}
    if None in token_index or len(token_index) != len(tokens):
        raise CatalogError("Every token must have a unique id")

    for token_id, token in token_index.items():
        for platform in PLATFORMS:
            platform_data = token.get("platforms", {}).get(platform)
            if platform_data is None:
                raise CatalogError(f"{token_id} has no {platform} definition")
            values = platform_data.get("values", {})
            if set(values) != set(mode_ids):
                raise CatalogError(f"{token_id}/{platform} must define every visual mode")
            for value in values.values():
                normalized_hex(value)
            if "kind" not in platform_data.get("source", {}):
                raise CatalogError(f"{token_id}/{platform} has no verifiable source")

    pair_ids: set[str] = set()
    for pair in contract.get("pairs", []):
        pair_id = pair.get("id")
        if not pair_id or pair_id in pair_ids:
            raise CatalogError("Every contrast pair must have a unique id")
        pair_ids.add(pair_id)
        if pair.get("foreground") not in token_index or pair.get("background") not in token_index:
            raise CatalogError(f"Contrast pair references an unknown token: {pair_id}")
        if not isinstance(pair.get("minimum"), (int, float)) or pair["minimum"] <= 0:
            raise CatalogError(f"Contrast pair has an invalid minimum: {pair_id}")

    return mode_ids, token_index


def validate_production_sources(
    contract: dict[str, Any],
    mode_ids: list[str],
    token_index: dict[str, dict[str, Any]],
) -> None:
    errors: list[str] = []
    for token in contract["tokens"]:
        token_id = token["id"]
        for platform in PLATFORMS:
            platform_data = token["platforms"][platform]
            source = platform_data["source"]
            kind = source["kind"]
            try:
                if kind == "ios_assets":
                    parsed_sets = [parse_ios_asset(path) for path in source["paths"]]
                    actual = parsed_sets[0]
                    for path, parsed in zip(source["paths"][1:], parsed_sets[1:]):
                        if parsed != actual:
                            errors.append(
                                f"{token_id}/{platform}: {path} differs from the first declared asset"
                            )
                elif kind == "kotlin_symbols":
                    actual = parse_kotlin_symbols(source)
                elif kind == "swift_theme_hex":
                    actual = parse_swift_theme_hex(source)
                elif kind == "token_alias":
                    alias_id = source["token"]
                    if alias_id not in token_index:
                        raise CatalogError(f"Unknown alias target: {alias_id}")
                    actual = token_index[alias_id]["platforms"][platform]["values"]
                else:
                    raise CatalogError(f"Unsupported source kind: {kind}")
            except (CatalogError, KeyError) as error:
                errors.append(f"{token_id}/{platform}: {error}")
                continue

            expected = platform_data["values"]
            for mode_id in mode_ids:
                if normalized_hex(actual[mode_id]) != normalized_hex(expected[mode_id]):
                    errors.append(
                        f"{token_id}/{platform}/{mode_id}: source is {actual[mode_id]}, "
                        f"contract says {expected[mode_id]}"
                    )

    if errors:
        raise CatalogError("Production source drift:\n- " + "\n- ".join(errors))


def rgba(value: str) -> tuple[float, float, float, float]:
    value = normalized_hex(value)[1:]
    alpha = int(value[6:8], 16) / 255 if len(value) == 8 else 1.0
    return (
        int(value[0:2], 16) / 255,
        int(value[2:4], 16) / 255,
        int(value[4:6], 16) / 255,
        alpha,
    )


def relative_luminance(value: str) -> float:
    red, green, blue, alpha = rgba(value)
    if alpha != 1:
        raise CatalogError(f"Translucent colors require a rendered background: {value}")

    def linearize(component: float) -> float:
        return component / 12.92 if component <= 0.04045 else ((component + 0.055) / 1.055) ** 2.4

    return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)


def contrast_ratio(first: str, second: str) -> float:
    lighter, darker = sorted(
        (relative_luminance(first), relative_luminance(second)), reverse=True
    )
    return (lighter + 0.05) / (darker + 0.05)


def source_label(source: dict[str, Any]) -> str:
    kind = source["kind"]
    if kind == "ios_assets":
        return " · ".join(source["paths"])
    if kind == "kotlin_symbols":
        symbols = " / ".join(source["symbols"].values())
        return f"{source['path']} · {symbols}"
    if kind == "swift_theme_hex":
        return f"{source['path']} · {source['property']}"
    return f"alias → {source['token']} · {source['evidencePath']}"


def evaluation_rows(
    contract: dict[str, Any], token_index: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for mode in contract["modes"]:
        mode_id = mode["id"]
        for pair in contract["pairs"]:
            results: dict[str, dict[str, Any]] = {}
            for platform in PLATFORMS:
                foreground = token_index[pair["foreground"]]["platforms"][platform]["values"][mode_id]
                background = token_index[pair["background"]]["platforms"][platform]["values"][mode_id]
                ratio = contrast_ratio(foreground, background)
                results[platform] = {
                    "foreground": foreground,
                    "background": background,
                    "ratio": ratio,
                    "passes": ratio >= pair["minimum"],
                }
            rows.append({"mode": mode, "pair": pair, "results": results})
    return rows


def validate_contrast_pairs(
    contract: dict[str, Any], token_index: dict[str, dict[str, Any]]
) -> None:
    failures: list[str] = []
    for row in evaluation_rows(contract, token_index):
        for platform in PLATFORMS:
            result = row["results"][platform]
            if not result["passes"]:
                failures.append(
                    f"{row['mode']['id']}/{platform}/{row['pair']['id']}: "
                    f"{result['ratio']:.6f}:1 < {row['pair']['minimum']:.1f}:1"
                )
    if failures:
        raise CatalogError("WCAG contrast failures:\n- " + "\n- ".join(failures))


def render_catalog(
    contract: dict[str, Any],
    token_index: dict[str, dict[str, Any]],
) -> str:
    canonical = json.dumps(contract, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:12]
    evaluations = evaluation_rows(contract, token_index)
    failed = [
        (row, platform)
        for row in evaluations
        for platform in PLATFORMS
        if not row["results"][platform]["passes"]
    ]

    mode_sections: list[str] = []
    for mode in contract["modes"]:
        mode_id = mode["id"]
        token_rows: list[str] = []
        for token in contract["tokens"]:
            ios_value = token["platforms"]["ios"]["values"][mode_id]
            android_value = token["platforms"]["android"]["values"][mode_id]
            if ios_value == android_value:
                values_markup = f"""
                  <div class="value aligned">
                    <span class="chip" style="--swatch:{ios_value}"></span>
                    <span class="platforms">iOS · Android</span>
                    <code>{ios_value}</code>
                  </div>"""
            else:
                values_markup = "".join(
                    f"""
                    <div class="value">
                      <span class="chip" style="--swatch:{platform_data['values'][mode_id]}"></span>
                      <span class="platforms">{platform_label}</span>
                      <code>{platform_data['values'][mode_id]}</code>
                    </div>"""
                    for platform_label, platform_data in (
                        ("iOS", token["platforms"]["ios"]),
                        ("Android", token["platforms"]["android"]),
                    )
                )
            token_rows.append(
                f"""
                <article class="token-row">
                  <div class="token-copy">
                    <span class="category">{html.escape(token['category'])}</span>
                    <strong>{html.escape(token['label'])}</strong>
                    <code>{html.escape(token['id'])}</code>
                  </div>
                  <div class="token-values">{values_markup}</div>
                </article>"""
            )
        mode_sections.append(
            f"""
            <section class="mode-card">
              <header>
                <div>
                  <p>{html.escape(mode['contrast'])} contrast</p>
                  <h3>{html.escape(mode['label'])}</h3>
                </div>
                <span class="mode-dot {html.escape(mode['appearance'])}" aria-hidden="true"></span>
              </header>
              <div class="token-list">{''.join(token_rows)}</div>
            </section>"""
        )

    contrast_sections: list[str] = []
    for mode in contract["modes"]:
        rows = [row for row in evaluations if row["mode"]["id"] == mode["id"]]
        table_rows: list[str] = []
        for row in rows:
            pair = row["pair"]
            result_cells: list[str] = []
            for platform in PLATFORMS:
                result = row["results"][platform]
                status = "pass" if result["passes"] else "fail"
                status_text = "✓ PASS" if result["passes"] else "✕ FAIL"
                result_cells.append(
                    f"""
                    <td>
                      <div class="ratio-line">
                        <span class="pair-chips" aria-hidden="true">
                          <i style="--swatch:{result['foreground']}"></i>
                          <i style="--swatch:{result['background']}"></i>
                        </span>
                        <strong>{result['ratio']:.2f}:1</strong>
                        <span class="badge {status}">{status_text}</span>
                      </div>
                    </td>"""
                )
            table_rows.append(
                f"""
                <tr>
                  <th scope="row">
                    {html.escape(pair['label'])}
                    <small>{html.escape(pair['kind'])} · mínimo {pair['minimum']:.1f}:1</small>
                  </th>
                  {''.join(result_cells).lstrip()}
                </tr>"""
            )
        contrast_sections.append(
            f"""
            <details class="matrix-card" open>
              <summary>{html.escape(mode['label'])}<span>{len(rows) * 2} comprobaciones</span></summary>
              <div class="table-scroll">
                <table>
                  <thead><tr><th>Par semántico</th><th>iOS</th><th>Android</th></tr></thead>
                  <tbody>{''.join(table_rows)}</tbody>
                </table>
              </div>
            </details>"""
        )

    preview_cards: list[str] = []
    for mode in contract["modes"]:
        mode_id = mode["id"]
        for platform in PLATFORMS:
            values = {
                token_id: token["platforms"][platform]["values"][mode_id]
                for token_id, token in token_index.items()
            }
            preview_cards.append(
                f"""
                <article class="preview-card" style="
                  --surface:{values['color-surface-primary-default']};
                  --surface-secondary:{values['color-surface-secondary-default']};
                  --text:{values['color-text-primary-default']};
                  --text-secondary:{values['color-text-secondary-default']};
                  --border:{values['color-border-subtle-default']};
                  --action:{values['color-action-primary-default']};
                  --on-action:{values['color-action-on-primary-default']};
                  --control:{values['color-control-accent-default']};
                  --warning:{values['color-feedback-warning-default']};
                  --error:{values['color-feedback-error-default']};
                ">
                  <div class="preview-meta">
                    <span>{html.escape(mode['label'])}</span>
                    <strong>{platform}</strong>
                  </div>
                  <div class="app-preview">
                    <p class="eyebrow">Pedido semanal</p>
                    <h3>Semana 30</h3>
                    <p class="secondary">Revisa las cantidades antes de confirmar.</p>
                    <div class="mini-card">
                      <span>Verduras y hortalizas</span><strong>18,40 €</strong>
                    </div>
                    <p class="feedback warning">▲ Quedan cambios pendientes</p>
                    <p class="feedback error">● Hay un producto no disponible</p>
                    <div class="control-row">
                      <span>Pedido ecológico</span>
                      <span class="toggle" role="img" aria-label="Control activado"><i></i></span>
                    </div>
                    <div class="primary-button">Confirmar pedido</div>
                  </div>
                </article>"""
            )

    provenance_rows = "".join(
        f"""
        <tr>
          <th scope="row"><code>{html.escape(token['id'])}</code></th>
          <td>{html.escape(source_label(token['platforms']['ios']['source']))}</td>
          <td>{html.escape(source_label(token['platforms']['android']['source']))}</td>
          <td><span class="parity {html.escape(token['parity']['status'])}">{html.escape(token['parity']['status'])}</span><br>{html.escape(token['parity']['note'])}</td>
        </tr>"""
        for token in contract["tokens"]
    )

    status_class = "pass" if not failed else "fail"
    status_text = "Todas las parejas pasan" if not failed else f"{len(failed)} parejas fallan"
    catalog = contract["catalog"]
    css = """
    :root {
      color-scheme: light;
      --ink: #182315;
      --muted: #596654;
      --canvas: #eef3e4;
      --paper: #fbfdf6;
      --line: #cbd5bd;
      --brand: #3d681e;
      --brand-soft: #dce9c8;
      --danger: #8d3434;
      --radius: 22px;
      --shadow: 0 18px 55px rgba(33, 54, 25, .10);
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html { background: var(--canvas); color: var(--ink); }
    body { margin: 0; }
    code { font: 500 .78rem ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
    .shell { width: min(1440px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0 96px; }
    .hero { display: grid; grid-template-columns: 1.5fr .9fr; gap: 32px; align-items: end; padding: 48px; border: 1px solid var(--line); border-radius: 32px; background: var(--paper); box-shadow: var(--shadow); }
    .kicker, .section-kicker, .category, .preview-meta, .mode-card header p { text-transform: uppercase; letter-spacing: .14em; font-size: .7rem; font-weight: 800; }
    .kicker, .section-kicker { color: var(--brand); }
    h1 { margin: 10px 0 12px; font-size: clamp(2.5rem, 7vw, 5.8rem); line-height: .92; letter-spacing: -.055em; }
    .lede { max-width: 760px; margin: 0; color: var(--muted); font-size: 1.08rem; line-height: 1.65; }
    .hero-meta { display: grid; gap: 10px; }
    .meta-card { display: flex; justify-content: space-between; gap: 20px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: #fff; }
    .meta-card span { color: var(--muted); }
    .generated-note { margin: 18px 0 0; padding: 14px 18px; border-left: 4px solid var(--brand); background: var(--brand-soft); border-radius: 0 12px 12px 0; }
    section.catalog-section { margin-top: 72px; }
    .section-head { display: flex; align-items: end; justify-content: space-between; gap: 32px; margin-bottom: 22px; }
    .section-head h2 { margin: 6px 0 0; font-size: clamp(1.8rem, 4vw, 3.3rem); letter-spacing: -.035em; }
    .section-head p:last-child { max-width: 580px; color: var(--muted); line-height: 1.55; }
    .mode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
    .mode-card, .matrix-card, .preview-card, .provenance-card { border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper); box-shadow: var(--shadow); overflow: hidden; }
    .mode-card > header { display: flex; justify-content: space-between; align-items: center; padding: 22px 24px; border-bottom: 1px solid var(--line); }
    .mode-card header p, .mode-card h3 { margin: 0; }
    .mode-card h3 { margin-top: 5px; font-size: 1.35rem; }
    .mode-dot { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line); box-shadow: inset 0 0 0 8px rgba(255,255,255,.15); }
    .mode-dot.light { background: #f2f8e1; }
    .mode-dot.dark { background: #0f1d0d; }
    .token-list { display: grid; }
    .token-row { display: grid; grid-template-columns: minmax(190px, 1fr) minmax(220px, 1.25fr); gap: 18px; padding: 16px 24px; border-top: 1px solid color-mix(in srgb, var(--line), transparent 30%); }
    .token-row:first-child { border-top: 0; }
    .token-copy { display: grid; align-content: center; gap: 3px; min-width: 0; }
    .token-copy .category { color: var(--brand); }
    .token-copy code { color: var(--muted); }
    .token-values { display: grid; gap: 7px; }
    .value { display: grid; grid-template-columns: 28px 68px 1fr; gap: 9px; align-items: center; }
    .value.aligned { grid-template-columns: 28px 100px 1fr; }
    .chip { width: 28px; height: 28px; border-radius: 8px; background: var(--swatch); border: 1px solid rgba(20,30,18,.18); box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); }
    .platforms { color: var(--muted); font-size: .76rem; font-weight: 750; }
    .matrix-grid { display: grid; gap: 18px; }
    .matrix-card summary { display: flex; justify-content: space-between; gap: 24px; padding: 20px 24px; cursor: pointer; font-weight: 800; }
    .matrix-card summary span { color: var(--muted); font-weight: 500; }
    .table-scroll { overflow-x: auto; border-top: 1px solid var(--line); }
    table { width: 100%; border-collapse: collapse; min-width: 760px; }
    th, td { padding: 14px 18px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: middle; }
    thead th { background: #eef3e5; color: var(--muted); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; }
    tbody tr:last-child > * { border-bottom: 0; }
    tbody th { width: 42%; }
    tbody th small { display: block; margin-top: 4px; color: var(--muted); font-weight: 500; }
    .ratio-line { display: flex; align-items: center; gap: 10px; white-space: nowrap; }
    .pair-chips { display: inline-flex; }
    .pair-chips i { width: 17px; height: 28px; background: var(--swatch); border: 1px solid rgba(0,0,0,.16); }
    .pair-chips i:first-child { border-radius: 7px 0 0 7px; }
    .pair-chips i:last-child { border-radius: 0 7px 7px 0; }
    .badge { padding: 4px 7px; border-radius: 999px; font-size: .67rem; font-weight: 900; letter-spacing: .04em; }
    .badge.pass { background: #d9edc5; color: #315815; }
    .badge.fail { background: #f7d4d4; color: #742222; }
    .preview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
    .preview-meta { display: flex; justify-content: space-between; gap: 12px; padding: 13px 16px; border-bottom: 1px solid var(--line); color: var(--muted); }
    .preview-meta strong { color: var(--brand); text-transform: uppercase; }
    .app-preview { min-height: 425px; padding: 22px; background: var(--surface); color: var(--text); }
    .app-preview .eyebrow { margin: 0; color: var(--action); font-size: .74rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
    .app-preview h3 { margin: 7px 0; font-size: 1.8rem; }
    .app-preview .secondary { min-height: 42px; color: var(--text-secondary); line-height: 1.45; }
    .mini-card { display: flex; justify-content: space-between; gap: 14px; margin: 18px 0; padding: 15px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-secondary); }
    .feedback { font-size: .82rem; font-weight: 800; }
    .feedback.warning { color: var(--warning); }
    .feedback.error { color: var(--error); }
    .control-row { display: flex; align-items: center; justify-content: space-between; margin: 22px 0; font-weight: 750; }
    .toggle { width: 50px; height: 30px; padding: 3px; border-radius: 99px; background: var(--control); }
    .toggle i { display: block; width: 24px; height: 24px; margin-left: auto; border-radius: 50%; background: var(--surface); }
    .primary-button { padding: 13px 16px; border-radius: 14px; background: var(--action); color: var(--on-action); text-align: center; font-weight: 900; }
    .provenance-card { overflow-x: auto; }
    .provenance-card table { min-width: 1100px; }
    .provenance-card tbody th { width: 20%; }
    .provenance-card td { color: var(--muted); font-size: .82rem; line-height: 1.45; }
    .parity { display: inline-block; margin-bottom: 4px; color: var(--ink); font-weight: 900; }
    .parity.platform-native { color: #6d2b00; }
    .checklist { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 0; list-style: none; }
    .checklist li { position: relative; padding: 18px 18px 18px 48px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); line-height: 1.45; }
    .checklist li::before { content: "✓"; position: absolute; left: 18px; top: 18px; width: 20px; height: 20px; border-radius: 50%; background: var(--brand); color: white; text-align: center; line-height: 20px; font-size: .72rem; font-weight: 900; }
    footer { margin-top: 72px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--muted); display: flex; justify-content: space-between; gap: 24px; }
    @media (max-width: 1100px) {
      .preview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .checklist { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 820px) {
      .shell { width: min(100% - 20px, 720px); padding-top: 10px; }
      .hero { grid-template-columns: 1fr; padding: 28px; }
      .mode-grid, .preview-grid { grid-template-columns: 1fr; }
      .section-head { display: block; }
      .token-row { grid-template-columns: 1fr; }
      .checklist { grid-template-columns: 1fr; }
      footer { display: block; }
    }
    @media print {
      .shell { width: 100%; padding: 0; }
      .hero, .mode-card, .matrix-card, .preview-card, .provenance-card { box-shadow: none; break-inside: avoid; }
    }
    """

    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="Reguerta color catalog {GENERATOR_VERSION}">
  <meta name="contract-digest" content="{digest}">
  <title>{html.escape(catalog['title'])}</title>
  <style>{css}</style>
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="kicker">Design System · Color</p>
        <h1>{html.escape(catalog['title'])}</h1>
        <p class="lede">{html.escape(catalog['subtitle'])}. Paleta efectiva por plataforma, contraste WCAG {html.escape(catalog['wcagVersion'])} calculado y componentes en contexto.</p>
        <p class="generated-note"><strong>Artefacto generado.</strong> No editar este HTML. Cambia <code>color-tokens.json</code> y ejecuta el generador.</p>
      </div>
      <div class="hero-meta">
        <div class="meta-card"><span>Estado</span><strong>{html.escape(catalog['status'])}</strong></div>
        <div class="meta-card"><span>Revisión</span><strong>{html.escape(catalog['lastReviewed'])}</strong></div>
        <div class="meta-card"><span>Contrato</span><strong>{len(contract['tokens'])} tokens · {digest}</strong></div>
        <div class="meta-card"><span>WCAG</span><strong class="{status_class}">{html.escape(status_text)}</strong></div>
      </div>
    </header>

    <section class="catalog-section" aria-labelledby="palette-title">
      <div class="section-head">
        <div><p class="section-kicker">01 — Palette</p><h2 id="palette-title">Paleta por modo</h2></div>
        <p>Un solo nombre semántico, con el valor realmente resuelto por iOS y Android. Las diferencias nativas aparecen separadas, nunca ocultas.</p>
      </div>
      <div class="mode-grid">{''.join(mode_sections)}</div>
    </section>

    <section class="catalog-section" aria-labelledby="contrast-title">
      <div class="section-head">
        <div><p class="section-kicker">02 — WCAG 2.2</p><h2 id="contrast-title">Matriz de contraste</h2></div>
        <p>La decisión PASS/FAIL usa el ratio completo. El valor visible se redondea únicamente para lectura.</p>
      </div>
      <div class="matrix-grid">{''.join(contrast_sections)}</div>
    </section>

    <section class="catalog-section" aria-labelledby="preview-title">
      <div class="section-head">
        <div><p class="section-kicker">03 — Context</p><h2 id="preview-title">Componentes en contexto</h2></div>
        <p>Ejemplos documentales para detectar combinaciones inesperadas. No sustituyen las previews ni las pruebas de cada plataforma.</p>
      </div>
      <div class="preview-grid">{''.join(preview_cards)}</div>
    </section>

    <section class="catalog-section" aria-labelledby="source-title">
      <div class="section-head">
        <div><p class="section-kicker">04 — Sources</p><h2 id="source-title">Procedencia y paridad</h2></div>
        <p>El generador contrasta el contrato con estas fuentes de producción antes de escribir o verificar el catálogo.</p>
      </div>
      <div class="provenance-card">
        <table>
          <thead><tr><th>Token</th><th>iOS</th><th>Android</th><th>Paridad</th></tr></thead>
          <tbody>{provenance_rows}</tbody>
        </table>
      </div>
    </section>

    <section class="catalog-section" aria-labelledby="rules-title">
      <div class="section-head">
        <div><p class="section-kicker">05 — Contract</p><h2 id="rules-title">Reglas de uso</h2></div>
      </div>
      <ul class="checklist">
        <li>Texto normal esencial: mínimo <strong>4.5:1</strong>.</li>
        <li>Controles e indicadores esenciales: mínimo <strong>3:1</strong>.</li>
        <li>Estados pressed se validan tras aplicar el state layer del <strong>12 %</strong>.</li>
        <li>Glass usa backing explícito y tint máximo del <strong>16 %</strong>.</li>
        <li>FAB y barras de total emplean contenedores opacos.</li>
        <li>Color nunca es la única señal de estado o selección.</li>
      </ul>
    </section>

    <footer>
      <span>Issue #212 · WCAG {html.escape(catalog['wcagVersion'])}</span>
      <span>Generator {GENERATOR_VERSION} · contract {digest}</span>
    </footer>
  </main>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify production sources and fail when the generated HTML is stale.",
    )
    args = parser.parse_args()

    try:
        contract = load_contract()
        mode_ids, token_index = validate_contract(contract)
        validate_production_sources(contract, mode_ids, token_index)
        validate_contrast_pairs(contract, token_index)
        rendered = render_catalog(contract, token_index)
    except CatalogError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    if args.check:
        if not OUTPUT_PATH.exists():
            print(
                f"error: missing generated catalog {OUTPUT_PATH.relative_to(REPO_ROOT)}; "
                "run scripts/design-system/generate_color_catalog.py",
                file=sys.stderr,
            )
            return 1
        current = OUTPUT_PATH.read_text(encoding="utf-8")
        if current != rendered:
            print(
                f"error: stale generated catalog {OUTPUT_PATH.relative_to(REPO_ROOT)}; "
                "run scripts/design-system/generate_color_catalog.py",
                file=sys.stderr,
            )
            return 1
        print(
            f"OK: {len(contract['tokens'])} tokens, {len(contract['pairs'])} pairs, "
            f"{len(contract['modes'])} modes, production sources and HTML are in sync."
        )
        return 0

    OUTPUT_PATH.write_text(rendered, encoding="utf-8")
    print(f"Generated {OUTPUT_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
