import { getOpenTasks, splitTasksByWindow } from "@/lib/tasks";
import TaskBoard from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tasks = await getOpenTasks();
  const { today, week } = splitTasksByWindow(tasks);

  return <TaskBoard today={today} week={week} />;
}
