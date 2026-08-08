import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";
import { GOOGLE_COLOR_ID, resolveColor } from "@/lib/colors";
import type { Task } from "@/lib/tasks";
import { addDays, localDateKey } from "@/lib/tasks";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Google Calendar is not connected yet");
    this.name = "GoogleNotConnectedError";
  }
}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }
  return { clientId, clientSecret };
}

export function getAuthUrl(redirectUri: string): string {
  const { clientId } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar.events",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type GoogleAuthRow = {
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
};

async function getStoredAuth(): Promise<GoogleAuthRow | null> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("google_auth")
      .select("refresh_token, access_token, access_token_expires_at")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as GoogleAuthRow | null;
  });
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<void> {
  const { clientId, clientSecret } = getOAuthConfig();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const supabase = getSupabaseClient();

  if (json.refresh_token) {
    const { error } = await supabase.from("google_auth").upsert({
      id: 1,
      refresh_token: json.refresh_token,
      access_token: json.access_token,
      access_token_expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  } else {
    // Google only returns a refresh_token on first consent. If we're
    // re-connecting without one, keep the existing refresh_token.
    const { error } = await supabase
      .from("google_auth")
      .update({
        access_token: json.access_token,
        access_token_expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string }> {
  const { clientId, clientSecret } = getOAuthConfig();

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("google_auth")
    .update({ access_token: json.access_token, access_token_expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  return { accessToken: json.access_token, expiresAt };
}

export async function getValidAccessToken(forceRefresh = false): Promise<string> {
  const stored = await getStoredAuth();
  if (!stored) throw new GoogleNotConnectedError();

  const expiresAt = stored.access_token_expires_at ? new Date(stored.access_token_expires_at).getTime() : 0;
  // Refresh a minute early to avoid edge-of-expiry failures.
  if (!forceRefresh && stored.access_token && expiresAt > Date.now() + 60_000) {
    return stored.access_token;
  }

  const { accessToken } = await refreshAccessToken(stored.refresh_token);
  return accessToken;
}

// Our stored expiry can lie (Google can invalidate a token early). Retry
// once with a forced refresh if the API says the token is bad, rather than
// trusting the cached expiry blindly.
async function fetchGoogleCalendar(url: string, init: RequestInit = {}): Promise<Response> {
  const withAuth = async (token: string) =>
    fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });

  let accessToken = await getValidAccessToken();
  let res = await withAuth(accessToken);

  if (res.status === 401) {
    accessToken = await getValidAccessToken(true);
    res = await withAuth(accessToken);
  }

  return res;
}

export async function isGoogleConnected(): Promise<boolean> {
  const stored = await getStoredAuth();
  return stored !== null;
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO datetime or YYYY-MM-DD for all-day
  end: string;
  allDay: boolean;
  colorId: string | null;
};

export async function listWeekEvents(): Promise<CalendarEvent[]> {
  const timeMin = new Date(`${localDateKey(new Date())}T00:00:00`).toISOString();
  const timeMax = new Date(`${localDateKey(addDays(new Date(), 7))}T00:00:00`).toISOString();

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin,
    timeMax,
    maxResults: "250",
  });

  const res = await fetchGoogleCalendar(`${CALENDAR_API}?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Google Calendar list failed: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      start: { date?: string; dateTime?: string };
      end: { date?: string; dateTime?: string };
      colorId?: string;
    }>;
  };

  return (json.items ?? []).map((item) => ({
    id: item.id,
    title: item.summary ?? "(untitled)",
    start: item.start.dateTime ?? item.start.date ?? "",
    end: item.end.dateTime ?? item.end.date ?? "",
    allDay: !item.start.dateTime,
    colorId: item.colorId ?? null,
  }));
}

// Creates (or updates, if the task already has a google_event_id) the
// calendar event for a task that has both a due_date and a due_time.
export async function upsertTaskEvent(
  task: Pick<Task, "title" | "due_date" | "due_time" | "category" | "priority" | "google_event_id">,
  timeZone: string,
): Promise<string> {
  if (!task.due_date || !task.due_time) {
    throw new Error("upsertTaskEvent requires both due_date and due_time");
  }

  const colorId = GOOGLE_COLOR_ID[resolveColor(task.category, task.priority)];
  const startDateTime = `${task.due_date}T${task.due_time}`;
  const endDateTime = addMinutes(startDateTime, 30);

  const body = {
    summary: task.title,
    colorId,
    start: { dateTime: startDateTime, timeZone },
    end: { dateTime: endDateTime, timeZone },
  };

  const url = task.google_event_id ? `${CALENDAR_API}/${task.google_event_id}` : CALENDAR_API;
  const method = task.google_event_id ? "PATCH" : "POST";

  const res = await fetchGoogleCalendar(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Google Calendar event ${method} failed: ${await res.text()}`);
  }

  const json = (await res.json()) as { id: string };
  return json.id;
}

// Updates any calendar event by id, task-linked or not. If date/time is
// given without an explicit duration, fetches the current event first to
// preserve its existing length (so "move Gym to 4pm" stays an hour long
// instead of collapsing to some default).
export async function updateCalendarEvent(
  googleEventId: string,
  updates: { title?: string; date?: string; time?: string; durationMinutes?: number; colorId?: string },
  timeZone: string,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (updates.title) body.summary = updates.title;
  if (updates.colorId) body.colorId = updates.colorId;

  let targetId = googleEventId;
  const isPureRecolor = updates.colorId !== undefined && !updates.title && !updates.date && !updates.time;

  if (updates.date || updates.time) {
    const getRes = await fetchGoogleCalendar(`${CALENDAR_API}/${googleEventId}`);
    if (!getRes.ok) throw new Error(`Google Calendar event fetch failed: ${await getRes.text()}`);
    const current = (await getRes.json()) as {
      start: { date?: string; dateTime?: string };
      end: { date?: string; dateTime?: string };
    };

    const currentStart = current.start.dateTime ?? `${current.start.date}T00:00:00`;
    const currentEnd = current.end.dateTime ?? `${current.end.date}T00:00:00`;
    const currentDurationMinutes = Math.round(
      (new Date(currentEnd).getTime() - new Date(currentStart).getTime()) / 60_000,
    );

    const [currentDate, currentTimePart] = currentStart.split("T");
    const newDate = updates.date ?? currentDate;
    const newTime = updates.time ? `${updates.time}:00` : currentTimePart.slice(0, 8);
    const newStart = `${newDate}T${newTime}`;
    const newEnd = addMinutes(newStart, updates.durationMinutes ?? currentDurationMinutes);

    body.start = { dateTime: newStart, timeZone };
    body.end = { dateTime: newEnd, timeZone };
  } else if (isPureRecolor) {
    // Recoloring a recurring event (e.g. tagging a daily routine's category)
    // means the whole series, not just today's occurrence -- resolve to the
    // master event and PATCH that instead of the single instance. If the
    // lookup fails for any reason, fall through and recolor just the
    // instance rather than losing the update entirely.
    const getRes = await fetchGoogleCalendar(`${CALENDAR_API}/${googleEventId}`);
    if (getRes.ok) {
      const current = (await getRes.json()) as { recurringEventId?: string };
      if (current.recurringEventId) {
        targetId = current.recurringEventId;
      }
    }
  }

  const res = await fetchGoogleCalendar(`${CALENDAR_API}/${targetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Google Calendar event update failed: ${await res.text()}`);
}

export async function deleteCalendarEvent(googleEventId: string): Promise<void> {
  const res = await fetchGoogleCalendar(`${CALENDAR_API}/${googleEventId}`, { method: "DELETE" });
  // 404/410 means it's already gone from Google's side -- treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar event delete failed: ${await res.text()}`);
  }
}

function addMinutes(isoLocal: string, minutes: number): string {
  const [datePart, timePart] = isoLocal.split("T");
  const [h, m] = timePart.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const newH = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const newM = String(total % 60).padStart(2, "0");
  return `${datePart}T${newH}:${newM}:00`;
}
