"use client";

import { StatBand } from "@receivingX/ui/components/stat-band";
import { StatusBadge } from "@receivingX/ui/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/utils/trpc";

function DashboardContent() {
  const stats = useQuery(trpc.reports.dashboardStats.queryOptions());
  const sessions = useQuery(trpc.receiving.session.list.queryOptions());

  return (
    <div className="flex flex-col">
      <div className="bg-navy-900 px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-white/70">
            Receive packages, match them to open sales orders, and notify the team.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/receive"
              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-cyan-500/90"
            >
              Start receiving
            </Link>
            <Link
              href="/orders"
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              View orders
            </Link>
          </div>
        </div>
      </div>

      <StatBand
        stats={[
          { label: "Received today", value: stats.data?.receivedToday ?? "-" },
          { label: "Open orders", value: stats.data?.openOrders ?? "-" },
          { label: "Awaiting review", value: stats.data?.needsReview ?? "-" },
          { label: "Boxes this month", value: stats.data?.receivedThisMonth ?? "-" },
        ]}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h2 className="font-display text-lg font-semibold">Recent sessions</h2>
        <div className="mt-4 divide-y divide-border border border-border">
          {sessions.data?.length ? (
            sessions.data.slice(0, 8).map((s) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-muted"
              >
                <div>
                  <div className="font-medium">{s.location.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.receiver.name} - {new Date(s.startedAt).toLocaleString()} - {s._count.packages} package(s)
                  </div>
                </div>
                <StatusBadge status={s.status} />
              </Link>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-muted-foreground">No sessions yet. Start receiving to see them here.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
