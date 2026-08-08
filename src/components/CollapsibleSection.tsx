"use client";

import { useState, type ReactNode } from "react";

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  preview,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  // Rendered inside the header button when collapsed, for an at-a-glance
  // summary. Must be non-interactive (no nested buttons/links) -- it lives
  // inside the header's own toggle button.
  preview?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-left shadow-hud"
      >
        <span className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-0">{title}</span>
          <span className="text-xs text-ink-3">{open ? "Hide" : "Show"}</span>
        </span>
        {!open && preview}
      </button>

      {open && <div className="flex flex-col gap-4">{children}</div>}
    </div>
  );
}
