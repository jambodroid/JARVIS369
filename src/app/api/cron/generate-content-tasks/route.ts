import { NextRequest, NextResponse } from "next/server";
import { getContentItems, syncTaskForContentItem } from "@/lib/socialBusiness";
import { localDateKey } from "@/lib/tasks";

// Catches content items whose due_date is today but that weren't touched
// today (so createContentItem/updateContentItemStatus/setContentItemDueDate
// never got a chance to sync a task for them) -- e.g. a due date set days
// ago that's only relevant now.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayKey = localDateKey(new Date());
  const items = await getContentItems(200);
  const dueToday = items.filter((item) => item.due_date === todayKey);

  for (const item of dueToday) {
    try {
      await syncTaskForContentItem(item);
    } catch (error) {
      console.error(`Failed to sync task for content item ${item.id}`, error);
    }
  }

  return NextResponse.json({ ok: true, checked: dueToday.length });
}
