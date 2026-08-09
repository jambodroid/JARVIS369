import { NextRequest, NextResponse } from "next/server";
import { completeTask, editTask } from "@/lib/taskActions";
import type { Priority } from "@/lib/tasks";
import type { Category } from "@/lib/colors";

type PatchBody = {
  completed?: boolean;
  title?: string;
  category?: Category;
  priority?: Priority;
  due_date?: string | null;
  due_time?: string | null;
  time_zone?: string;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as PatchBody | null;

  // A completed-only body is the checkbox toggle -- everything else is a
  // full edit from the task list's edit form.
  if (body && Object.keys(body).every((key) => key === "completed")) {
    const task = await completeTask(id, body.completed ?? true);
    return NextResponse.json(task);
  }

  const task = await editTask(
    id,
    {
      title: body?.title,
      category: body?.category,
      priority: body?.priority,
      due_date: body?.due_date,
      due_time: body?.due_time,
    },
    body?.time_zone || "Europe/London",
  );
  return NextResponse.json(task);
}
