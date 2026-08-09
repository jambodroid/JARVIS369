import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";
import { upsertContentItemEvent } from "@/lib/google";
import { localDateKey } from "@/lib/tasks";

export type ContentStatus = "idea" | "scripted" | "filmed" | "edited" | "scheduled" | "posted";

const STATUS_ORDER: ContentStatus[] = ["idea", "scripted", "filmed", "edited", "scheduled", "posted"];
type ContentTaskStage = "edit" | "schedule" | "post";
const STAGE_VERB: Record<ContentTaskStage, string> = { edit: "Edit", schedule: "Schedule", post: "Post" };

// Which action is still needed to get a piece of content out the door,
// based on how far it's progressed. null means nothing left to do (posted).
function stageNeeded(status: ContentStatus): ContentTaskStage | null {
  const idx = STATUS_ORDER.indexOf(status);
  if (idx < STATUS_ORDER.indexOf("edited")) return "edit";
  if (status === "edited") return "schedule";
  if (status === "scheduled") return "post";
  return null;
}

export type Client = {
  id: string;
  name: string;
  created_at: string;
};

export type ContentItem = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  title: string;
  status: ContentStatus;
  platform: string | null;
  notes: string | null;
  due_date: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function getClients(): Promise<Client[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("social_clients").select("*").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Client[];
  });
}

// Jarvis passes a client name in plain language -- the client shouldn't
// need to be pre-registered first, same "just works" philosophy as
// `account` being free text on recurring payments.
export async function getOrCreateClient(name: string): Promise<Client> {
  const supabase = getSupabaseClient();
  const trimmed = name.trim();

  const { data: existing, error: findError } = await supabase
    .from("social_clients")
    .select("*")
    .eq("name", trimmed)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing) return existing as Client;

  const { data, error } = await supabase.from("social_clients").insert({ name: trimmed }).select().single();
  if (error) throw new Error(error.message);
  return data as Client;
}

type ContentItemRow = {
  id: string;
  client_id: string | null;
  title: string;
  status: ContentStatus;
  platform: string | null;
  notes: string | null;
  due_date: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
  social_clients: { name: string } | null;
};

function rowToContentItem(row: ContentItemRow): ContentItem {
  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.social_clients?.name ?? null,
    title: row.title,
    status: row.status,
    platform: row.platform,
    notes: row.notes,
    due_date: row.due_date,
    google_event_id: row.google_event_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getContentItems(limit = 100): Promise<ContentItem[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("social_content_items")
      .select("*, social_clients(name)")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as ContentItemRow[]).map(rowToContentItem);
  });
}

export async function getContentItemById(id: string): Promise<ContentItem | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("social_content_items")
    .select("*, social_clients(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToContentItem(data as unknown as ContentItemRow) : null;
}

// If due_date is set, syncs a 6pm calendar event and stores the resulting
// google_event_id. Sync failures are logged and swallowed -- the content
// item record is more important than the calendar sync succeeding, same
// philosophy as taskActions.ts's syncCalendarIfTimed.
async function syncCalendarIfDated(item: ContentItem, timeZone: string): Promise<ContentItem> {
  if (!item.due_date) return item;
  try {
    const eventId = await upsertContentItemEvent(
      { title: item.title, client_name: item.client_name, due_date: item.due_date, google_event_id: item.google_event_id },
      timeZone,
    );
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("social_content_items")
      .update({ google_event_id: eventId })
      .eq("id", item.id)
      .select("*, social_clients(name)")
      .single();
    if (error) throw new Error(error.message);
    return rowToContentItem(data as unknown as ContentItemRow);
  } catch (error) {
    console.error("Failed to sync content item to Google Calendar", error);
    return item;
  }
}

// If a content item is due today and still needs work, makes sure there's
// an open task for the next required action (edit/schedule/post) -- so
// nothing due today silently gets missed just because it wasn't checked on.
// Idempotent: won't duplicate a task for a stage that already has one open.
// Any open task linked to this item for a stage that's no longer current
// gets auto-completed -- the pipeline status advancing already confirms
// that stage is done, so it shouldn't sit open waiting to be checked off.
export async function syncTaskForContentItem(item: ContentItem): Promise<void> {
  if (!item.due_date || item.due_date !== localDateKey(new Date())) return;

  const supabase = getSupabaseClient();
  const stage = stageNeeded(item.status);

  const { data: openLinked, error: openLinkedError } = await supabase
    .from("tasks")
    .select("id, content_stage")
    .eq("source_content_item_id", item.id)
    .is("completed_at", null);
  if (openLinkedError) throw new Error(openLinkedError.message);

  const staleIds = (openLinked ?? []).filter((t) => t.content_stage !== stage).map((t) => t.id);
  if (staleIds.length > 0) {
    const { error: completeError } = await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString() })
      .in("id", staleIds);
    if (completeError) throw new Error(completeError.message);
  }

  if (!stage) return;
  if ((openLinked ?? []).some((t) => t.content_stage === stage)) return;

  const title = `${STAGE_VERB[stage]}: ${item.title}${item.client_name ? ` (${item.client_name})` : ""}`;
  const { error: insertError } = await supabase.from("tasks").insert({
    title,
    due_date: item.due_date,
    due_time: null,
    priority: "high",
    category: "social",
    source_content_item_id: item.id,
    content_stage: stage,
  });
  if (insertError) throw new Error(insertError.message);
}

export async function createContentItem(
  input: {
    client_name?: string;
    title: string;
    status?: ContentStatus;
    platform?: string;
    due_date?: string;
  },
  timeZone: string,
): Promise<ContentItem> {
  const supabase = getSupabaseClient();
  let clientId: string | null = null;
  if (input.client_name) {
    const client = await getOrCreateClient(input.client_name);
    clientId = client.id;
  }

  const { data, error } = await supabase
    .from("social_content_items")
    .insert({
      client_id: clientId,
      title: input.title,
      status: input.status ?? "idea",
      platform: input.platform ?? null,
      due_date: input.due_date ?? null,
    })
    .select("*, social_clients(name)")
    .single();
  if (error) throw new Error(error.message);
  const item = await syncCalendarIfDated(rowToContentItem(data as unknown as ContentItemRow), timeZone);
  await syncTaskForContentItem(item);
  return item;
}

export async function updateContentItemStatus(id: string, status: ContentStatus): Promise<ContentItem> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("social_content_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, social_clients(name)")
    .single();
  if (error) throw new Error(error.message);
  const item = rowToContentItem(data as unknown as ContentItemRow);
  await syncTaskForContentItem(item);
  return item;
}

export async function setContentItemDueDate(id: string, dueDate: string, timeZone: string): Promise<ContentItem> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("social_content_items")
    .update({ due_date: dueDate, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, social_clients(name)")
    .single();
  if (error) throw new Error(error.message);
  const item = await syncCalendarIfDated(rowToContentItem(data as unknown as ContentItemRow), timeZone);
  await syncTaskForContentItem(item);
  return item;
}

// Pure -- no Supabase call. Used for the collapsed-section preview.
export function getPipelineSummary(items: ContentItem[]): string {
  if (items.length === 0) return "";
  const counts: Record<ContentStatus, number> = {
    idea: 0,
    scripted: 0,
    filmed: 0,
    edited: 0,
    scheduled: 0,
    posted: 0,
  };
  for (const item of items) counts[item.status]++;

  const inProgress = counts.scripted + counts.filmed + counts.edited;
  const parts: string[] = [];
  if (inProgress > 0) parts.push(`${inProgress} in progress`);
  if (counts.scheduled > 0) parts.push(`${counts.scheduled} ready to post`);
  if (parts.length === 0 && counts.idea > 0) parts.push(`${counts.idea} idea${counts.idea === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
