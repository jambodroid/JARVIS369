"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { localDateKey } from "@/lib/tasks";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/colors";

const fieldClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-accent";

export default function AddTaskForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [noSpecificDay, setNoSpecificDay] = useState(false);
  const [dueDate, setDueDate] = useState(() => localDateKey(new Date()));
  const [dueTime, setDueTime] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [priority, setPriority] = useState<"low" | "med" | "high">("med");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        due_date: noSpecificDay ? null : dueDate,
        due_time: noSpecificDay ? null : dueTime || null,
        priority,
        category,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    setTitle("");
    setNoSpecificDay(false);
    setDueDate(localDateKey(new Date()));
    setDueTime("");
    setCategory("general");
    setPriority("med");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:p-5"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task"
        className={fieldClass}
      />

      <label className="flex items-center gap-2 text-xs text-ink-2">
        <input
          type="checkbox"
          checked={noSpecificDay}
          onChange={(e) => setNoSpecificDay(e.target.checked)}
          className="accent-accent"
        />
        No specific day (goes on this week&apos;s list)
      </label>

      {!noSpecificDay && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`${fieldClass} flex-1`}
          />
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            className={`${fieldClass} flex-1`}
            aria-label="Time (optional, creates a calendar event)"
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className={`${fieldClass} flex-1`}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "med" | "high")}
          className={`${fieldClass} flex-1`}
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
      </div>
    </form>
  );
}
