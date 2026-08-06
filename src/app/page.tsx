import { getCompletedTasks, getOpenTasks, splitTasksByWindow } from "@/lib/tasks";
import { isGoogleConnected, listWeekEvents } from "@/lib/google";
import TaskBoard from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ google_error?: string }>;
}) {
  const { google_error } = await searchParams;

  const [openTasks, completed, googleConnected] = await Promise.all([
    getOpenTasks(),
    getCompletedTasks(),
    isGoogleConnected(),
  ]);
  const { today, week } = splitTasksByWindow(openTasks);
  const events = googleConnected ? await listWeekEvents() : [];

  return (
    <TaskBoard
      today={today}
      week={week}
      completed={completed}
      googleConnected={googleConnected}
      events={events}
      googleError={google_error}
    />
  );
}
