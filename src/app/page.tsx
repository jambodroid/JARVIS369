import { getCompletedTasks, getOpenTasks, splitTasksByWindow } from "@/lib/tasks";
import { isGoogleConnected, listWeekEvents } from "@/lib/google";
import { isTrueLayerConnected } from "@/lib/truelayer";
import { getAccountByName, getNetWorthAccounts, getNetWorthSnapshots } from "@/lib/netWorth";
import TaskBoard from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ google_error?: string; truelayer_error?: string }>;
}) {
  const { google_error, truelayer_error } = await searchParams;

  const [openTasks, completed, googleConnected, truelayerConnected, netWorthAccounts, netWorthSnapshots] =
    await Promise.all([
      getOpenTasks(),
      getCompletedTasks(),
      isGoogleConnected(),
      isTrueLayerConnected(),
      getNetWorthAccounts(),
      getNetWorthSnapshots(),
    ]);
  const { today, week } = splitTasksByWindow(openTasks);
  const events = googleConnected ? await listWeekEvents() : [];
  const tradingAccount = await getAccountByName("AMP Trading");

  return (
    <TaskBoard
      today={today}
      week={week}
      completed={completed}
      googleConnected={googleConnected}
      events={events}
      googleError={google_error}
      truelayerConnected={truelayerConnected}
      truelayerError={truelayer_error}
      netWorthAccounts={netWorthAccounts}
      netWorthSnapshots={netWorthSnapshots}
      tradingAccount={tradingAccount}
    />
  );
}
