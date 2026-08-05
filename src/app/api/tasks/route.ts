import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

const VALID_PRIORITIES = new Set(["low", "med", "high"]);

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    due_date?: string;
    priority?: string;
  } | null;

  const title = body?.title?.trim();
  const due_date = body?.due_date;
  const priority = body?.priority ?? "med";

  if (!title || !due_date || !VALID_PRIORITIES.has(priority)) {
    return NextResponse.json({ error: "title, due_date, and a valid priority are required" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ title, due_date, priority })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
