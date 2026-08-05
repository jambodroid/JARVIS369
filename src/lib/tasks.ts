import { getSupabaseClient } from "@/lib/supabase";

export type Priority = "low" | "med" | "high";

export type Task = {
  id: string;
  title: string;
  due_date: string; // YYYY-MM-DD
  priority: Priority;
  completed_at: string | null;
  created_at: string;
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export async function getOpenTasks(): Promise<Task[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .is("completed_at", null)
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);

  const tasks = (data ?? []) as Task[];
  tasks.sort((a, b) => {
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
  return tasks;
}

// "Today" includes anything due today or overdue, so nothing silently slips.
// "This Week" is the next 7 days after today.
export function splitTasksByWindow(tasks: Task[]): { today: Task[]; week: Task[] } {
  const todayKey = localDateKey(new Date());
  const weekEndKey = localDateKey(addDays(new Date(), 7));

  const today: Task[] = [];
  const week: Task[] = [];

  for (const task of tasks) {
    if (task.due_date <= todayKey) {
      today.push(task);
    } else if (task.due_date <= weekEndKey) {
      week.push(task);
    }
  }

  return { today, week };
}
