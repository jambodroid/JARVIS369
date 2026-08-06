"use client";

import { useEffect, useRef } from "react";

// A radar-dial HUD orb: a slowly rotating tick-mark ring (always alive),
// a reactive mid ring, and a glowing core — both driven in real time by
// actual microphone volume via the Web Audio API.
export default function JarvisOrb({ stream }: { stream: MediaStream | null }) {
  const coreRef = useRef<HTMLDivElement>(null);
  const midRingRef = useRef<SVGCircleElement>(null);
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

      if (coreRef.current) {
        coreRef.current.style.transform = `scale(${1 + level * 0.35})`;
        coreRef.current.style.opacity = String(0.6 + level * 0.4);
      }
      if (midRingRef.current) {
        midRingRef.current.setAttribute("stroke-width", String(1.5 + level * 3));
        midRingRef.current.style.filter = `drop-shadow(0 0 ${4 + level * 14}px oklch(0.82 0.15 195 / ${(0.4 + level * 0.5).toFixed(2)}))`;
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
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-[spin_18s_linear_infinite]">
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * 10 * Math.PI) / 180;
            const long = i % 3 === 0;
            const r1 = long ? 40 : 43;
            const r2 = 47;
            const x1 = 50 + r1 * Math.cos(angle);
            const y1 = 50 + r1 * Math.sin(angle);
            const x2 = 50 + r2 * Math.cos(angle);
            const y2 = 50 + r2 * Math.sin(angle);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--accent)"
                strokeWidth={long ? 1.2 : 0.6}
                opacity={0.5}
              />
            );
          })}
        </svg>

        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <circle
            ref={midRingRef}
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            opacity="0.8"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            ref={coreRef}
            className="h-10 w-10 rounded-full bg-accent transition-transform duration-75 ease-out"
            style={{ boxShadow: "0 0 24px 6px oklch(0.82 0.15 195 / 0.5)" }}
          />
        </div>
      </div>
    </div>
  );
}
