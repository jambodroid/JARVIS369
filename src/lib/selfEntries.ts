import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";

export type EntryType = "journal" | "goal" | "habit" | "idea";

export type SelfEntry = {
  id: string;
  entry_type: EntryType;
  content: string;
  created_at: string;
};

export async function getSelfEntries(limit = 100): Promise<SelfEntry[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("self_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as SelfEntry[];
  });
}

export async function createSelfEntry(input: { entry_type: EntryType; content: string }): Promise<SelfEntry> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("self_entries").insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as SelfEntry;
}

// Pure -- no Supabase call. Used for the collapsed-section preview, which
// changes day to day as new entries are logged.
export function getTodayEntries(entries: SelfEntry[]): SelfEntry[] {
  const todayKey = new Date().toDateString();
  return entries.filter((e) => new Date(e.created_at).toDateString() === todayKey);
}
