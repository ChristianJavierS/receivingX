/**
 * Heuristic field extraction over raw OCR text from a FedEx-style shipping
 * label or vendor packing slip. This is intentionally conservative: it
 * returns *candidates* with a confidence score, never a single "answer".
 * The receiver always confirms in the review UI (see ReceivingX.md / PLAN.md).
 */

export type ExtractedFieldKey =
  | "PO"
  | "SO"
  | "SN"
  | "PN"
  | "QTY"
  | "VENDOR"
  | "CUSTOMER_NAME"
  | "DESCRIPTION"
  | "TRACKING"
  | "SHIP_FROM";

export type FieldCandidate = {
  key: ExtractedFieldKey;
  value: string;
  confidence: number;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function pushAll(
  out: FieldCandidate[],
  key: ExtractedFieldKey,
  text: string,
  regex: RegExp,
  confidence: number,
) {
  const values: string[] = [];
  for (const match of text.matchAll(regex)) {
    const value = match[1]?.trim();
    if (value) values.push(value);
  }
  for (const value of unique(values)) {
    out.push({ key, value, confidence });
  }
}

const RE_PO = /\bP\.?\s?O\.?\s*#?\s*[:#]?\s*(\d{5,9})\b/gi;
const RE_SO = /\bS\.?\s?O\.?\s*#?\s*[:#]?\s*(\d{4,9})\b/gi;
const RE_SN = /\bS\/?N\s*#?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,19})\b/gi;
const RE_PN = /\bP\/?N\s*#?\s*[:#]?\s*([A-Z0-9][A-Z0-9#.-]{2,19})\b/gi;
const RE_QTY = /\bQ(?:T)?Y\.?\s*[:#]?\s*(\d{1,4})\b/gi;
// FedEx tracking numbers are 12, 15, or 20 digits.
const RE_TRACKING = /\b(\d{20}|\d{15}|\d{12})\b/g;
// "WHERE did it come from" (ReceivingX.md) - the label's From/Ship-From block.
const RE_SHIP_FROM = /\b(?:SHIP(?:PED)?\s*FROM|FROM)\s*[:#]\s*([A-Za-z0-9][^\n]{2,60})/gi;
// "FOR WHOM is it" - the label's To/Ship-To/Attn block.
const RE_CUSTOMER_NAME = /\b(?:SHIP\s*TO|DELIVER\s*TO|ATTN|ATTENTION|CUSTOMER)\s*[:#]\s*([A-Za-z0-9][^\n]{2,60})/gi;
const RE_VENDOR = /\b(?:VENDOR|SOLD\s*BY|SUPPLIER|MANUFACTURER)\s*[:#]\s*([A-Za-z0-9][^\n]{2,60})/gi;
const RE_DESCRIPTION = /\b(?:DESC(?:RIPTION)?|ITEM)\s*[:#]\s*([A-Za-z0-9][^\n]{2,80})/gi;

/**
 * Extract every candidate field from raw OCR text. `poCandidates` (open
 * SalesOrderLine.poNumber values from the DB) lets us bias confidence toward
 * numbers that are actually open, since bare digit runs are ambiguous.
 */
export function extractFieldsFromText(
  rawText: string,
  context?: { openPoNumbers?: string[]; openPartNumbers?: string[]; vendorNames?: string[] },
): FieldCandidate[] {
  const out: FieldCandidate[] = [];
  const text = rawText.replace(/\r/g, "");

  pushAll(out, "PO", text, RE_PO, 0.75);
  pushAll(out, "SO", text, RE_SO, 0.7);
  pushAll(out, "SN", text, RE_SN, 0.65);
  pushAll(out, "PN", text, RE_PN, 0.6);
  pushAll(out, "QTY", text, RE_QTY, 0.55);
  pushAll(out, "TRACKING", text, RE_TRACKING, 0.5);
  pushAll(out, "SHIP_FROM", text, RE_SHIP_FROM, 0.5);
  pushAll(out, "CUSTOMER_NAME", text, RE_CUSTOMER_NAME, 0.5);
  pushAll(out, "VENDOR", text, RE_VENDOR, 0.45);
  pushAll(out, "DESCRIPTION", text, RE_DESCRIPTION, 0.4);

  // Boost confidence for numbers that match a known open PO/PN so the auto-match
  // step in the receiving flow has a strong signal.
  const openPos = new Set(context?.openPoNumbers ?? []);
  const openPns = new Set((context?.openPartNumbers ?? []).map((p) => p.toUpperCase()));

  for (const candidate of out) {
    if (candidate.key === "PO" && openPos.has(candidate.value)) {
      candidate.confidence = 0.97;
    }
    if (candidate.key === "PN" && openPns.has(candidate.value.toUpperCase())) {
      candidate.confidence = 0.9;
    }
  }

  // Any bare digit run that matches an open PO number, even without a "PO#"
  // label nearby, is worth surfacing (labels often just print the raw number).
  for (const po of openPos) {
    const found = text.includes(po);
    if (found && !out.some((c) => c.key === "PO" && c.value === po)) {
      out.push({ key: "PO", value: po, confidence: 0.85 });
    }
  }

  // A known vendor's name appearing anywhere on the label is a strong
  // signal even without a "Vendor:" label nearby.
  for (const vendor of context?.vendorNames ?? []) {
    if (text.toUpperCase().includes(vendor.toUpperCase())) {
      const existing = out.find((c) => c.key === "VENDOR" && c.value.toUpperCase() === vendor.toUpperCase());
      if (existing) existing.confidence = Math.max(existing.confidence, 0.8);
      else out.push({ key: "VENDOR", value: vendor, confidence: 0.75 });
    }
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}
