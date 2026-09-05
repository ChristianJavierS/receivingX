"use client";

import { Button } from "@receivingX/ui/components/button";
import { Input } from "@receivingX/ui/components/input";
import { Label } from "@receivingX/ui/components/label";
import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { Textarea } from "@receivingX/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function ReviewContent() {
  const params = useParams<{ packageId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const packageId = params.packageId;

  const pkgQuery = useQuery(trpc.receiving.package.get.queryOptions({ id: packageId }));
  const pkg = pkgQuery.data;

  const [search, setSearch] = useState("");
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [qtyReceived, setQtyReceived] = useState(1);
  const [serials, setSerials] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shipFrom, setShipFrom] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (pkg?.salesOrderLineId) setSelectedLineId(pkg.salesOrderLineId);
    if (pkg?.qtyReceived) setQtyReceived(pkg.qtyReceived);
    if (pkg?.trackingNumber) setTrackingNumber(pkg.trackingNumber);
    if (pkg?.carrier) setCarrier(pkg.carrier);
    if (pkg?.shipFrom) setShipFrom(pkg.shipFrom);
    if (pkg?.notes) setNotes(pkg.notes);
  }, [pkg?.id]);

  const suggestions = useQuery({
    ...trpc.receiving.package.suggestMatches.queryOptions({ packageId, search: search || undefined }),
    enabled: Boolean(pkg),
  });

  const uploadUrlMutation = useMutation(trpc.receiving.package.photoUploadUrl.mutationOptions());
  const confirmPhotoMutation = useMutation(
    trpc.receiving.package.confirmPhoto.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.receiving.package.get.queryKey({ id: packageId }) }),
    }),
  );
  const reocrMutation = useMutation(
    trpc.receiving.package.reocr.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.receiving.package.get.queryKey({ id: packageId }) }),
    }),
  );
  const checkIn = useMutation(
    trpc.receiving.package.checkIn.mutationOptions({
      onSuccess: () => {
        toast.success("Package checked in");
        router.push("/receive");
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { photoId, key, uploadUrl } = await uploadUrlMutation.mutateAsync({
        packageId,
        mimeType: file.type,
        kind: "LABEL",
      });
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await confirmPhotoMutation.mutateAsync({
        packageId,
        objectKey: key,
        mimeType: file.type,
        bytes: file.size,
        kind: "LABEL",
      });
      void photoId;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const fieldsByKey = useMemo(() => {
    const map: Record<string, { value: string; confidence: number | null }[]> = {};
    for (const f of pkg?.extractedFields ?? []) {
      map[f.key] ??= [];
      map[f.key]!.push({ value: f.value, confidence: f.confidence });
    }
    return map;
  }, [pkg?.extractedFields]);

  if (pkgQuery.isLoading || !pkg) {
    return <div className="p-6 text-sm text-muted-foreground">Loading package...</div>;
  }

  const needsPhoto = pkg.photos.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-data font-display text-lg font-semibold">{pkg.publicId}</h1>
          <p className="text-xs text-muted-foreground">Photograph the label, confirm the fields, then check in.</p>
        </div>
        <StatusBadge status={pkg.status} />
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Photos</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {pkg.photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={photo.url}
              alt={photo.kind}
              className="aspect-square rounded-none border border-border object-cover"
            />
          ))}
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-border text-xs text-muted-foreground hover:bg-muted">
            {uploading ? "Uploading..." : needsPhoto ? "Snap label" : "+ Add photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {pkg.photos.some((p) => p.ocrStatus === "FAILED") && (
          <p className="mt-2 text-xs text-destructive">
            OCR failed on a photo - fields below may be incomplete. Enter them manually or{" "}
            <button
              className="underline"
              onClick={() => pkg.photos[0] && reocrMutation.mutate({ photoId: pkg.photos[0].id })}
            >
              retry
            </button>
            .
          </p>
        )}
      </section>

      {Object.keys(fieldsByKey).length > 0 && (
        <section className="mt-6 border border-border p-3 text-xs">
          <h2 className="text-sm font-semibold">OCR candidates</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(fieldsByKey).map(([key, values]) =>
              values.map((v) => (
                <span
                  key={`${key}-${v.value}`}
                  className="font-data rounded-full border border-border bg-muted px-2 py-1"
                  title={`confidence ${(v.confidence ?? 0).toFixed(2)}`}
                >
                  {key}: {v.value}
                </span>
              )),
            )}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Match to an order</h2>
        <Input
          className="mt-2"
          placeholder="Search by PO, PN, customer, or SO#"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-2 max-h-56 divide-y divide-border overflow-y-auto border border-border">
          {suggestions.data?.map((line) => (
            <button
              key={line.id}
              onClick={() => setSelectedLineId(line.id)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted ${
                selectedLineId === line.id ? "bg-cyan-100" : ""
              }`}
            >
              <span>
                <span className="font-data font-medium">PO {line.poNumber}</span> - {line.salesOrder.customer.name} -{" "}
                {line.partNumber}
              </span>
              <span className="text-muted-foreground">
                {line.qtyReceived}/{line.qtyOrdered}
              </span>
            </button>
          ))}
          {suggestions.data?.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matching open lines.</div>
          )}
        </div>
        {selectedLineId && (
          <Button variant="ghost" className="mt-2" onClick={() => setSelectedLineId(null)}>
            Clear match (log as unmatched)
          </Button>
        )}
      </section>

      <section className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="qty">Qty received</Label>
          <Input
            id="qty"
            type="number"
            min={1}
            value={qtyReceived}
            onChange={(e) => setQtyReceived(Number(e.target.value) || 1)}
          />
        </div>
        <div>
          <Label htmlFor="carrier">Carrier</Label>
          <Input id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="FedEx" />
        </div>
        <div>
          <Label htmlFor="tracking">Tracking #</Label>
          <Input id="tracking" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="shipFrom">Ship from</Label>
          <Input id="shipFrom" value={shipFrom} onChange={(e) => setShipFrom(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="serials">Serial numbers (one per line)</Label>
          <Textarea id="serials" rows={3} value={serials} onChange={(e) => setSerials(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </section>

      <Button
        className="mt-6 w-full"
        size="lg"
        disabled={needsPhoto || checkIn.isPending}
        onClick={() =>
          checkIn.mutate({
            packageId,
            salesOrderLineId: selectedLineId,
            qtyReceived,
            serials: serials
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            carrier: carrier || undefined,
            trackingNumber: trackingNumber || undefined,
            shipFrom: shipFrom || undefined,
            notes: notes || undefined,
          })
        }
      >
        {checkIn.isPending ? "Checking in..." : "Check in package"}
      </Button>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <RequireAuth roles={["receiver"]}>
      <ReviewContent />
    </RequireAuth>
  );
}
