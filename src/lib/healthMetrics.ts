import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";

export type WorkoutSummary = {
  name: string;
  durationMinutes: number;
  activeEnergyKcal: number | null;
};

export type HealthMetricsDay = {
  metric_date: string;
  steps: number | null;
  sleep_hours: number | null;
  workouts: WorkoutSummary[] | null;
};

export async function getHealthMetrics(limit = 30): Promise<HealthMetricsDay[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("health_metrics")
      .select("*")
      .order("metric_date", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as HealthMetricsDay[];
  });
}

// Upserts one day's row, only overwriting the fields actually provided --
// Health Auto Export sends steps/sleep/workouts as separate metrics, so a
// single webhook call rarely has all three for a given date.
export async function upsertHealthMetrics(
  metricDate: string,
  updates: { steps?: number; sleepHours?: number; workouts?: WorkoutSummary[] },
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: existing, error: fetchError } = await supabase
    .from("health_metrics")
    .select("*")
    .eq("metric_date", metricDate)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const row = {
    metric_date: metricDate,
    steps: updates.steps ?? existing?.steps ?? null,
    sleep_hours: updates.sleepHours ?? existing?.sleep_hours ?? null,
    workouts: updates.workouts ?? existing?.workouts ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("health_metrics").upsert(row, { onConflict: "metric_date" });
  if (error) throw new Error(error.message);
}
