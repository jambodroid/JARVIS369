import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";

export type HealthEntryType = "meal" | "training" | "sleep";

export type HealthEntry = {
  id: string;
  entry_type: HealthEntryType;
  content: string;
  created_at: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
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
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  logged_at?: string;
}): Promise<HealthEntry> {
  const { logged_at, ...rest } = input;
  const supabase = getSupabaseClient();
  const row = logged_at ? { ...rest, created_at: logged_at } : rest;
  const { data, error } = await supabase.from("health_entries").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data as HealthEntry;
}

// Pure -- no Supabase call. Used both server-side for the collapsed-section
// preview and could be reused client-side if needed.
export function getTodayEntries(entries: HealthEntry[]): HealthEntry[] {
  const todayKey = new Date().toDateString();
  return entries.filter((e) => new Date(e.created_at).toDateString() === todayKey);
}
