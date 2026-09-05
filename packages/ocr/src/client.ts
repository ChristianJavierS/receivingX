import { env } from "@receivingX/env/server";

export type OcrBlock = {
  text: string;
  confidence: number;
  box: [number, number][];
};

export type OcrResult = {
  rawText: string;
  blocks: OcrBlock[];
  width: number;
  height: number;
};

export class OcrServiceError extends Error {}

/**
 * Sends an image to the self-hosted PaddleOCR sidecar and returns raw text +
 * bounding boxes. Throws OcrServiceError on any failure so callers can mark
 * the photo `ocrStatus = FAILED` and let the receiver enter fields manually.
 */
export async function runOcr(params: {
  buffer: Buffer | Uint8Array;
  filename: string;
  mimeType: string;
}): Promise<OcrResult> {
  const form = new FormData();
  const bytes = new Uint8Array(Buffer.from(params.buffer)).slice();
  form.append("file", new Blob([bytes], { type: params.mimeType }), params.filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OCR_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.OCR_URL}/ocr`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new OcrServiceError(`OCR service responded ${res.status}: ${text}`);
    }

    return (await res.json()) as OcrResult;
  } catch (err) {
    if (err instanceof OcrServiceError) throw err;
    throw new OcrServiceError(`OCR service unreachable: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function ocrHealthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${env.OCR_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
