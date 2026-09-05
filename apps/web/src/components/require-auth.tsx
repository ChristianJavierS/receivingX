"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";

/** Wrap a client page's contents to redirect to /login when unauthenticated. */
export function RequireAuth({
  roles,
  children,
}: {
  roles?: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (roles && role && !roles.includes(role) && role !== "admin") {
      router.replace("/");
    }
  }, [isPending, session, role, roles, router]);

  if (isPending || !session) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }
  if (roles && role && !roles.includes(role) && role !== "admin") {
    return <div className="p-6 text-sm text-muted-foreground">You don't have access to this page.</div>;
  }

  return <>{children}</>;
}
