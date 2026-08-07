import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";
import type { Category } from "@/lib/colors";

export type Priority = "low" | "med" | "high";

export type Task = {
  id: string;
  title: string;
  due_date: string | null; // YYYY-MM-DD, null = "this week, unscheduled"
  due_time: string | null; // HH:MM:SS, null = no specific time
  priority: Priority;
  category: Category;
  completed_at: string | null;
  google_event_id: string | null;
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
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("tasks").select("*").is("completed_at", null);

    if (error) throw new Error(error.message);
    return (data ?? []) as Task[];
  });
}

export async function getCompletedTasks(): Promise<Task[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return (data ?? []) as Task[];
  });
}

function byPriority(a: Task, b: Task): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

function byTimeThenPriority(a: Task, b: Task): number {
  if (a.due_time !== b.due_time) {
    if (a.due_time === null) return 1;
    if (b.due_time === null) return -1;
    return a.due_time < b.due_time ? -1 : 1;
  }
  return byPriority(a, b);
}

function byDateThenPriority(a: Task, b: Task): number {
  if (a.due_date !== b.due_date) {
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return byPriority(a, b);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Task | null;
}

export async function insertTaskRow(input: {
  title: string;
  due_date: string | null;
  due_time: string | null;
  priority: Priority;
  category: Category;
}): Promise<Task> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("tasks").insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as Task;
}

export async function setTaskGoogleEventId(id: string, googleEventId: string): Promise<Task> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ google_event_id: googleEventId })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Task;
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<Task> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Task;
}

export async function deleteTaskRow(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateTaskDateTime(
  id: string,
  due_date: string | null,
  due_time: string | null,
): Promise<Task> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ due_date, due_time })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Task;
}

// "Today" includes anything due today or overdue, so nothing silently slips,
// sorted by time-of-day then priority.
// "This Week" is the next 7 days after today, plus any task with no due_date
// at all (brain-dumped, no specific day), sorted by date then priority.
export function splitTasksByWindow(tasks: Task[]): { today: Task[]; week: Task[] } {
  const todayKey = localDateKey(new Date());
  const weekEndKey = localDateKey(addDays(new Date(), 7));

  const today: Task[] = [];
  const week: Task[] = [];

  for (const task of tasks) {
    if (task.due_date === null) {
      week.push(task);
    } else if (task.due_date <= todayKey) {
      today.push(task);
    } else if (task.due_date <= weekEndKey) {
      week.push(task);
    }
  }

  today.sort(byTimeThenPriority);
  week.sort(byDateThenPriority);

  return { today, week };
}
