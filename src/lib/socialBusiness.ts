import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";

export type ContentStatus = "idea" | "scripted" | "filmed" | "edited" | "posted";

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

export async function createContentItem(input: {
  client_name?: string;
  title: string;
  status?: ContentStatus;
  platform?: string;
}): Promise<ContentItem> {
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
    })
    .select("*, social_clients(name)")
    .single();
  if (error) throw new Error(error.message);
  return rowToContentItem(data as unknown as ContentItemRow);
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
  return rowToContentItem(data as unknown as ContentItemRow);
}

// Pure -- no Supabase call. Used for the collapsed-section preview.
export function getPipelineSummary(items: ContentItem[]): string {
  if (items.length === 0) return "";
  const counts: Record<ContentStatus, number> = { idea: 0, scripted: 0, filmed: 0, edited: 0, posted: 0 };
  for (const item of items) counts[item.status]++;

  const inProgress = counts.scripted + counts.filmed;
  const parts: string[] = [];
  if (inProgress > 0) parts.push(`${inProgress} in progress`);
  if (counts.edited > 0) parts.push(`${counts.edited} ready to post`);
  if (parts.length === 0 && counts.idea > 0) parts.push(`${counts.idea} idea${counts.idea === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
