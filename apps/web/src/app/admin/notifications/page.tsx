"use client";

import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@receivingX/ui/components/table";
import { useQuery } from "@tanstack/react-query";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function NotificationsContent() {
  const notifications = useQuery(trpc.notifications.list.queryOptions());

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Notifications</h1>
      <div className="mt-4 border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.data?.map((n) => (
              <TableRow key={n.id}>
                <TableCell>{new Date(n.createdAt).toLocaleString()}</TableCell>
                <TableCell>{n.session.location.name}</TableCell>
                <TableCell className="max-w-xs truncate">{n.toEmails.join(", ")}</TableCell>
                <TableCell className="max-w-xs truncate">{n.subject}</TableCell>
                <TableCell>
                  <StatusBadge status={n.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth roles={["admin", "accounting"]}>
      <NotificationsContent />
    </RequireAuth>
  );
}
