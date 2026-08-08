import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";

export type HealthEntryType = "meal" | "training" | "sleep";

export type HealthEntry = {
  id: string;
  entry_type: HealthEntryType;
  content: string;
  created_at: string;
};

export async function getHealthEntries(limit = 100): Promise<HealthEntry[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("health_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as HealthEntry[];
  });
}

export async function createHealthEntry(input: {
  entry_type: HealthEntryType;
  content: string;
}): Promise<HealthEntry> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("health_entries").insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as HealthEntry;
}

// Pure -- no Supabase call. Used both server-side for the collapsed-section
// preview and could be reused client-side if needed.
export function getTodayEntries(entries: HealthEntry[]): HealthEntry[] {
  const todayKey = new Date().toDateString();
  return entries.filter((e) => new Date(e.created_at).toDateString() === todayKey);
}
