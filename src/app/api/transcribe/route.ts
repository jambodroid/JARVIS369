import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("audio");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }

  const openai = new OpenAI();
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  return NextResponse.json({ text: transcription.text });
}
