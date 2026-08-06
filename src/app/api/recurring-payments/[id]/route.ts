import { NextRequest, NextResponse } from "next/server";
import { deleteRecurringPayment } from "@/lib/recurringPayments";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteRecurringPayment(id);
  return NextResponse.json({ ok: true });
}
