"use client";

import { useState } from "react";
import type { Priority, Task } from "@/lib/tasks";
import { CATEGORIES, CATEGORY_LABEL, COLOR_CHIP_CLASS, COLOR_DOT_CLASS, resolveColor, type Category } from "@/lib/colors";
import { useRouter } from "next/navigation";

const PRIORITIES: Priority[] = ["high", "med", "low"];
const PRIORITY_LABEL: Record<Priority, string> = { high: "High", med: "Medium", low: "Low" };

function formatMeta(task: Task): string | null {
  if (task.due_time) return task.due_time.slice(0, 5);
  if (task.due_date) return task.due_date;
  return null;
}

function EditForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState<Category>(task.category);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [dueTime, setDueTime] = useState(task.due_time?.slice(0, 5) ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        category,
        priority,
        due_date: dueDate || null,
        due_time: dueTime || null,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    setSaving(false);
    router.refresh();
    onDone();
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-ink-0"
        placeholder="Task title"
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-xs text-ink-1"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-xs text-ink-1"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-xs text-ink-1"
        />
        <input
          type="time"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-xs text-ink-1"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || title.trim().length === 0}
          className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onDone}
          disabled={saving}
          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-3 transition-colors hover:text-ink-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function TaskRow({ task, completed = false }: { task: Task; completed?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);

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

  if (editing) {
    return (
      <li className="flex items-start gap-3 rounded-xl border border-accent/40 bg-surface-2/60 px-3 py-2.5">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${COLOR_DOT_CLASS[color]}`} />
        <EditForm task={task} onDone={() => setEditing(false)} />
      </li>
    );
  }

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
      <button
        onClick={() => setEditing(true)}
        className="min-w-0 flex-1 text-left"
      >
        <p className={`truncate text-sm ${completed ? "text-ink-3 line-through" : "text-ink-0"}`}>
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {meta && <span className="font-mono text-xs text-ink-3">{meta}</span>}
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${COLOR_CHIP_CLASS[color]}`}>
            {CATEGORY_LABEL[task.category]}
          </span>
        </div>
      </button>
    </li>
  );
}
