import type { CalendarEvent } from "@/lib/google";
import { localDateKey, addDays } from "@/lib/tasks";
import Card from "@/components/Card";

const GOOGLE_COLOR_DOT: Record<string, string> = {
  "3": "bg-cat-purple", // Grape
  "5": "bg-cat-yellow", // Banana
  "9": "bg-cat-blue", // Blueberry
  "10": "bg-cat-green", // Basil
  "11": "bg-danger", // Tomato
};

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

export default function WeekCalendar({ events }: { events: CalendarEvent[] }) {
  const days = Array.from({ length: 7 }, (_, i) => localDateKey(addDays(new Date(), i)));

  return (
    <Card title="Calendar">
      <div className="flex flex-col gap-3">
        {days.map((day) => {
          const dayEvents = events.filter((e) => e.start.startsWith(day));
          return (
            <div key={day}>
              <p className="text-xs font-medium text-ink-2">{dayLabel(day)}</p>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-ink-4">No events</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {dayEvents.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-sm text-ink-1">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${GOOGLE_COLOR_DOT[e.colorId ?? ""] ?? "bg-ink-3"}`}
                      />
                      <span className="shrink-0 text-xs text-ink-3">
                        {e.allDay ? "All day" : formatTime(e.start)}
                      </span>
                      <span className="truncate">{e.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
