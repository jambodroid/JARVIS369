import type { ReactNode } from "react";

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const edge =
    position === "tl"
      ? "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg"
      : position === "tr"
        ? "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg"
        : position === "bl"
          ? "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg"
          : "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg";
  return <span className={`pointer-events-none absolute h-3 w-3 border-accent/70 ${edge}`} />;
}

export default function Card({
  title,
  count,
  children,
}: {
  title?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-border bg-surface p-4 shadow-hud sm:p-5">
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-2">{title}</h2>
          {typeof count === "number" && <span className="font-mono text-xs text-ink-3">{count}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
