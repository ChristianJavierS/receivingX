"use client";
import { cn } from "@receivingX/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const links = [
    { to: "/", label: "Dashboard", show: true },
    { to: "/receive", label: "Receive", show: true },
    { to: "/orders", label: "Orders", show: role === "sales" || role === "admin" || role === "receiver" },
    { to: "/sessions", label: "Sessions", show: true },
    { to: "/admin/users", label: "Admin", show: role === "admin" },
  ].filter((l) => l.show);

  if (!session) return null;

  return (
    <div className="border-b border-border bg-navy-900">
      <div className="mx-auto flex max-w-6xl flex-row items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <Link href="/" className="font-display text-sm font-bold tracking-wide text-white">
          AM/PM <span className="font-normal text-white/60">Receiving</span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto text-sm">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              href={to as never}
              className={cn(
                "rounded-full px-3 py-1.5 whitespace-nowrap text-white/70 transition-colors hover:bg-white/10 hover:text-white",
                pathname === to && "bg-cyan-500/20 text-white",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </div>
  );
}
