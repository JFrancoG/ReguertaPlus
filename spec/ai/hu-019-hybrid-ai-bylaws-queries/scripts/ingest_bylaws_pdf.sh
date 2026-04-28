#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
TRACK_DIR="${ROOT_DIR}/spec/ai/hu-019-hybrid-ai-bylaws-queries"
SOURCE_PDF="${TRACK_DIR}/data/source/reguerta-estatutos.pdf"
OUTPUT_JSON="${TRACK_DIR}/data/processed/bylaws-index-es.json"
OUTPUT_MD="${TRACK_DIR}/data/processed/reguerta-estatutos.md"
SOURCE_URL="${1:-https://drive.google.com/file/d/1anlf88Q3AfGpQvBD-hxVx5CkXgncoPdS/view?usp=sharing}"

if [[ ! -f "${SOURCE_PDF}" ]]; then
  echo "Missing source PDF: ${SOURCE_PDF}" >&2
  exit 1
fi

python3 "${TRACK_DIR}/scripts/ingest_bylaws_pdf.py" \
  --repo-root "${ROOT_DIR}" \
  --source-pdf "${SOURCE_PDF}" \
  --source-url "${SOURCE_URL}" \
  --output-json "${OUTPUT_JSON}" \
  --output-md "${OUTPUT_MD}"
