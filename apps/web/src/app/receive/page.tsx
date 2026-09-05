"use client";

import { Button } from "@receivingX/ui/components/button";
import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function ReceiveContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const defaultLocation = useQuery(trpc.locations.default.queryOptions());
  const current = useQuery(trpc.receiving.session.current.queryOptions());

  const sessionId = current.data?.id;
  const session = useQuery({
    ...trpc.receiving.session.get.queryOptions({ id: sessionId ?? "" }),
    enabled: Boolean(sessionId),
  });

  const start = useMutation(
    trpc.receiving.session.start.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.receiving.session.current.queryKey() }),
    }),
  );

  const addPackage = useMutation(
    trpc.receiving.package.create.mutationOptions({
      onSuccess: (pkg) => router.push(`/receive/${pkg.id}`),
    }),
  );

  const finish = useMutation(
    trpc.receiving.session.finish.mutationOptions({
      onSuccess: () => {
        toast.success("Session finished. Notifications sent.");
        queryClient.invalidateQueries({ queryKey: trpc.receiving.session.current.queryKey() });
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const cancel = useMutation(
    trpc.receiving.session.cancel.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.receiving.session.current.queryKey() }),
    }),
  );

  if (!current.data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-xl font-semibold">Start receiving</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start a session, then photograph each package's label. Check them all in and finish to notify
          receiving, accounting, and the sales rep.
        </p>
        <Button
          className="mt-6"
          disabled={!defaultLocation.data || start.isPending}
          onClick={() => defaultLocation.data && start.mutate({ locationId: defaultLocation.data.id })}
        >
          {start.isPending ? "Starting..." : "Start receiving"}
        </Button>
      </div>
    );
  }

  const packages = session.data?.packages ?? [];
  const canFinish = packages.length > 0 && packages.every((p) => p.status !== "PENDING_OCR" && p.status !== "NEEDS_REVIEW");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Receiving session</h1>
          <p className="text-sm text-muted-foreground">
            Started {new Date(current.data.startedAt).toLocaleTimeString()}
          </p>
        </div>
        {packages.length === 0 && (
          <Button variant="ghost" onClick={() => cancel.mutate({ id: current.data!.id })}>
            Cancel session
          </Button>
        )}
      </div>

      <div className="mt-6 divide-y divide-border border border-border">
        {packages.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No packages yet. Add one to snap its label.
          </div>
        )}
        {packages.map((pkg) => (
          <Link
            key={pkg.id}
            href={`/receive/${pkg.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-muted"
          >
            <div>
              <div className="font-data font-medium">{pkg.publicId}</div>
              <div className="text-xs text-muted-foreground">
                {pkg.salesOrderLine
                  ? `${pkg.salesOrderLine.salesOrder.customer.name} - PO ${pkg.salesOrderLine.poNumber}`
                  : "Not matched yet"}
              </div>
            </div>
            <StatusBadge status={pkg.status} />
          </Link>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <Button
          variant="outline"
          disabled={addPackage.isPending}
          onClick={() => addPackage.mutate({ sessionId: current.data!.id })}
        >
          + Add package
        </Button>
        <Button
          disabled={!canFinish || finish.isPending}
          onClick={() => finish.mutate({ id: current.data!.id })}
          className="ml-auto"
        >
          {finish.isPending ? "Sending..." : "Finish session and notify"}
        </Button>
      </div>
      {!canFinish && packages.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Every package needs to be reviewed before the session can be finished.
        </p>
      )}
    </div>
  );
}

export default function ReceivePage() {
  return (
    <RequireAuth roles={["receiver"]}>
      <ReceiveContent />
    </RequireAuth>
  );
}
