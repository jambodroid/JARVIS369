import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";

export type RecurringPayment = {
  id: string;
  name: string;
  amount: number;
  day_of_month: number;
  account: string;
  active: boolean;
  is_debt: boolean;
  original_amount: number | null;
  remaining_balance: number | null;
  total_payable: number | null;
  paid_so_far: number | null;
  interest_rate: number | null;
  term_months_total: number | null;
  term_months_remaining: number | null;
  balance_as_of: string | null;
  net_worth_account_id: string | null;
  last_deducted_date: string | null;
};

// Setting a debt's remaining_balance also keeps a linked net_worth_accounts
// liability row in sync (creating it on first use), so debts without any
// live bank/lender feed still fold into the net worth total automatically
// -- same mechanism whether the balance was set by Jarvis or by the
// automatic end-of-day due-date deduction below.
export async function setDebtDetails(
  name: string,
  details: {
    original_amount?: number;
    remaining_balance?: number;
    total_payable?: number;
    paid_so_far?: number;
    interest_rate?: number;
    term_months_total?: number;
    term_months_remaining?: number;
  },
): Promise<RecurringPayment> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("recurring_payments")
    .update({ ...details, balance_as_of: new Date().toISOString().slice(0, 10) })
    .eq("name", name)
    .select()
    .single();
  if (error) throw new Error(error.message);
  let payment = data as RecurringPayment;

  if (details.remaining_balance !== undefined) {
    payment = await syncDebtNetWorthLiability(payment, details.remaining_balance);
  }

  return payment;
}

async function syncDebtNetWorthLiability(payment: RecurringPayment, balance: number): Promise<RecurringPayment> {
  const supabase = getSupabaseClient();

  if (payment.net_worth_account_id) {
    const { error } = await supabase
      .from("net_worth_accounts")
      .update({ balance, updated_at: new Date().toISOString() })
      .eq("id", payment.net_worth_account_id);
    if (error) throw new Error(error.message);
    return payment;
  }

  const { data: account, error: insertError } = await supabase
    .from("net_worth_accounts")
    .insert({ name: payment.name, kind: "liability", source: "manual", balance })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  const { data: updated, error: linkError } = await supabase
    .from("recurring_payments")
    .update({ net_worth_account_id: account.id })
    .eq("id", payment.id)
    .select()
    .single();
  if (linkError) throw new Error(linkError.message);
  return updated as RecurringPayment;
}

function isDueOn(dayOfMonth: number, date: Date): boolean {
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === Math.min(dayOfMonth, lastDayOfMonth);
}

// Net worth here has no live bank feed (TrueLayer never got connected) --
// every account balance is manually maintained, so a direct debit has to be
// applied by hand or it silently drifts out of date. Run once daily (end of
// day): for every active payment due today, adjusts its matched net worth
// account (by exact name) -- an asset (e.g. the current account it's paid
// from) goes down, a liability (e.g. a credit card the charge lands on)
// goes up, since either way net worth drops by the payment amount. Debts
// additionally have their own remaining_balance (and linked liability)
// reduced by the same amount, floored at 0 once paid off. Guarded by
// last_deducted_date so a payment can't be double-applied if the cron ever
// fires more than once on the same day.
export async function applyDueRecurringPayments(today = new Date()): Promise<void> {
  const supabase = getSupabaseClient();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data: payments, error } = await supabase.from("recurring_payments").select("*").eq("active", true);
  if (error) throw new Error(error.message);

  const { data: accounts, error: accountsError } = await supabase.from("net_worth_accounts").select("*");
  if (accountsError) throw new Error(accountsError.message);
  const accountsByName = new Map((accounts ?? []).map((a) => [a.name, a]));

  const due = ((payments ?? []) as RecurringPayment[]).filter(
    (p) => isDueOn(p.day_of_month, today) && p.last_deducted_date !== todayKey,
  );

  for (const payment of due) {
    const account = accountsByName.get(payment.account);
    if (account) {
      const delta = account.kind === "asset" ? -payment.amount : payment.amount;
      await supabase
        .from("net_worth_accounts")
        .update({ balance: Number(account.balance) + delta, updated_at: new Date().toISOString() })
        .eq("id", account.id);
    } else {
      console.error(`No net worth account named "${payment.account}" for recurring payment "${payment.name}"`);
    }

    if (payment.is_debt && payment.remaining_balance != null) {
      const newBalance = Math.max(0, payment.remaining_balance - payment.amount);
      await setDebtDetails(payment.name, { remaining_balance: newBalance });
    }

    await supabase.from("recurring_payments").update({ last_deducted_date: todayKey }).eq("id", payment.id);
  }
}

export async function getRecurringPayments(): Promise<RecurringPayment[]> {
  return withTransientRetry(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("recurring_payments")
      .select("*")
      .eq("active", true)
      .order("day_of_month");
    if (error) throw new Error(error.message);
    return (data ?? []) as RecurringPayment[];
  });
}

export async function createRecurringPayment(input: {
  name: string;
  amount: number;
  day_of_month: number;
  account: string;
  is_debt?: boolean;
}): Promise<RecurringPayment> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("recurring_payments").insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as RecurringPayment;
}

export async function deleteRecurringPayment(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("recurring_payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRecurringPaymentByName(name: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("recurring_payments").delete().eq("name", name);
  if (error) throw new Error(error.message);
}

// Clamps to the last real day of the month, so e.g. day 31 lands on the
// 30th in a 30-day month instead of overflowing into the next month.
export function getNextDueDate(dayOfMonth: number, from = new Date()): Date {
  const clampedThisMonth = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dayOfMonth, lastDay));
  };

  const thisMonth = clampedThisMonth(from.getFullYear(), from.getMonth());
  if (thisMonth >= new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    return thisMonth;
  }
  return clampedThisMonth(from.getFullYear(), from.getMonth() + 1);
}

export function isDueThisWeek(dayOfMonth: number, from = new Date()): boolean {
  const due = getNextDueDate(dayOfMonth, from);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays < 7;
}
