import type { ReactNode } from "react";

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
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-2">{title}</h2>
          {typeof count === "number" && <span className="text-xs text-ink-3">{count}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
