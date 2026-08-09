import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";
import { getHealthMetrics, type WorkoutSummary } from "@/lib/healthMetrics";

export type ExerciseLog = {
  id: string;
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
};

export type GymSession = {
  id: string;
  session_date: string;
  day_label: string;
  attended: boolean;
  notes: string | null;
  exercises: ExerciseLog[];
  watchWorkouts: WorkoutSummary[];
};

type SessionRow = {
  id: string;
  session_date: string;
  day_label: string;
  attended: boolean;
  notes: string | null;
  gym_exercise_logs: ExerciseLog[];
};

function rowToSession(row: SessionRow, watchWorkouts: WorkoutSummary[]): GymSession {
  return {
    id: row.id,
    session_date: row.session_date,
    day_label: row.day_label,
    attended: row.attended,
    notes: row.notes,
    exercises: row.gym_exercise_logs ?? [],
    watchWorkouts,
  };
}

export async function getGymSessions(limit = 60): Promise<GymSession[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("gym_sessions")
      .select("*, gym_exercise_logs(*)")
      .order("session_date", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as SessionRow[];
    if (rows.length === 0) return [];

    const metrics = await getHealthMetrics(limit);
    const metricsByDate = new Map(metrics.map((m) => [m.metric_date, m.workouts ?? []]));

    return rows.map((row) => rowToSession(row, metricsByDate.get(row.session_date) ?? []));
  });
}

// Logs (or corrects, if re-told about the same day) a full session: attended
// or skipped, plus whatever exercises were done. Exercises are replaced
// wholesale for the date rather than appended, so re-telling Jarvis about a
// day corrects it instead of duplicating entries.
export async function logGymSession(input: {
  session_date: string;
  day_label: string;
  attended: boolean;
  notes?: string;
  exercises?: { exercise_name: string; sets?: number; reps?: number; weight_kg?: number }[];
}): Promise<GymSession> {
  const supabase = getSupabaseClient();

  const { data: session, error: sessionError } = await supabase
    .from("gym_sessions")
    .upsert(
      {
        session_date: input.session_date,
        day_label: input.day_label,
        attended: input.attended,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_date" },
    )
    .select()
    .single();
  if (sessionError) throw new Error(sessionError.message);

  const { error: deleteError } = await supabase.from("gym_exercise_logs").delete().eq("session_id", session.id);
  if (deleteError) throw new Error(deleteError.message);

  let exercises: ExerciseLog[] = [];
  if (input.exercises && input.exercises.length > 0) {
    const { data: logs, error: logsError } = await supabase
      .from("gym_exercise_logs")
      .insert(input.exercises.map((e) => ({ ...e, session_id: session.id })))
      .select();
    if (logsError) throw new Error(logsError.message);
    exercises = (logs ?? []) as ExerciseLog[];
  }

  const metrics = await getHealthMetrics(60);
  const watchWorkouts = metrics.find((m) => m.metric_date === input.session_date)?.workouts ?? [];

  return rowToSession({ ...session, gym_exercise_logs: exercises } as SessionRow, watchWorkouts);
}

export async function deleteGymSession(sessionDate: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("gym_sessions").delete().eq("session_date", sessionDate);
  if (error) throw new Error(error.message);
}

// Pure -- no Supabase call. Weight-over-time series for one exercise, for
// charting progress. Sessions are already newest-first; reverse to
// chronological order for a left-to-right chart.
export function getExerciseHistory(
  sessions: GymSession[],
  exerciseName: string,
): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  for (const session of sessions) {
    for (const log of session.exercises) {
      if (log.exercise_name === exerciseName && log.weight_kg != null) {
        points.push({ date: session.session_date, value: log.weight_kg });
      }
    }
  }
  return points.reverse();
}

// Pure -- distinct exercise names actually logged, most recently used first.
export function getLoggedExerciseNames(sessions: GymSession[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const session of sessions) {
    for (const log of session.exercises) {
      if (!seen.has(log.exercise_name)) {
        seen.add(log.exercise_name);
        names.push(log.exercise_name);
      }
    }
  }
  return names;
}
