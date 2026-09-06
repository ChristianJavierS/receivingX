"use client";

import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { useQuery } from "@tanstack/react-query";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function HealthContent() {
  const health = useQuery(trpc.health.check.queryOptions());

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">System health</h1>
      <div className="mt-4 divide-y divide-border border border-border text-sm">
        <Row label="OCR service (PaddleOCR)" ok={health.data?.ocr.ok} note={health.data?.ocr.error} />
        <Row label="InvenTree" ok={health.data?.inventree.ok} note={health.data?.inventree.configured ? undefined : "not configured"} />
        <Row label="Microsoft Graph mail" ok={health.data?.mail.configured} note={health.data?.mail.configured ? undefined : "not configured"} />
      </div>
    </div>
  );
}

function Row({ label, ok, note }: { label: string; ok?: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        {note && <span className="max-w-xs truncate text-xs text-muted-foreground" title={note}>{note}</span>}
        <StatusBadge status={ok ? "CHECKED_IN" : "FAILED"} />
      </div>
    </div>
  );
}

export default function HealthPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <HealthContent />
    </RequireAuth>
  );
}
