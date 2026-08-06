import { getCompletedTasks, getOpenTasks, splitTasksByWindow } from "@/lib/tasks";
import TaskBoard from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [openTasks, completed] = await Promise.all([getOpenTasks(), getCompletedTasks()]);
  const { today, week } = splitTasksByWindow(openTasks);

  return <TaskBoard today={today} week={week} completed={completed} />;
}
