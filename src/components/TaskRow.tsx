"use client";

import { useState } from "react";
import type { Priority, Task } from "@/lib/tasks";
import { useRouter } from "next/navigation";

const PRIORITY_CHIP: Record<Priority, string> = {
  high: "bg-danger/15 text-danger",
  med: "bg-warn/15 text-warn",
  low: "bg-ok/15 text-ok",
};

export default function TaskRow({ task }: { task: Task }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    router.refresh();
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2.5 transition-colors hover:bg-surface-2">
      <input
        type="checkbox"
        checked={false}
        disabled={pending}
        onChange={handleToggle}
        className="h-5 w-5 shrink-0 accent-accent"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink-0">{task.title}</p>
        <p className="text-xs text-ink-3">{task.due_date}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_CHIP[task.priority]}`}
      >
        {task.priority}
      </span>
    </li>
  );
}
