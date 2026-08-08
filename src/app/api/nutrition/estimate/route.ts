import { NextRequest, NextResponse } from "next/server";
import { estimateNutrition } from "@/lib/nutrition";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { description?: string } | null;
  const description = body?.description?.trim();

  if (!description) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const estimate = await estimateNutrition(description);
  return NextResponse.json(estimate);
}
