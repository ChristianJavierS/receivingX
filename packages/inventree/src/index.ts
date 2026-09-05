import { env } from "@receivingX/env/server";

export type InventreeStockItem = {
  pk: number;
  url: string;
};

export function inventreeConfigured(): boolean {
  return Boolean(env.INVENTREE_URL && env.INVENTREE_TOKEN);
}

function baseUrl(): string {
  return (env.INVENTREE_URL ?? "").replace(/\/$/, "");
}

async function inventreeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${env.INVENTREE_TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`InvenTree ${init?.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export async function inventreeHealthCheck(): Promise<boolean> {
  if (!inventreeConfigured()) return false;
  try {
    await inventreeFetch("/api/", { method: "GET" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Find an existing InvenTree Part by internal part number (IPN), or create
 * one on the fly. ReceivingX's `partNumber` (from the sales order line) maps
 * to InvenTree's IPN field so re-receiving the same PN reuses the same Part.
 */
export async function findOrCreatePart(params: {
  ipn: string;
  name: string;
  description?: string;
  categoryId?: number;
}): Promise<number> {
  type PartListItem = { pk: number; IPN?: string };
  const existing = await inventreeFetch<PartListItem[]>(
    `/api/part/?IPN=${encodeURIComponent(params.ipn)}`,
  );
  if (existing.length > 0 && existing[0]) return existing[0].pk;

  const created = await inventreeFetch<PartListItem>("/api/part/", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      IPN: params.ipn,
      description: params.description ?? params.name,
      category: params.categoryId ?? env.INVENTREE_DEFAULT_LOCATION,
      active: true,
      purchaseable: true,
      component: false,
    }),
  });
  return created.pk;
}

/**
 * Creates an InvenTree StockItem for a received package and returns its PK +
 * a link into the InvenTree UI, which we encode into the printed QR label.
 * Callers should treat failures as non-fatal (see PLAN.md "Risks") - the
 * package is still checked in locally and can be synced later.
 */
export async function createStockItem(params: {
  partId: number;
  quantity: number;
  serial?: string;
  locationId?: number;
  notes?: string;
}): Promise<InventreeStockItem> {
  type StockItem = { pk: number };
  const created = await inventreeFetch<StockItem>("/api/stock/", {
    method: "POST",
    body: JSON.stringify({
      part: params.partId,
      quantity: params.quantity,
      serial: params.serial,
      location: params.locationId ?? env.INVENTREE_DEFAULT_LOCATION,
      notes: params.notes,
    }),
  });
  return { pk: created.pk, url: `${baseUrl()}/stock/item/${created.pk}/` };
}

export type CheckInToInventreeResult =
  | { ok: true; stockItemId: string; url: string }
  | { ok: false; error: string };

/**
 * High-level helper used by the receiving.package.checkIn procedure. Never
 * throws - always returns a result object so the transaction that owns the
 * Package row can proceed regardless of InvenTree availability.
 */
export async function checkInToInventree(params: {
  partNumber: string;
  description: string;
  quantity: number;
  serial?: string;
  notes?: string;
}): Promise<CheckInToInventreeResult> {
  if (!inventreeConfigured()) {
    return { ok: false, error: "InvenTree is not configured" };
  }
  try {
    const partId = await findOrCreatePart({
      ipn: params.partNumber,
      name: params.partNumber,
      description: params.description,
    });
    const stockItem = await createStockItem({
      partId,
      quantity: params.quantity,
      serial: params.serial,
      notes: params.notes,
    });
    return { ok: true, stockItemId: String(stockItem.pk), url: stockItem.url };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
