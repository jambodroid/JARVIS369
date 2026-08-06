"use client";

import { useEffect, useRef } from "react";

// Reads live microphone volume via the Web Audio API and drives the orb's
// scale/glow in real time — it visibly reacts as you talk, not a canned loop.
export default function JarvisOrb({ stream }: { stream: MediaStream | null }) {
  const orbRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!stream) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (const v of data) sum += v;
      const level = Math.min(1, sum / data.length / 90);

      if (orbRef.current) {
        const scale = 1 + level * 0.6;
        orbRef.current.style.transform = `scale(${scale})`;
        orbRef.current.style.boxShadow = `0 0 ${20 + level * 70}px ${8 + level * 24}px oklch(0.72 0.15 250 / ${(0.3 + level * 0.5).toFixed(2)})`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      void audioContext.close();
    };
  }, [stream]);

  return (
    <div className="flex items-center justify-center py-6">
      <div
        ref={orbRef}
        className="h-16 w-16 rounded-full bg-accent transition-transform duration-75 ease-out"
        style={{ boxShadow: "0 0 20px 8px oklch(0.72 0.15 250 / 0.3)" }}
      />
    </div>
  );
}
