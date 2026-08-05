"use client";

import { useRouter } from "next/navigation";
import type { Task } from "@/lib/tasks";
import TaskRow from "@/components/TaskRow";
import AddTaskForm from "@/components/AddTaskForm";
import Card from "@/components/Card";

function Section({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <Card title={title} count={tasks.length}>
      {tasks.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function TaskBoard({ today, week }: { today: Task[]; week: Task[] }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-sm font-semibold uppercase tracking-widest text-ink-0">Tasks</h1>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-ink-3 transition-colors hover:text-ink-1"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-5 sm:px-6">
        <AddTaskForm />
        <Section title="Today" tasks={today} />
        <Section title="This Week" tasks={week} />
      </main>
    </div>
  );
}
