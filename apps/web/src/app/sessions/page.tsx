"use client";

import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function SessionsContent() {
  const sessions = useQuery(trpc.receiving.session.list.queryOptions());

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Receiving sessions</h1>
      <div className="mt-4 divide-y divide-border border border-border">
        {sessions.data?.map((s) => (
          <Link key={s.id} href={`/sessions/${s.id}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-muted">
            <div>
              <div className="font-medium">{s.location.name}</div>
              <div className="text-xs text-muted-foreground">
                {s.receiver.name} - {new Date(s.startedAt).toLocaleString()} - {s._count.packages} package(s)
              </div>
            </div>
            <StatusBadge status={s.status} />
          </Link>
        ))}
        {sessions.data?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No sessions yet.</div>
        )}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <RequireAuth>
      <SessionsContent />
    </RequireAuth>
  );
}
