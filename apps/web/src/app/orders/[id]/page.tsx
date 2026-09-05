"use client";

import { Button } from "@receivingX/ui/components/button";
import { Input } from "@receivingX/ui/components/input";
import { Label } from "@receivingX/ui/components/label";
import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@receivingX/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const order = useQuery(trpc.orders.get.queryOptions({ id: params.id }));
  const vendors = useQuery(trpc.vendors.list.queryOptions());

  const [poNumber, setPoNumber] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [qtyOrdered, setQtyOrdered] = useState(1);
  const [vendorName, setVendorName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.orders.get.queryKey({ id: params.id }) });

  const addVendor = useMutation(trpc.vendors.create.mutationOptions());
  const addLine = useMutation(
    trpc.orders.lines.create.mutationOptions({
      onSuccess: () => {
        toast.success("Line added");
        setPoNumber("");
        setPartNumber("");
        setDescription("");
        setQtyOrdered(1);
        setVendorName("");
        invalidate();
      },
    }),
  );
  const closeOrder = useMutation(
    trpc.orders.close.mutationOptions({ onSuccess: () => invalidate() }),
  );

  if (!order.data) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-data font-display text-xl font-semibold">{order.data.soNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {order.data.customer.name} - {new Date(order.data.orderDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.data.status} />
          {order.data.status !== "CLOSED" && (
            <Button variant="outline" onClick={() => closeOrder.mutate({ id: order.data.id })}>
              Close order
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>PN</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.data.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-data">{line.poNumber}</TableCell>
                <TableCell>{line.vendor?.name ?? "-"}</TableCell>
                <TableCell className="font-data">{line.partNumber}</TableCell>
                <TableCell className="max-w-xs truncate">{line.description}</TableCell>
                <TableCell>
                  {line.qtyReceived}/{line.qtyOrdered}
                </TableCell>
                <TableCell>{line.eta ? new Date(line.eta).toLocaleDateString() : "-"}</TableCell>
                <TableCell>
                  <StatusBadge status={line.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section className="mt-6 border border-border p-4">
        <h2 className="text-sm font-semibold">Add a line</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <Label>PO number</Label>
            <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
          </div>
          <div>
            <Label>Vendor</Label>
            <Input
              list="vendor-list"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Vendor name"
            />
            <datalist id="vendor-list">
              {vendors.data?.map((v) => <option key={v.id} value={v.name} />)}
            </datalist>
          </div>
          <div>
            <Label>Part number</Label>
            <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Qty ordered</Label>
            <Input
              type="number"
              min={1}
              value={qtyOrdered}
              onChange={(e) => setQtyOrdered(Number(e.target.value) || 1)}
            />
          </div>
        </div>
        <Button
          className="mt-3"
          disabled={!poNumber || !partNumber || addLine.isPending}
          onClick={async () => {
            let vendorId: string | undefined;
            if (vendorName) {
              const vendor = await addVendor.mutateAsync({ name: vendorName });
              vendorId = vendor.id;
            }
            addLine.mutate({
              salesOrderId: order.data!.id,
              poNumber,
              partNumber,
              description: description || undefined,
              qtyOrdered,
              vendorId,
            });
          }}
        >
          Add line
        </Button>
      </section>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <OrderDetailContent />
    </RequireAuth>
  );
}
