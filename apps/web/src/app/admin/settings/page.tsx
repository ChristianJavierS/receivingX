"use client";

import { Button } from "@receivingX/ui/components/button";
import { Input } from "@receivingX/ui/components/input";
import { Label } from "@receivingX/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function SettingsContent() {
  const queryClient = useQueryClient();
  const locations = useQuery(trpc.locations.list.queryOptions());

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [receivingEmail, setReceivingEmail] = useState("");
  const [accountingEmails, setAccountingEmails] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.locations.list.queryKey() });
  const create = useMutation(
    trpc.locations.create.mutationOptions({
      onSuccess: () => {
        toast.success("Location created");
        setName("");
        setCode("");
        setReceivingEmail("");
        setAccountingEmails("");
        invalidate();
      },
    }),
  );
  const update = useMutation(trpc.locations.update.mutationOptions({ onSuccess: invalidate }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Locations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Notification recipients (receiving + accounting) are set per location.
      </p>

      <div className="mt-4 space-y-3">
        {locations.data?.map((loc) => (
          <div key={loc.id} className="border border-border p-4">
            <div className="font-medium">
              {loc.name} <span className="font-data text-xs text-muted-foreground">({loc.code})</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <Label>Receiving email</Label>
                <Input
                  defaultValue={loc.receivingEmail ?? ""}
                  onBlur={(e) => update.mutate({ id: loc.id, receivingEmail: e.target.value })}
                />
              </div>
              <div>
                <Label>Accounting emails (comma separated)</Label>
                <Input
                  defaultValue={loc.accountingEmails.join(", ")}
                  onBlur={(e) =>
                    update.mutate({
                      id: loc.id,
                      accountingEmails: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-6 border border-border p-4">
        <h2 className="text-sm font-semibold">Add a location</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <Label>Receiving email</Label>
            <Input value={receivingEmail} onChange={(e) => setReceivingEmail(e.target.value)} />
          </div>
          <div>
            <Label>Accounting emails</Label>
            <Input value={accountingEmails} onChange={(e) => setAccountingEmails(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-3"
          disabled={!name || !code || create.isPending}
          onClick={() =>
            create.mutate({
              name,
              code,
              receivingEmail: receivingEmail || undefined,
              accountingEmails: accountingEmails
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        >
          Add location
        </Button>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <SettingsContent />
    </RequireAuth>
  );
}
