import { cn } from "cn"

/**
 * The navy-pill "stamp" motif from docs/DESIGN.md - status is always a word,
 * never color alone.
 */
const STATUS_STYLES: Record<string, string> = {
  MATCHED: "bg-cyan-100 text-navy-900 border border-cyan-500/40",
  NEEDS_REVIEW: "bg-gold-500/15 text-black-950 border border-gold-500/60",
  CHECKED_IN: "bg-success/10 text-success border border-success/40",
  UNMATCHED: "bg-transparent text-gold-500 border border-gold-500",
  VOIDED: "bg-muted text-muted-foreground border border-border",
  PENDING_OCR: "bg-muted text-muted-foreground border border-border",
  OPEN: "bg-muted text-foreground border border-border",
  PARTIAL: "bg-gold-500/15 text-black-950 border border-gold-500/60",
  RECEIVED: "bg-success/10 text-success border border-success/40",
  CLOSED: "bg-muted text-muted-foreground border border-border",
  CANCELLED: "bg-muted text-muted-foreground border border-border",
  SENT: "bg-success/10 text-success border border-success/40",
  FAILED: "bg-destructive/10 text-destructive border border-destructive/40",
  QUEUED: "bg-muted text-muted-foreground border border-border",
  DRAFT: "bg-muted text-foreground border border-border",
  FINALIZING: "bg-gold-500/15 text-black-950 border border-gold-500/60",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border border-border",
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
