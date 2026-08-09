import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";

export type HealthPlanKind = "gym" | "diet";

export async function getHealthPlans(): Promise<Record<HealthPlanKind, string | null>> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("health_plans").select("*");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { kind: HealthPlanKind; content: string }[];
    return {
      gym: rows.find((r) => r.kind === "gym")?.content ?? null,
      diet: rows.find((r) => r.kind === "diet")?.content ?? null,
    };
  });
}

export async function setHealthPlan(kind: HealthPlanKind, content: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("health_plans")
    .upsert({ kind, content, updated_at: new Date().toISOString() }, { onConflict: "kind" });
  if (error) throw new Error(error.message);
}
