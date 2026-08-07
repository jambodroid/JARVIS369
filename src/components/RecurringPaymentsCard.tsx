"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RecurringPayment } from "@/lib/recurringPayments";
import { isDueThisWeek } from "@/lib/recurringPayments";
import Card from "@/components/Card";

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
  const sorted = [...payments].sort((a, b) => a.day_of_month - b.day_of_month);
  const monthlyTotal = payments.reduce((sum, p) => sum + p.amount, 0);

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
    </Card>
  );
}
