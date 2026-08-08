import { getCompletedTasks, getOpenTasks, splitTasksByWindow } from "@/lib/tasks";
import { isGoogleConnected, listWeekEvents } from "@/lib/google";
import { getAccountByName, getNetWorthAccounts, getNetWorthSnapshots } from "@/lib/netWorth";
import { getRecurringPayments } from "@/lib/recurringPayments";
import { getJournalEntries } from "@/lib/tradingJournal";
import { getSelfEntries } from "@/lib/selfEntries";
import { getHealthEntries } from "@/lib/healthEntries";
import TaskBoard from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ google_error?: string }>;
}) {
  const { google_error } = await searchParams;

  const [
    openTasks,
    completed,
    googleConnected,
    netWorthAccounts,
    netWorthSnapshots,
    recurringPayments,
    journalEntries,
    selfEntries,
    healthEntries,
  ] = await Promise.all([
    getOpenTasks(),
    getCompletedTasks(),
    isGoogleConnected(),
    getNetWorthAccounts(),
    getNetWorthSnapshots(),
    getRecurringPayments(),
    getJournalEntries(),
    getSelfEntries(),
    getHealthEntries(),
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
      netWorthAccounts={netWorthAccounts}
      netWorthSnapshots={netWorthSnapshots}
      tradingAccount={tradingAccount}
      recurringPayments={recurringPayments}
      journalEntries={journalEntries}
      selfEntries={selfEntries}
      healthEntries={healthEntries}
    />
  );
}
