import { NextRequest, NextResponse } from "next/server";
import { updateAccountBalance } from "@/lib/netWorth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { balance?: number } | null;

  if (typeof body?.balance !== "number" || !Number.isFinite(body.balance)) {
    return NextResponse.json({ error: "balance (number) is required" }, { status: 400 });
  }

  const account = await updateAccountBalance(id, body.balance);
  return NextResponse.json(account);
}
