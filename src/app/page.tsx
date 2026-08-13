import { getCompletedTasks, getOpenTasks } from "@/lib/tasks";
import { isGoogleConnected, listWeekEvents } from "@/lib/google";
import { getAccountByName, getNetWorthAccounts, getNetWorthSnapshots } from "@/lib/netWorth";
import { getRecurringPayments } from "@/lib/recurringPayments";
import { getJournalEntries } from "@/lib/tradingJournal";
import { getSelfEntries } from "@/lib/selfEntries";
import { getHealthEntries } from "@/lib/healthEntries";
import { getHealthMetrics } from "@/lib/healthMetrics";
import { getHealthPlans } from "@/lib/healthPlans";
import { getGymSessions } from "@/lib/gymTracker";
import { getContentItems } from "@/lib/socialBusiness";
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
    healthMetrics,
    healthPlans,
    gymSessions,
    contentItems,
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
    getHealthMetrics(),
    getHealthPlans(),
    getGymSessions(),
    getContentItems(),
  ]);
  // A stored token row existing (googleConnected) doesn't guarantee it still
  // works -- Google can revoke/expire a refresh token independently (password
  // change, 6 months unused, app access revoked). Without this try/catch,
  // that failure was an uncaught server-component error that took down the
  // entire dashboard instead of just the calendar section.
  let events: Awaited<ReturnType<typeof listWeekEvents>> = [];
  let calendarConnected = googleConnected;
  let calendarError = google_error;
  if (googleConnected) {
    try {
      events = await listWeekEvents();
    } catch (err) {
      console.error("Failed to load calendar events", err);
      calendarConnected = false;
      calendarError = "Your Google Calendar connection expired. Please reconnect.";
    }
  }
  const tradingAccount = await getAccountByName("AMP Trading");

  return (
    <TaskBoard
      openTasks={openTasks}
      completed={completed}
      googleConnected={calendarConnected}
      events={events}
      googleError={calendarError}
      netWorthAccounts={netWorthAccounts}
      netWorthSnapshots={netWorthSnapshots}
      tradingAccount={tradingAccount}
      recurringPayments={recurringPayments}
      journalEntries={journalEntries}
      selfEntries={selfEntries}
      healthEntries={healthEntries}
      healthMetrics={healthMetrics}
      healthPlans={healthPlans}
      gymSessions={gymSessions}
      contentItems={contentItems}
    />
  );
}
