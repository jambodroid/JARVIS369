"use client";

import { useState } from "react";
import type { Task } from "@/lib/tasks";
import { CATEGORY_LABEL, COLOR_CHIP_CLASS, COLOR_DOT_CLASS, resolveColor } from "@/lib/colors";
import { useRouter } from "next/navigation";

function formatMeta(task: Task): string | null {
  if (task.due_time) return task.due_time.slice(0, 5);
  if (task.due_date) return task.due_date;
  return null;
}

export default function TaskRow({ task, completed = false }: { task: Task; completed?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !completed }),
    });
    router.refresh();
  }

  const color = resolveColor(task.category, task.priority);
  const meta = formatMeta(task);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2.5 transition-colors hover:bg-surface-2">
      <input
        type="checkbox"
        checked={completed}
        disabled={pending}
        onChange={handleToggle}
        className="h-5 w-5 shrink-0 accent-accent"
      />
      <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT_CLASS[color]}`} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${completed ? "text-ink-3 line-through" : "text-ink-0"}`}>
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {meta && <span className="font-mono text-xs text-ink-3">{meta}</span>}
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${COLOR_CHIP_CLASS[color]}`}>
            {CATEGORY_LABEL[task.category]}
          </span>
        </div>
      </div>
    </li>
  );
}
