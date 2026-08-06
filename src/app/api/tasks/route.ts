import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/colors";
import { upsertTaskEvent } from "@/lib/google";
import type { Task } from "@/lib/tasks";

const VALID_PRIORITIES = new Set<string>(["low", "med", "high"]);
const VALID_CATEGORIES = new Set<string>(CATEGORIES);

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    due_date?: string | null;
    due_time?: string | null;
    priority?: string;
    category?: string;
    time_zone?: string;
  } | null;

  const title = body?.title?.trim();
  const due_date = body?.due_date || null;
  const due_time = body?.due_time || null;
  const priority = body?.priority ?? "med";
  const category = body?.category ?? "general";

  if (!title || !VALID_PRIORITIES.has(priority) || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json(
      { error: "title, a valid priority, and a valid category are required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ title, due_date, due_time, priority, category })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let task = data as Task;

  if (task.due_date && task.due_time) {
    try {
      const eventId = await upsertTaskEvent(task, body?.time_zone || "UTC");
      const { data: updated, error: updateError } = await supabase
        .from("tasks")
        .update({ google_event_id: eventId })
        .eq("id", task.id)
        .select()
        .single();
      if (!updateError && updated) task = updated as Task;
    } catch (calendarError) {
      // Task is already saved; calendar sync failing shouldn't lose the task.
      console.error("Failed to sync task to Google Calendar", calendarError);
    }
  }

  return NextResponse.json(task, { status: 201 });
}
