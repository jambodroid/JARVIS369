import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";
import { localDateKey } from "@/lib/tasks";

export type JournalEntry = {
  id: string;
  entry_date: string;
  traded: boolean;
  summary: string | null;
  pnl: number | null;
};

export type JournalGroup = {
  startDate: string;
  tradingDays: number;
  totalPnl: number | null;
  entries: JournalEntry[];
};

export async function getJournalEntries(limit = 90): Promise<JournalEntry[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("trading_journal_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as JournalEntry[];
  });
}

export async function upsertJournalEntry(input: {
  entry_date: string;
  traded: boolean;
  summary: string;
  pnl: number | null;
}): Promise<JournalEntry> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("trading_journal_entries")
    .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: "entry_date" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as JournalEntry;
}

export async function deleteJournalEntry(entryDate: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("trading_journal_entries").delete().eq("entry_date", entryDate);
  if (error) throw new Error(error.message);
}

// Pure -- no Supabase call. Used for the collapsed-section preview.
export function getTodayEntry(entries: JournalEntry[]): JournalEntry | null {
  const todayKey = localDateKey(new Date());
  return entries.find((e) => e.entry_date === todayKey) ?? null;
}

function sumKnownPnl(entries: JournalEntry[]): number | null {
  const known = entries.filter((e) => e.pnl !== null);
  if (known.length === 0) return null;
  return known.reduce((sum, e) => sum + (e.pnl ?? 0), 0);
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function toGroups(map: Map<string, JournalEntry[]>): JournalGroup[] {
  const groups = Array.from(map.entries()).map(([startDate, groupEntries]) => {
    const sorted = [...groupEntries].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
    return {
      startDate,
      tradingDays: sorted.filter((e) => e.traded).length,
      totalPnl: sumKnownPnl(sorted),
      entries: sorted,
    };
  });
  return groups.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

export function groupByWeek(entries: JournalEntry[]): JournalGroup[] {
  const map = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const key = isoWeekStart(e.entry_date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return toGroups(map);
}

export function groupByMonth(entries: JournalEntry[]): JournalGroup[] {
  const map = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const key = `${e.entry_date.slice(0, 7)}-01`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return toGroups(map);
}
