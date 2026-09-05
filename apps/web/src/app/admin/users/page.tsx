"use client";

import { Button } from "@receivingX/ui/components/button";
import { Input } from "@receivingX/ui/components/input";
import { Label } from "@receivingX/ui/components/label";
import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@receivingX/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

const ROLES = ["admin", "receiver", "sales", "accounting"] as const;

function UsersContent() {
  const queryClient = useQueryClient();
  const users = useQuery(trpc.users.list.queryOptions());
  const locations = useQuery(trpc.locations.list.queryOptions());

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("receiver");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.users.list.queryKey() });

  const create = useMutation(
    trpc.users.create.mutationOptions({
      onSuccess: () => {
        toast.success("User created");
        setName("");
        setEmail("");
        setPassword("");
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const update = useMutation(trpc.users.update.mutationOptions({ onSuccess: invalidate }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Users</h1>

      <div className="mt-4 border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <select
                    className="border border-border bg-transparent px-2 py-1 text-xs"
                    value={u.role ?? "receiver"}
                    onChange={(e) => update.mutate({ id: u.id, role: e.target.value as (typeof ROLES)[number] })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    className="border border-border bg-transparent px-2 py-1 text-xs"
                    value={u.locationId ?? ""}
                    onChange={(e) => update.mutate({ id: u.id, locationId: e.target.value || null })}
                  >
                    <option value="">-</option>
                    {locations.data?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <StatusBadge status={u.active ? "CHECKED_IN" : "VOIDED"} />
                  <button
                    className="ml-2 text-xs underline"
                    onClick={() => update.mutate({ id: u.id, active: !u.active })}
                  >
                    {u.active ? "deactivate" : "activate"}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section className="mt-6 border border-border p-4">
        <h2 className="text-sm font-semibold">Add a user</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Temporary password</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label>Role</Label>
            <select
              className="h-8 w-full border border-border bg-transparent px-2 text-xs"
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          className="mt-3"
          disabled={!name || !email || password.length < 8 || create.isPending}
          onClick={() => create.mutate({ name, email, password, role })}
        >
          Create user
        </Button>
      </section>
    </div>
  );
}

export default function UsersPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <UsersContent />
    </RequireAuth>
  );
}
