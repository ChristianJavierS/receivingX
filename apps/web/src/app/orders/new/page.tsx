"use client";

import { Button } from "@receivingX/ui/components/button";
import { Input } from "@receivingX/ui/components/input";
import { Label } from "@receivingX/ui/components/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function NewOrderContent() {
  const router = useRouter();
  const customers = useQuery(trpc.customers.list.queryOptions());
  const defaultLocation = useQuery(trpc.locations.default.queryOptions());

  const [soNumber, setSoNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));

  const createCustomer = useMutation(trpc.customers.create.mutationOptions());
  const createOrder = useMutation(
    trpc.orders.create.mutationOptions({
      onSuccess: (order) => {
        toast.success("Order created");
        router.push(`/orders/${order.id}`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const existingCustomer = customers.data?.find((c) => c.name.toLowerCase() === customerName.toLowerCase());

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-display text-xl font-semibold">New sales order</h1>
      <div className="mt-4 space-y-4">
        <div>
          <Label>SO number</Label>
          <Input value={soNumber} onChange={(e) => setSoNumber(e.target.value)} />
        </div>
        <div>
          <Label>Customer</Label>
          <Input
            list="customer-list"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Type existing or new customer name"
          />
          <datalist id="customer-list">
            {customers.data?.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
        </div>
        <div>
          <Label>Order date</Label>
          <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </div>
      </div>
      <Button
        className="mt-6 w-full"
        disabled={!soNumber || !customerName || !defaultLocation.data || createOrder.isPending}
        onClick={async () => {
          const customerId = existingCustomer
            ? existingCustomer.id
            : (await createCustomer.mutateAsync({ name: customerName })).id;
          createOrder.mutate({
            soNumber,
            customerId,
            orderDate: new Date(orderDate),
            locationId: defaultLocation.data!.id,
          });
        }}
      >
        {createOrder.isPending ? "Creating..." : "Create order"}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Add line items (PO, PN, qty) from the order page after creating it.
      </p>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <RequireAuth roles={["sales"]}>
      <NewOrderContent />
    </RequireAuth>
  );
}
