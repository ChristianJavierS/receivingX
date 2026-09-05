"use client";

import { Button } from "@receivingX/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImportContent() {
  const router = useRouter();
  const defaultLocation = useQuery(trpc.locations.default.queryOptions());
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [filename, setFilename] = useState("");

  const preview = useMutation(trpc.orders.import.preview.mutationOptions());
  const commit = useMutation(
    trpc.orders.import.commit.mutationOptions({
      onSuccess: (batch) => {
        toast.success(`Imported ${batch.okCount} of ${batch.rowCount} rows`);
        router.push("/orders");
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Import spreadsheet</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload the legacy Excel/CSV export. Expected columns: SO#, Customer, Order Date, Vendor, PO, Qty, PN,
        Description, SN, Received, ETA (SO# and SN are optional).
      </p>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="mt-4 text-sm"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setFilename(file.name);
          const base64 = await fileToBase64(file);
          setFileBase64(base64);
          preview.mutate({ fileBase64: base64 });
        }}
      />

      {preview.data && (
        <div className="mt-6 border border-border p-4 text-sm">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="font-display text-2xl font-bold">{preview.data.summary.total}</div>
              <div className="text-xs text-muted-foreground">Rows</div>
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-success">{preview.data.summary.ok}</div>
              <div className="text-xs text-muted-foreground">Valid</div>
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-destructive">{preview.data.summary.errors}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
            <div>
              <div className="font-display text-2xl font-bold">{preview.data.summary.distinctOrders}</div>
              <div className="text-xs text-muted-foreground">Orders</div>
            </div>
          </div>

          {preview.data.rows.some((r) => r.errors.length > 0) && (
            <div className="mt-4 max-h-40 overflow-y-auto border border-destructive/30 bg-destructive/5 p-2 text-xs">
              {preview.data.rows
                .filter((r) => r.errors.length > 0)
                .map((r) => (
                  <div key={r.rowIndex}>
                    Row {r.rowIndex}: {r.errors.join(", ")}
                  </div>
                ))}
            </div>
          )}

          <Button
            className="mt-4"
            disabled={!fileBase64 || !defaultLocation.data || commit.isPending}
            onClick={() =>
              fileBase64 &&
              defaultLocation.data &&
              commit.mutate({ fileBase64, filename, locationId: defaultLocation.data.id })
            }
          >
            {commit.isPending ? "Importing..." : `Import ${preview.data.summary.ok} rows`}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <RequireAuth roles={["sales"]}>
      <ImportContent />
    </RequireAuth>
  );
}
