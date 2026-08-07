"use client";

import { useState } from "react";
import type { CalendarEvent } from "@/lib/google";
import { localDateKey, addDays } from "@/lib/tasks";
import Card from "@/components/Card";

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_HEIGHT = 44; // px
const DAY_COL_WIDTH = 88; // px
const GUTTER_WIDTH = 30; // px
const HEADER_HEIGHT = 30; // px
const MIN_BLOCK_MINUTES = 20;

const GOOGLE_COLOR_DOT: Record<string, string> = {
  "3": "bg-cat-purple", // Grape
  "5": "bg-cat-yellow", // Banana
  "9": "bg-cat-blue", // Blueberry
  "10": "bg-cat-green", // Basil
  "11": "bg-danger", // Tomato
};

const GOOGLE_COLOR_BLOCK: Record<string, string> = {
  "3": "bg-cat-purple/20 border-cat-purple/50 text-cat-purple",
  "5": "bg-cat-yellow/20 border-cat-yellow/50 text-cat-yellow",
  "9": "bg-cat-blue/20 border-cat-blue/50 text-cat-blue",
  "10": "bg-cat-green/20 border-cat-green/50 text-cat-green",
  "11": "bg-danger/20 border-danger/50 text-danger",
};

const GOOGLE_COLOR_LABEL: Record<string, string> = {
  "3": "Health",
  "5": "Social",
  "9": "General",
  "10": "Trading",
  "11": "High priority",
};

const DEFAULT_BLOCK = "bg-ink-3/20 border-ink-3/40 text-ink-1";

// Locale is pinned (not `undefined`/`[]`) so server-rendered HTML always
// matches what the client renders on hydration, regardless of the server's
// or browser's OS locale settings.
function dayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatHourLabel(hour: number): string {
  const h = hour % 24;
  const period = h < 12 ? "a" : "p";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

type PositionedEvent = { event: CalendarEvent; startMin: number; endMin: number; col: number; cols: number };

// Clips a timed event's minutes-since-midnight range to the grid's display
// window, and returns null if it falls entirely outside it (e.g. an
// overnight event) so it's simply not shown rather than rendered broken.
function toWindowRange(event: CalendarEvent): { startMin: number; endMin: number } | null {
  if (event.allDay) return null;
  const start = new Date(event.start);
  const end = new Date(event.end);
  const rawStart = start.getHours() * 60 + start.getMinutes();
  let rawEnd = end.getHours() * 60 + end.getMinutes();
  if (rawEnd <= rawStart) rawEnd = rawStart + 30;
  rawEnd = Math.max(rawEnd, rawStart + MIN_BLOCK_MINUTES);

  const windowStart = START_HOUR * 60;
  const windowEnd = END_HOUR * 60;
  if (rawEnd <= windowStart || rawStart >= windowEnd) return null;

  return {
    startMin: Math.min(Math.max(rawStart, windowStart), windowEnd),
    endMin: Math.min(Math.max(rawEnd, windowStart), windowEnd),
  };
}

// Greedy interval-column layout: events that overlap in time are clustered
// together and split into side-by-side columns within that cluster, so two
// overlapping events never render on top of each other.
function layoutDayEvents(events: CalendarEvent[]): PositionedEvent[] {
  const ranged = events
    .map((event) => {
      const range = toWindowRange(event);
      return range ? { event, ...range } : null;
    })
    .filter((e): e is { event: CalendarEvent; startMin: number; endMin: number } => e !== null)
    .sort((a, b) => a.startMin - b.startMin);

  const results: PositionedEvent[] = [];
  let cluster: typeof ranged = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    for (const item of cluster) {
      let col = columnEnds.findIndex((end) => end <= item.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(item.endMin);
      } else {
        columnEnds[col] = item.endMin;
      }
      results.push({ ...item, col, cols: 0 });
    }
    const cols = columnEnds.length;
    for (let i = results.length - cluster.length; i < results.length; i++) results[i].cols = cols;
    cluster = [];
  }

  for (const item of ranged) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) {
      flushCluster();
      clusterEnd = -Infinity;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flushCluster();

  return results;
}

export default function WeekCalendar({ events }: { events: CalendarEvent[] }) {
  const days = Array.from({ length: 7 }, (_, i) => localDateKey(addDays(new Date(), i)));
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const todayKey = localDateKey(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedId) ?? null;

  return (
    <Card title="Calendar">
      <div className="overflow-x-auto">
        <div className="flex" style={{ width: GUTTER_WIDTH + days.length * DAY_COL_WIDTH }}>
          <div
            className="sticky left-0 z-10 shrink-0 bg-surface"
            style={{ width: GUTTER_WIDTH }}
          >
            <div style={{ height: HEADER_HEIGHT }} />
            {hours.map((h) => (
              <div
                key={h}
                className="pr-1 text-right text-[10px] leading-none text-ink-4"
                style={{ height: HOUR_HEIGHT }}
              >
                {formatHourLabel(h)}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayEvents = events.filter((e) => e.start.startsWith(day));
            const allDayEvents = dayEvents.filter((e) => e.allDay);
            const positioned = layoutDayEvents(dayEvents);
            const isToday = day === todayKey;

            return (
              <div key={day} className="shrink-0 border-l border-border/40" style={{ width: DAY_COL_WIDTH }}>
                <div
                  className={`flex flex-col items-center justify-center text-[10px] font-medium ${
                    isToday ? "text-accent" : "text-ink-2"
                  }`}
                  style={{ height: HEADER_HEIGHT }}
                >
                  {dayLabel(day)}
                </div>

                {allDayEvents.length > 0 && (
                  <div className="flex flex-col gap-0.5 border-b border-border/40 px-1 pb-1">
                    {allDayEvents.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setSelectedId(e.id)}
                        className={`truncate rounded px-1 text-left text-[9px] ${GOOGLE_COLOR_BLOCK[e.colorId ?? ""] ?? DEFAULT_BLOCK}`}
                      >
                        {e.title}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-border/25"
                      style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {positioned.map(({ event, startMin, endMin, col, cols }) => {
                    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedId(event.id)}
                        className={`absolute overflow-hidden rounded border px-1 py-0.5 text-left text-[9px] leading-tight ${GOOGLE_COLOR_BLOCK[event.colorId ?? ""] ?? DEFAULT_BLOCK}`}
                        style={{
                          top,
                          height: Math.max(height - 1, 12),
                          left: `${(col / cols) * 100}%`,
                          width: `${100 / cols}%`,
                        }}
                      >
                        <span className="block truncate font-medium">{event.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedEvent && (
        <div className="mt-3 flex items-start justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-0">{selectedEvent.title}</p>
            <p className="text-xs text-ink-3">
              {selectedEvent.allDay
                ? "All day"
                : `${formatTime(selectedEvent.start)} – ${formatTime(selectedEvent.end)}`}
            </p>
            {selectedEvent.colorId && GOOGLE_COLOR_LABEL[selectedEvent.colorId] && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                <span className={`h-1.5 w-1.5 rounded-full ${GOOGLE_COLOR_DOT[selectedEvent.colorId] ?? "bg-ink-3"}`} />
                {GOOGLE_COLOR_LABEL[selectedEvent.colorId]}
              </p>
            )}
          </div>
          <button
            onClick={() => setSelectedId(null)}
            aria-label="Close"
            className="shrink-0 text-xs text-ink-3 hover:text-ink-1"
          >
            ✕
          </button>
        </div>
      )}
    </Card>
  );
}
