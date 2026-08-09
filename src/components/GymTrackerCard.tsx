"use client";

import { useState } from "react";
import type { GymSession } from "@/lib/gymTracker";
import { getExerciseHistory, getLoggedExerciseNames } from "@/lib/gymTracker";
import Card from "@/components/Card";
import TrendChart from "@/components/TrendChart";

function formatDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatWeight(n: number): string {
  return `${n}kg`;
}

function AttendedBadge({ attended }: { attended: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
        attended ? "bg-accent/15 text-accent" : "bg-surface-2 text-ink-3"
      }`}
    >
      {attended ? "Went" : "Skipped"}
    </span>
  );
}

function exerciseLine(log: GymSession["exercises"][number]): string {
  const parts: string[] = [];
  if (log.sets != null && log.reps != null) parts.push(`${log.sets}x${log.reps}`);
  else if (log.sets != null) parts.push(`${log.sets} sets`);
  else if (log.reps != null) parts.push(`${log.reps} reps`);
  if (log.weight_kg != null) parts.push(`@ ${formatWeight(log.weight_kg)}`);
  return parts.length > 0 ? `${log.exercise_name} — ${parts.join(" ")}` : log.exercise_name;
}

function watchSummary(session: GymSession): string | null {
  if (session.watchWorkouts.length === 0) return null;
  return session.watchWorkouts
    .map((w) => {
      const parts = [`${w.name} · ${Math.round(w.durationMinutes)} min`];
      if (w.activeEnergyKcal != null) parts.push(`${Math.round(w.activeEnergyKcal)} kcal`);
      return parts.join(" · ");
    })
    .join(", ");
}

function SessionRow({ session }: { session: GymSession }) {
  const watch = watchSummary(session);
  return (
    <li className="rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-ink-3">{formatDay(session.session_date)}</span>
        <span className="text-sm font-medium text-ink-0">{session.day_label}</span>
        <AttendedBadge attended={session.attended} />
      </div>
      {watch && <p className="mt-1 font-mono text-[10px] text-ink-3">{watch}</p>}
      {session.exercises.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {session.exercises.map((log) => (
            <li key={log.id} className="text-xs text-ink-1">
              {exerciseLine(log)}
            </li>
          ))}
        </ul>
      )}
      {session.notes && <p className="mt-1 text-xs text-ink-2">{session.notes}</p>}
    </li>
  );
}

function ProgressChart({ sessions }: { sessions: GymSession[] }) {
  const exerciseNames = getLoggedExerciseNames(sessions);
  const [selected, setSelected] = useState<string>(exerciseNames[0] ?? "");
  if (exerciseNames.length === 0) return null;

  const history = getExerciseHistory(sessions, selected);

  return (
    <div className="rounded-xl border border-border/60 bg-surface-2/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-2">Progress</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-xs text-ink-1"
        >
          {exerciseNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {history.length < 2 ? (
        <p className="text-xs text-ink-3">Log weight for {selected} on another day to see a trend.</p>
      ) : (
        <TrendChart data={history} formatValue={formatWeight} />
      )}
    </div>
  );
}

export default function GymTrackerCard({ sessions }: { sessions: GymSession[] }) {
  return (
    <Card title="Gym Tracker" count={sessions.length}>
      {sessions.length === 0 ? (
        <p className="text-sm text-ink-3">Tell Jarvis about a workout -- went or skipped, what you did -- to get started.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ProgressChart sessions={sessions} />
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
