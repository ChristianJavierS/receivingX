import { cn } from "cn"

export type Stat = { label: string; value: string | number };

/**
 * The black stat band lifted from the AM/PM marketing site's proof blocks
 * (docs/DESIGN.md 3) - repurposed here as an ops KPI strip.
 */
export function StatBand({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div data-slot="stat-band" className={cn("bg-black-950 text-white", className)}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-6 sm:grid-cols-4 sm:px-6">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="font-display text-3xl font-bold">{stat.value}</div>
            <div className="mt-1 text-xs text-white/60 uppercase tracking-wide">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
