import { getSupabaseClient, withTransientRetry } from "@/lib/supabase";

export type RecurringPayment = {
  id: string;
  name: string;
  amount: number;
  day_of_month: number;
  account: string;
  active: boolean;
  is_debt: boolean;
};

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
