"use client";

import { Button } from "@receivingX/ui/components/button";
import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@receivingX/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function SessionDetailContent() {
  const params = useParams<{ id: string }>();
  const session = useQuery(trpc.receiving.session.get.queryOptions({ id: params.id }));
  const resend = useMutation(
    trpc.notifications.resend.mutationOptions({
      onSuccess: () => toast.success("Notifications resent"),
      onError: (err) => toast.error(err.message),
    }),
  );
  const renderLabel = useMutation(trpc.labels.render.mutationOptions());

  async function printLabel(packageId: string) {
    const { pdfBase64 } = await renderLabel.mutateAsync({ packageId, format: "thermal" });
    const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    window.open(URL.createObjectURL(blob), "_blank");
  }

  if (!session.data) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">{session.data.location.name}</h1>
          <p className="text-sm text-muted-foreground">
            {session.data.receiver.name} - {new Date(session.data.startedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={session.data.status} />
          <Button variant="outline" onClick={() => resend.mutate({ sessionId: session.data!.id })}>
            Resend notification
          </Button>
        </div>
      </div>

      <div className="mt-6 border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>PO</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Serials</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {session.data.packages.map((pkg) => (
              <TableRow key={pkg.id}>
                <TableCell className="font-data">{pkg.publicId}</TableCell>
                <TableCell>{pkg.salesOrderLine?.salesOrder.customer.name ?? "-"}</TableCell>
                <TableCell className="font-data">{pkg.salesOrderLine?.poNumber ?? "-"}</TableCell>
                <TableCell>{pkg.qtyReceived}</TableCell>
                <TableCell className="font-data">{pkg.serials.map((s) => s.serial).join(", ")}</TableCell>
                <TableCell>
                  <StatusBadge status={pkg.status} />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => printLabel(pkg.id)}>
                    Print label
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {session.data.notifications.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <div className="mt-2 divide-y divide-border border border-border text-xs">
            {session.data.notifications.map((n) => (
              <div key={n.id} className="flex items-center justify-between px-3 py-2">
                <span>{n.toEmails.join(", ")}</span>
                <StatusBadge status={n.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionDetailPage() {
  return (
    <RequireAuth>
      <SessionDetailContent />
    </RequireAuth>
  );
}
