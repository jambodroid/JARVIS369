import {
  deleteTaskRow,
  getTaskById,
  insertTaskRow,
  setTaskCompleted,
  setTaskGoogleEventId,
  updateTaskDateTime,
  type Priority,
  type Task,
} from "@/lib/tasks";
import type { Category } from "@/lib/colors";
import { deleteCalendarEvent, upsertTaskEvent } from "@/lib/google";

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

export async function deleteTask(id: string): Promise<void> {
  const task = await getTaskById(id);
  if (task?.google_event_id) {
    try {
      await deleteCalendarEvent(task.google_event_id);
    } catch (error) {
      // Task deletion should still go through even if Google's side fails --
      // an orphaned calendar event is recoverable, a stuck task isn't.
      console.error("Failed to delete Google Calendar event", error);
    }
  }
  await deleteTaskRow(id);
}

export { getTaskById };
