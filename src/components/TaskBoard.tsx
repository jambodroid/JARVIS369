"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@/lib/tasks";
import type { CalendarEvent } from "@/lib/google";
import type { NetWorthAccount, NetWorthSnapshot } from "@/lib/netWorth";
import type { RecurringPayment } from "@/lib/recurringPayments";
import type { JournalEntry } from "@/lib/tradingJournal";
import type { SelfEntry } from "@/lib/selfEntries";
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
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

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

        <CollapsibleSection title="Finances">
          <NetWorthCard accounts={netWorthAccounts} snapshots={netWorthSnapshots} />
          <RecurringPaymentsCard payments={recurringPayments} />
        </CollapsibleSection>

        <CollapsibleSection title="Trading">
          <TradingCard account={tradingAccount} snapshots={netWorthSnapshots} />
          <TradingJournalCard entries={journalEntries} />
        </CollapsibleSection>

        <CollapsibleSection title="Health">
          <HealthCard />
        </CollapsibleSection>

        <CollapsibleSection title="Self">
          <SelfCard entries={selfEntries} />
        </CollapsibleSection>
      </main>
    </div>
  );
}
