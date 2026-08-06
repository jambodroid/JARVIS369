import { NextRequest, NextResponse } from "next/server";
import { completeTask } from "@/lib/taskActions";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { completed?: boolean } | null;
  const completed = body?.completed ?? true;

  const task = await completeTask(id, completed);
  return NextResponse.json(task);
}
