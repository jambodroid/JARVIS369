import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const text = body?.text;

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const openai = new OpenAI();
  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "onyx",
    input: text,
  });

  const audio = Buffer.from(await speech.arrayBuffer());
  return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg" } });
}
