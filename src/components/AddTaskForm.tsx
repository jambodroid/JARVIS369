"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { localDateKey } from "@/lib/tasks";

export default function AddTaskForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(() => localDateKey(new Date()));
  const [priority, setPriority] = useState<"low" | "med" | "high">("med");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), due_date: dueDate, priority }),
    });
    setTitle("");
    setDueDate(localDateKey(new Date()));
    setPriority("med");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:p-5"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task"
        className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-0 placeholder-ink-3 outline-none focus:border-accent"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-accent"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as "low" | "med" | "high")}
        className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-accent"
      >
        <option value="low">Low</option>
        <option value="med">Med</option>
        <option value="high">High</option>
      </select>
      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
