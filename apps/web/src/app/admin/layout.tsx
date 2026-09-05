"use client";

import { cn } from "@receivingX/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Locations" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/health", label: "Health" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-4xl gap-1 px-4 py-2 text-sm">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href as never}
              className={cn(
                "rounded-full px-3 py-1.5",
                pathname === tab.href ? "bg-navy-900 text-white" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
