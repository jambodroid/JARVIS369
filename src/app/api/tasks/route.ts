import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/colors";
import { createTask } from "@/lib/taskActions";

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

  const task = await createTask(
    {
      title,
      due_date,
      due_time,
      priority: priority as "low" | "med" | "high",
      category: category as (typeof CATEGORIES)[number],
    },
    body?.time_zone || "UTC",
  );

  return NextResponse.json(task, { status: 201 });
}
