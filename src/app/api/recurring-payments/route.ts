import { NextRequest, NextResponse } from "next/server";
import { createRecurringPayment } from "@/lib/recurringPayments";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    amount?: number;
    day_of_month?: number;
    account?: string;
  } | null;

  const name = body?.name?.trim();
  const amount = Number(body?.amount);
  const day_of_month = Number(body?.day_of_month);
  const account = body?.account?.trim();

  if (!name || !Number.isFinite(amount) || !account) {
    return NextResponse.json({ error: "name, amount, and account are required" }, { status: 400 });
  }
  if (!Number.isInteger(day_of_month) || day_of_month < 1 || day_of_month > 31) {
    return NextResponse.json({ error: "day_of_month must be an integer between 1 and 31" }, { status: 400 });
  }

  const payment = await createRecurringPayment({ name, amount, day_of_month, account });
  return NextResponse.json(payment);
}
