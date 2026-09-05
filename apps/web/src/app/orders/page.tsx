"use client";

import { Button } from "@receivingX/ui/components/button";
import { Input } from "@receivingX/ui/components/input";
import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@receivingX/ui/components/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function OrdersContent() {
  const [search, setSearch] = useState("");
  const orders = useQuery(trpc.orders.list.queryOptions({ search: search || undefined }));
  const queryClient = useQueryClient();

  async function exportCsv() {
    const csv = await queryClient.fetchQuery(trpc.reports.exportCsv.queryOptions());
    const blob = new Blob([csv.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receivingx-stock.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold">Sales orders</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
          <Link href="/orders/import">
            <Button variant="outline">Import spreadsheet</Button>
          </Link>
          <Link href="/orders/new">
            <Button>New order</Button>
          </Link>
        </div>
      </div>

      <Input
        className="mt-4 max-w-sm"
        placeholder="Search by SO#, customer, PO, or PN"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-4 border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SO#</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order date</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.data?.map((order) => (
              <TableRow key={order.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`/orders/${order.id}`} className="font-data font-medium hover:underline">
                    {order.soNumber}
                  </Link>
                </TableCell>
                <TableCell>{order.customer.name}</TableCell>
                <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                <TableCell>{order.lines.length}</TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {orders.data?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No orders found.</div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersContent />
    </RequireAuth>
  );
}
