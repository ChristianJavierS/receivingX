"""PaddleOCR + barcode sidecar for ReceivingX.

Exposes a single OCR endpoint used by packages/ocr (the Node/TS client). This
service is intentionally dumb: it turns an image into text + bounding boxes +
confidence scores, plus any barcodes it can decode. Field-level parsing
(PO/SO/SN/PN extraction, barcode classification) lives in the TypeScript
layer so it can be iterated on without rebuilding this container.

Barcodes are decoded first and are the highest-confidence signal available:
a Code128/DataMatrix serial number is character-exact, where OCR can and will
occasionally misread 0/O, 1/I, 5/S, 8/B in a hand-photographed label.
"""

from __future__ import annotations

import io
import logging
from typing import Any

import numpy as np
import zxingcpp
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageOps

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr")

app = FastAPI(title="ReceivingX OCR", version="1.1.0")

_ocr_engine: Any = None
_engine_error: str | None = None

# Safety net for non-browser clients (the web app already downsizes before
# upload - see apps/web's capture flow). PaddleOCR does its own internal
# normalization, so we deliberately do the minimum here: cap runaway
# resolutions and guarantee RGB.
MAX_DIMENSION = 2600


def get_engine() -> Any:
    """Lazily create the PaddleOCR engine (loads model weights on first use)."""
    global _ocr_engine
    if _ocr_engine is None:
        logger.info("Loading PaddleOCR engine...")
        from paddleocr import PaddleOCR

        _ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        logger.info("PaddleOCR engine ready")
    return _ocr_engine


def prepare_image(raw: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(raw))
    # Respect EXIF orientation from cameras that didn't get normalized client-side.
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")
    if max(image.width, image.height) > MAX_DIMENSION:
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
    return image


def decode_barcodes(image: Image.Image) -> list[dict]:
    try:
        results = zxingcpp.read_barcodes(image)
    except Exception as exc:  # noqa: BLE001 - never let a barcode failure sink OCR
        logger.warning("Barcode decode failed: %s", exc)
        return []

    barcodes: list[dict] = []
    for r in results:
        if not r.valid:
            continue
        pos = r.position
        barcodes.append(
            {
                "text": r.text,
                "format": str(r.format),
                "position": [
                    [pos.top_left.x, pos.top_left.y],
                    [pos.top_right.x, pos.top_right.y],
                    [pos.bottom_right.x, pos.bottom_right.y],
                    [pos.bottom_left.x, pos.bottom_left.y],
                ],
            }
        )
    return barcodes


@app.get("/health")
def health() -> dict:
    """Actually exercises the OCR engine, not just "is uvicorn up". A crash
    on import (e.g. a missing shared library) previously reported healthy
    forever while every real /ocr call 500'd."""
    global _engine_error
    try:
        engine = get_engine()
        probe = Image.new("RGB", (64, 64), color="white")
        engine.ocr(np.array(probe), cls=True)
        _engine_error = None
        return {"status": "ok", "engine": "ok"}
    except Exception as exc:  # noqa: BLE001
        _engine_error = str(exc)
        logger.error("OCR engine health check failed: %s", exc)
        return {"status": "degraded", "engine": "failed", "error": _engine_error}


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)) -> dict:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")

    raw = await file.read()
    try:
        image = prepare_image(raw)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not decode image: {exc}") from exc

    barcodes = decode_barcodes(image)

    engine = get_engine()
    result = engine.ocr(np.array(image), cls=True)

    blocks: list[dict] = []
    lines: list[str] = []
    for page in result or []:
        for entry in page or []:
            box, (text, confidence) = entry
            blocks.append(
                {
                    "text": text,
                    "confidence": float(confidence),
                    "box": [[float(x), float(y)] for x, y in box],
                }
            )
            lines.append(text)

    return {
        "rawText": "\n".join(lines),
        "blocks": blocks,
        "barcodes": barcodes,
        "width": image.width,
        "height": image.height,
    }
