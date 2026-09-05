import * as XLSX from "xlsx";

export type ParsedOrderRow = {
  rowIndex: number;
  soNumber: string;
  customer: string;
  orderDate: string | null;
  vendor: string;
  po: string;
  qty: number;
  pn: string;
  description: string;
  serials: string[];
  receivedDate: string | null;
  eta: string | null;
  errors: string[];
};

const HEADER_SYNONYMS: Record<string, string[]> = {
  so: ["so", "sonumber", "salesorder", "order", "ordernumber"],
  customer: ["customer"],
  orderDate: ["orderdate", "date"],
  vendor: ["vendor"],
  po: ["po", "ponumber"],
  qty: ["qty", "quantity"],
  pn: ["pn", "partnumber", "part"],
  description: ["description", "desc"],
  sn: ["sn", "serial", "serialnumber", "serialnumbers"],
  received: ["received", "receiveddate", "datereceived"],
  eta: ["eta"],
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildColumnIndex(headers: string[]): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const index: Record<string, number> = {};
  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    const found = normalized.findIndex((h) => synonyms.includes(h));
    if (found >= 0) index[field] = found;
  }
  return index;
}

function parseDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Parses the legacy spreadsheet (xlsx or csv) into row objects, tolerant of missing SO#. */
export function parseOrdersWorkbook(buffer: Buffer): ParsedOrderRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });

  if (raw.length < 2) return [];
  const headers = raw[0] ?? [];
  const columns = buildColumnIndex(headers as string[]);

  const rows: ParsedOrderRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as string[];
    if (!cells || cells.every((c) => !String(c ?? "").trim())) continue;

    const get = (field: string): string => {
      const idx = columns[field];
      return idx === undefined ? "" : String(cells[idx] ?? "").trim();
    };

    const errors: string[] = [];
    const customer = get("customer");
    const po = get("po");
    const pn = get("pn");
    const qtyRaw = get("qty");
    const qty = qtyRaw ? Number.parseInt(qtyRaw, 10) : 1;

    if (!customer) errors.push("Missing Customer");
    if (!po) errors.push("Missing PO");
    if (!pn) errors.push("Missing PN");
    if (Number.isNaN(qty)) errors.push(`Invalid Qty: ${qtyRaw}`);

    const soNumber = get("so") || `PO-${po}`;
    const serials = get("sn")
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    rows.push({
      rowIndex: i + 1,
      soNumber,
      customer,
      orderDate: parseDate(get("orderDate")),
      vendor: get("vendor"),
      po,
      qty: Number.isNaN(qty) ? 1 : qty,
      pn,
      description: get("description"),
      serials,
      receivedDate: parseDate(get("received")),
      eta: parseDate(get("eta")),
      errors,
    });
  }

  return rows;
}
