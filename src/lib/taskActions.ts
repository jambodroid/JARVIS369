import {
  getTaskById,
  insertTaskRow,
  setTaskCompleted,
  setTaskGoogleEventId,
  updateTaskDateTime,
  type Priority,
  type Task,
} from "@/lib/tasks";
import type { Category } from "@/lib/colors";
import { upsertTaskEvent } from "@/lib/google";

async function syncCalendarIfTimed(task: Task, timeZone: string): Promise<Task> {
  if (!task.due_date || !task.due_time) return task;
  try {
    const eventId = await upsertTaskEvent(task, timeZone);
    return await setTaskGoogleEventId(task.id, eventId);
  } catch (error) {
    // Task/reschedule already saved; calendar sync failing shouldn't lose it.
    console.error("Failed to sync task to Google Calendar", error);
    return task;
  }
}

export async function createTask(
  input: {
    title: string;
    due_date: string | null;
    due_time: string | null;
    priority: Priority;
    category: Category;
  },
  timeZone: string,
): Promise<Task> {
  const task = await insertTaskRow(input);
  return syncCalendarIfTimed(task, timeZone);
}

export async function completeTask(id: string, completed: boolean): Promise<Task> {
  return setTaskCompleted(id, completed);
}

export async function rescheduleTask(
  id: string,
  due_date: string | null,
  due_time: string | null,
  timeZone: string,
): Promise<Task> {
  const task = await updateTaskDateTime(id, due_date, due_time);
  return syncCalendarIfTimed(task, timeZone);
}

export { getTaskById };
