import { cn } from "cn"

type Tone = "navy" | "white" | "gray" | "black";

const TONE_CLASSES: Record<Tone, string> = {
  navy: "bg-navy-900 text-white",
  white: "bg-background text-foreground",
  gray: "bg-muted text-foreground",
  black: "bg-black-950 text-white",
};

/** Full-width alternating band, per docs/DESIGN.md 3 "Layout language". */
export function SectionBand({
  tone = "white",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(TONE_CLASSES[tone], className)}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </section>
  );
}
