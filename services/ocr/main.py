"""PaddleOCR sidecar for ReceivingX.

Exposes a single OCR endpoint used by packages/ocr (the Node/TS client). This
service is intentionally dumb: it only turns an image into text + bounding
boxes + confidence scores. Field-level parsing (PO/SO/SN/PN extraction) lives
in the TypeScript layer so it can be iterated on without rebuilding this
container.
"""

from __future__ import annotations

import io
import logging
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr")

app = FastAPI(title="ReceivingX OCR", version="1.0.0")

_ocr_engine: Any = None


def get_engine() -> Any:
    """Lazily create the PaddleOCR engine (loads model weights on first use)."""
    global _ocr_engine
    if _ocr_engine is None:
        logger.info("Loading PaddleOCR engine...")
        from paddleocr import PaddleOCR

        _ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        logger.info("PaddleOCR engine ready")
    return _ocr_engine


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)) -> dict:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")

    raw = await file.read()
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not decode image: {exc}") from exc

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
        "width": image.width,
        "height": image.height,
    }
