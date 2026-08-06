"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import JarvisOrb from "@/components/JarvisOrb";
import Card from "@/components/Card";

type DisplayMessage = { role: "user" | "assistant"; text: string };

export default function JarvisPanel() {
  const router = useRouter();
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const apiMessagesRef = useRef<MessageParam[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [displayMessages, sending, transcribing]);

  async function sendMessage(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setDisplayMessages((prev) => [...prev, { role: "user", text }]);
    apiMessagesRef.current = [...apiMessagesRef.current, { role: "user", content: text }];

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: apiMessagesRef.current,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    setSending(false);

    if (!res.ok) {
      setDisplayMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong. Try again." }]);
      return;
    }

    const data = (await res.json()) as { reply: string; messages: MessageParam[]; mutated: boolean };
    apiMessagesRef.current = data.messages;
    setDisplayMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);

    if (data.mutated) {
      router.refresh();
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
  }

  async function handleRecordingStop(stream: MediaStream) {
    stream.getTracks().forEach((t) => t.stop());
    setMicStream(null);

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size === 0) return;

    setTranscribing(true);
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");

    const res = await fetch("/api/transcribe", { method: "POST", body: formData });
    setTranscribing(false);

    if (!res.ok) {
      setDisplayMessages((prev) => [...prev, { role: "assistant", text: "Couldn't transcribe that. Try again." }]);
      return;
    }

    const data = (await res.json()) as { text: string };
    if (data.text?.trim()) {
      await sendMessage(data.text.trim());
    }
  }

  async function startRecording() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        void handleRecordingStop(stream);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setMicError("Couldn't access the microphone.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  const busy = sending || transcribing;

  return (
    <Card title="Jarvis">
      {displayMessages.length > 0 && (
        <div ref={scrollRef} className="mb-3 max-h-72 overflow-y-auto">
          <div className="flex flex-col gap-3">
            {displayMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-accent text-background" : "bg-surface-2 text-ink-0"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && <p className="text-xs text-ink-3">Thinking…</p>}
            {transcribing && <p className="text-xs text-ink-3">Transcribing…</p>}
          </div>
        </div>
      )}

      {recording && <JarvisOrb stream={micStream} />}
      {micError && <p className="mb-2 text-xs text-danger">{micError}</p>}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={busy}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-background disabled:opacity-50 ${
            recording ? "bg-danger" : "bg-accent"
          }`}
        >
          {recording ? "■" : "●"}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask or tell Jarvis something..."
          disabled={recording}
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-0 placeholder-ink-3 outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || recording || !input.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </Card>
  );
}
