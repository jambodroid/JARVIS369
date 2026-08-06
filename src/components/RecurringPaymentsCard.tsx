"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RecurringPayment } from "@/lib/recurringPayments";
import { isDueThisWeek } from "@/lib/recurringPayments";
import Card from "@/components/Card";

const fieldClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-0 outline-none focus:border-accent";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(n);
}

function ordinal(n: number) {
  if (n % 10 === 1 && n !== 11) return `${n}st`;
  if (n % 10 === 2 && n !== 12) return `${n}nd`;
  if (n % 10 === 3 && n !== 13) return `${n}rd`;
  return `${n}th`;
}

function PaymentRow({ payment }: { payment: RecurringPayment }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const dueThisWeek = isDueThisWeek(payment.day_of_month);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/recurring-payments/${payment.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm text-ink-0">{payment.name}</p>
          {dueThisWeek && (
            <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent">
              This week
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-ink-3">
          {ordinal(payment.day_of_month)} &middot; {payment.account}
        </p>
      </div>
      <span className="shrink-0 font-mono text-sm text-ink-0">{formatMoney(payment.amount)}</span>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 text-xs text-ink-3 hover:text-danger disabled:opacity-50"
      >
        Remove
      </button>
    </li>
  );
}

export default function RecurringPaymentsCard({ payments }: { payments: RecurringPayment[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [account, setAccount] = useState("HSBC Current Account");
  const [submitting, setSubmitting] = useState(false);

  const sorted = [...payments].sort((a, b) => a.day_of_month - b.day_of_month);
  const monthlyTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amountNum = Number(amount);
    const dayNum = Number(dayOfMonth);
    if (!name.trim() || !Number.isFinite(amountNum) || !Number.isInteger(dayNum)) return;

    setSubmitting(true);
    await fetch("/api/recurring-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), amount: amountNum, day_of_month: dayNum, account }),
    });
    setName("");
    setAmount("");
    setDayOfMonth("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Card title="Direct Debits" count={payments.length}>
      {sorted.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing tracked yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((p) => (
            <PaymentRow key={p.id} payment={p} />
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
        <span className="text-ink-0">Monthly total</span>
        <span className="font-mono text-accent">{formatMoney(monthlyTotal)}</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className={fieldClass}
        />
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className={`${fieldClass} flex-1`}
          />
          <input
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            placeholder="Day"
            className={`${fieldClass} w-20`}
          />
        </div>
        <div className="flex gap-2">
          <select value={account} onChange={(e) => setAccount(e.target.value)} className={`${fieldClass} flex-1`}>
            <option value="HSBC Current Account">HSBC Current Account</option>
            <option value="HSBC Credit Card">HSBC Credit Card</option>
          </select>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !amount || !dayOfMonth}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </form>
    </Card>
  );
}
