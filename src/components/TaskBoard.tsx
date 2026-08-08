"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@/lib/tasks";
import type { CalendarEvent } from "@/lib/google";
import type { NetWorthAccount, NetWorthSnapshot } from "@/lib/netWorth";
import type { RecurringPayment } from "@/lib/recurringPayments";
import { getTodayEntry, type JournalEntry } from "@/lib/tradingJournal";
import { getTodayEntries as getTodaySelfEntries, type SelfEntry } from "@/lib/selfEntries";
import { getTodayEntries as getTodayHealthEntries, type HealthEntry, type HealthEntryType } from "@/lib/healthEntries";
import TaskRow from "@/components/TaskRow";
import Card from "@/components/Card";
import CollapsibleSection from "@/components/CollapsibleSection";
import WeekCalendar from "@/components/WeekCalendar";
import ConnectGoogleCalendar from "@/components/ConnectGoogleCalendar";
import JarvisPanel from "@/components/JarvisPanel";
import NetWorthCard from "@/components/NetWorthCard";
import TradingCard from "@/components/TradingCard";
import TradingJournalCard from "@/components/TradingJournalCard";
import RecurringPaymentsCard from "@/components/RecurringPaymentsCard";
import HealthCard from "@/components/HealthCard";
import SelfCard from "@/components/SelfCard";
import TrendChart from "@/components/TrendChart";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

const HEALTH_TYPE_NOUN: Record<HealthEntryType, [string, string]> = {
  meal: ["meal", "meals"],
  training: ["training session", "training sessions"],
  sleep: ["sleep entry", "sleep entries"],
};

function Section({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <Card title={title} count={tasks.length}>
      {tasks.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function CompletedSection({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">
          Completed
        </span>
        <span className="text-xs text-ink-3">{open ? "Hide" : `Show (${tasks.length})`}</span>
      </button>

      {open &&
        (tasks.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Nothing completed yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} completed />
            ))}
          </ul>
        ))}
    </Card>
  );
}

export default function TaskBoard({
  today,
  week,
  completed,
  googleConnected,
  events,
  googleError,
  netWorthAccounts,
  netWorthSnapshots,
  tradingAccount,
  recurringPayments,
  journalEntries,
  selfEntries,
  healthEntries,
}: {
  today: Task[];
  week: Task[];
  completed: Task[];
  googleConnected: boolean;
  events: CalendarEvent[];
  googleError?: string;
  netWorthAccounts: NetWorthAccount[];
  netWorthSnapshots: NetWorthSnapshot[];
  tradingAccount: NetWorthAccount | null;
  recurringPayments: RecurringPayment[];
  journalEntries: JournalEntry[];
  selfEntries: SelfEntry[];
  healthEntries: HealthEntry[];
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const financesPreview = (
    <TrendChart
      data={netWorthSnapshots.slice(-30).map((s) => ({ date: s.snapshot_date, value: s.total }))}
      formatValue={formatMoney}
    />
  );

  const todayTradingEntry = getTodayEntry(journalEntries);
  const tradingPreview = todayTradingEntry ? (
    <div className="flex items-center justify-between gap-2">
      <p className="truncate text-xs text-ink-2">{todayTradingEntry.summary || "Logged, no summary."}</p>
      {todayTradingEntry.pnl !== null && (
        <span className={`shrink-0 font-mono text-xs font-medium ${todayTradingEntry.pnl >= 0 ? "text-ok" : "text-danger"}`}>
          {todayTradingEntry.pnl >= 0 ? "+" : ""}
          {formatMoney(todayTradingEntry.pnl)}
        </span>
      )}
    </div>
  ) : (
    <p className="text-xs text-ink-3">No entry yet today.</p>
  );

  const todayHealthEntries = getTodayHealthEntries(healthEntries);
  const healthPreview =
    todayHealthEntries.length === 0 ? (
      <p className="text-xs text-ink-3">Nothing logged today yet.</p>
    ) : (
      <p className="truncate text-xs text-ink-2">
        {(["meal", "training", "sleep"] as HealthEntryType[])
          .map((type) => {
            const count = todayHealthEntries.filter((e) => e.entry_type === type).length;
            if (count === 0) return null;
            const [singular, plural] = HEALTH_TYPE_NOUN[type];
            return `${count} ${count === 1 ? singular : plural}`;
          })
          .filter(Boolean)
          .join(" · ")}
      </p>
    );

  const todaySelfEntries = getTodaySelfEntries(selfEntries);
  const latestSelfEntry = todaySelfEntries[0] ?? null;
  const selfPreview = latestSelfEntry ? (
    <p className="truncate text-xs text-ink-2">{latestSelfEntry.content}</p>
  ) : (
    <p className="text-xs text-ink-3">Nothing logged today yet.</p>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-accent/20 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-ink-0">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_8px_2px_var(--accent)]" />
            Tasks
          </h1>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-ink-3 transition-colors hover:text-ink-1"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-5 sm:px-6">
        <JarvisPanel />

        <CollapsibleSection title="Today" defaultOpen>
          <Section title="Today" tasks={today} />
          <Section title="This Week" tasks={week} />
          <CompletedSection tasks={completed} />
          {googleConnected ? (
            <WeekCalendar events={events} />
          ) : (
            <ConnectGoogleCalendar error={googleError} />
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Finances" preview={financesPreview}>
          <NetWorthCard accounts={netWorthAccounts} snapshots={netWorthSnapshots} />
          <RecurringPaymentsCard payments={recurringPayments} />
        </CollapsibleSection>

        <CollapsibleSection title="Trading" preview={tradingPreview}>
          <TradingCard account={tradingAccount} snapshots={netWorthSnapshots} />
          <TradingJournalCard entries={journalEntries} />
        </CollapsibleSection>

        <CollapsibleSection title="Health" preview={healthPreview}>
          <HealthCard entries={healthEntries} />
        </CollapsibleSection>

        <CollapsibleSection title="Self" preview={selfPreview}>
          <SelfCard entries={selfEntries} />
        </CollapsibleSection>
      </main>
    </div>
  );
}
