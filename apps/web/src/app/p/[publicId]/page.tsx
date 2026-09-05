"use client";

import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function PackageLookupContent() {
  const params = useParams<{ publicId: string }>();
  const pkg = useQuery(trpc.receiving.package.getByPublicId.queryOptions({ publicId: params.publicId }));

  if (!pkg.data) return <div className="p-6 text-sm text-muted-foreground">Looking up {params.publicId}...</div>;

  const line = pkg.data.salesOrderLine;

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-data font-display text-lg font-semibold">{pkg.data.publicId}</h1>
        <StatusBadge status={pkg.data.status} />
      </div>
      <dl className="mt-4 divide-y divide-border border border-border text-sm">
        <Row label="Customer" value={line?.salesOrder.customer.name ?? "Unmatched"} />
        <Row label="PO" value={line?.poNumber ?? "-"} mono />
        <Row label="PN" value={line?.partNumber ?? "-"} mono />
        <Row label="Description" value={line?.description ?? "-"} />
        <Row label="Qty received" value={String(pkg.data.qtyReceived)} />
        <Row label="Serials" value={pkg.data.serials.map((s) => s.serial).join(", ") || "-"} mono />
        <Row label="Received" value={new Date(pkg.data.receivedAt).toLocaleString()} />
        <Row label="InvenTree" value={pkg.data.inventreeUrl ?? "not synced"} />
      </dl>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-data" : ""}>{value}</span>
    </div>
  );
}

export default function PackageLookupPage() {
  return (
    <RequireAuth>
      <PackageLookupContent />
    </RequireAuth>
  );
}
