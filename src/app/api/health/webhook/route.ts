import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/auth";
import { upsertHealthMetrics, type WorkoutSummary } from "@/lib/healthMetrics";

// Health Auto Export's REST API export shape (verified against its own
// docs, github.com/Lybron/health-auto-export/wiki):
//   { data: { metrics: [{ name, units, data: [{ qty, date }] }], workouts: [...] } }
// "date"/"start" strings begin with "yyyy-MM-dd" -- sliced directly as the
// day bucket rather than reparsed, so no timezone conversion is needed.
type HealthAutoExportPayload = {
  data?: {
    metrics?: Array<{
      name: string;
      data?: Array<Record<string, unknown>>;
    }>;
    workouts?: Array<{
      name?: string;
      start?: string;
      duration?: number;
      activeEnergyBurned?: { qty?: number };
    }>;
  };
};

function dateKeyFrom(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 10) return null;
  return value.slice(0, 10);
}

export async function POST(request: NextRequest) {
  const expected = process.env.HEALTH_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const provided = request.headers.get("X-Webhook-Secret") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as HealthAutoExportPayload | null;
  if (!body?.data) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const stepsByDate = new Map<string, number>();
  const sleepByDate = new Map<string, number>();
  const workoutsByDate = new Map<string, WorkoutSummary[]>();

  for (const metric of body.data.metrics ?? []) {
    if (metric.name === "step_count") {
      for (const entry of metric.data ?? []) {
        const date = dateKeyFrom(entry.date);
        const qty = Number(entry.qty);
        if (!date || !Number.isFinite(qty)) continue;
        stepsByDate.set(date, (stepsByDate.get(date) ?? 0) + qty);
      }
    } else if (metric.name === "sleep_analysis") {
      for (const entry of metric.data ?? []) {
        const date = dateKeyFrom(entry.date);
        const asleep = Number(entry.asleep ?? entry.totalSleep);
        if (!date || !Number.isFinite(asleep)) continue;
        sleepByDate.set(date, asleep);
      }
    }
    // Other metric names are ignored -- Health Auto Export can be configured
    // to send 100+ metrics; only steps and sleep are tracked here.
  }

  for (const workout of body.data.workouts ?? []) {
    const date = dateKeyFrom(workout.start);
    if (!date) continue;
    const summary: WorkoutSummary = {
      name: workout.name ?? "Workout",
      durationMinutes: Math.round((workout.duration ?? 0) / 60),
      activeEnergyKcal:
        typeof workout.activeEnergyBurned?.qty === "number" ? Math.round(workout.activeEnergyBurned.qty) : null,
    };
    const existing = workoutsByDate.get(date) ?? [];
    existing.push(summary);
    workoutsByDate.set(date, existing);
  }

  const dates = new Set([...stepsByDate.keys(), ...sleepByDate.keys(), ...workoutsByDate.keys()]);
  for (const date of dates) {
    await upsertHealthMetrics(date, {
      steps: stepsByDate.get(date),
      sleepHours: sleepByDate.get(date),
      workouts: workoutsByDate.get(date),
    });
  }

  return NextResponse.json({ ok: true, datesUpdated: dates.size });
}
