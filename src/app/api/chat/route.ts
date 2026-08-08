import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { getCompletedTasks, getOpenTasks, getTaskById, localDateKey, splitTasksByWindow, type Task } from "@/lib/tasks";
import { completeTask, createTask, deleteTask, rescheduleTask } from "@/lib/taskActions";
import { isGoogleConnected, listWeekEvents } from "@/lib/google";
import { CATEGORIES } from "@/lib/colors";
import { computeTotal, getAccountByName, getNetWorthAccounts, updateAccountBalance } from "@/lib/netWorth";
import {
  createRecurringPayment,
  deleteRecurringPaymentByName,
  getRecurringPayments,
  isDueThisWeek,
} from "@/lib/recurringPayments";
import { getJournalEntries, upsertJournalEntry } from "@/lib/tradingJournal";
import { createSelfEntry, getSelfEntries, type EntryType } from "@/lib/selfEntries";

const MODEL = "claude-opus-5";
const MAX_ITERATIONS = 6;

const TOOLS: Tool[] = [
  {
    name: "list_tasks",
    description:
      "List the user's open tasks (grouped into Today and This Week) plus how many are completed. Call this before answering any question about what's on the user's list, and before completing or rescheduling a task if you don't already know its id.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_week_events",
    description:
      "List the user's Google Calendar events for the next 7 days. Call this to answer questions about the user's schedule or calendar.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_task",
    description:
      "Create a new task. If given a due_time, this also creates a matching event on the user's Google Calendar. Leave due_date out entirely for a 'sometime this week, no specific day' brain-dump task.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short task title" },
        due_date: { type: "string", description: "Date in YYYY-MM-DD. Omit for no specific day." },
        due_time: {
          type: "string",
          description: "24-hour HH:MM, in the user's local timezone. Only meaningful if due_date is also set.",
        },
        priority: { type: "string", enum: ["low", "med", "high"], description: "Defaults to med." },
        category: { type: "string", enum: CATEGORIES, description: "Defaults to general." },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as done. Requires the task's id -- call list_tasks first if you don't have it.",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "string", description: "The task's id, from list_tasks." } },
      required: ["task_id"],
    },
  },
  {
    name: "delete_task",
    description:
      "Permanently remove a task, e.g. because the user cancelled it or asked to take it off their list. If it has a linked Google Calendar event, that's removed too. Requires the task's id (call list_tasks first if you don't have it).",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "string", description: "The task's id, from list_tasks." } },
      required: ["task_id"],
    },
  },
  {
    name: "reschedule_task",
    description:
      "Change when a task is due. Only include the fields you want to change -- omitted fields keep their current value. Requires the task's id (call list_tasks first if you don't have it). If the task has a linked Google Calendar event, it's updated to match.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task's id, from list_tasks." },
        due_date: { type: "string", description: "New date in YYYY-MM-DD. Omit to keep the current date." },
        due_time: {
          type: "string",
          description: "New 24-hour HH:MM in the user's local timezone. Omit to keep the current time, or pass an empty string to clear it.",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "list_net_worth",
    description:
      "List every tracked net worth account (HSBC current account, HSBC credit card, AMP trading, etc.) with its balance, and the total net worth. Call this to answer questions about balances or net worth.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "update_account_balance",
    description:
      "Update the balance of a manually-tracked net worth account (AMP Trading, HSBC Current Account, HSBC Credit Card). Use when the user tells you a new balance, e.g. 'my trading balance is now 12,400' or 'my HSBC current account is 850'.",
    input_schema: {
      type: "object",
      properties: {
        account_name: {
          type: "string",
          description: "Exact account name: 'AMP Trading', 'HSBC Current Account', or 'HSBC Credit Card'.",
        },
        balance: {
          type: "number",
          description: "The new balance. For HSBC Credit Card, use the positive amount owed (e.g. 240, not -240).",
        },
      },
      required: ["account_name", "balance"],
    },
  },
  {
    name: "list_recurring_payments",
    description:
      "List every tracked recurring direct debit/subscription, which are due within the next 7 days, and the total monthly cost. Call this to answer questions about upcoming bills or recurring spending.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_recurring_payment",
    description: "Add a new recurring direct debit or subscription to track.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Payment name, e.g. 'Netflix'." },
        amount: { type: "number", description: "Amount taken each month." },
        day_of_month: { type: "number", description: "Day of the month it's collected, 1-31." },
        account: {
          type: "string",
          enum: ["HSBC Current Account", "HSBC Credit Card"],
          description: "Which account it's taken from. Defaults to HSBC Current Account if unsure.",
        },
      },
      required: ["name", "amount", "day_of_month"],
    },
  },
  {
    name: "delete_recurring_payment",
    description: "Stop tracking a recurring payment, e.g. because it was cancelled.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Exact payment name, from list_recurring_payments." } },
      required: ["name"],
    },
  },
  {
    name: "log_trading_journal_entry",
    description:
      "Log a trading journal entry, usually from a summary the user pastes from their separate trading journal. Extract whether they traded, the day's PnL, and a concise summary from whatever raw text they give you -- don't require a fixed format. Logging this also updates the AMP Trading balance by the PnL amount, so don't separately call update_account_balance for the same change.",
    input_schema: {
      type: "object",
      properties: {
        entry_date: { type: "string", description: "Date in YYYY-MM-DD. Defaults to today if omitted." },
        traded: { type: "boolean", description: "Whether the user actually traded that day." },
        pnl: {
          type: "number",
          description: "The day's profit/loss as stated in the summary. Omit or use 0 on a no-trade day.",
        },
        summary: {
          type: "string",
          description: "A concise summary of the trading day, extracted from what the user gave you.",
        },
      },
      required: ["traded", "summary"],
    },
  },
  {
    name: "list_trading_journal_entries",
    description:
      "List recent trading journal entries (date, traded, pnl, summary). Call this to answer questions about past trading days or to synthesize a weekly/monthly recap.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "add_self_entry",
    description:
      "Log a personal entry in the Self section -- a journal/reflection note, a goal, a habit, or an idea. Use whenever the user tells you something that fits one of these, even in passing conversation.",
    input_schema: {
      type: "object",
      properties: {
        entry_type: {
          type: "string",
          enum: ["journal", "goal", "habit", "idea"],
          description: "Which kind of entry this is.",
        },
        content: { type: "string", description: "The entry text, in the user's own words where possible." },
      },
      required: ["entry_type", "content"],
    },
  },
  {
    name: "list_self_entries",
    description:
      "List recent Self entries (journal, goals, habits, ideas). Call this to answer questions about past entries or recall something the user logged before.",
    input_schema: {
      type: "object",
      properties: {
        entry_type: {
          type: "string",
          enum: ["journal", "goal", "habit", "idea"],
          description: "Only return entries of this type. Omit to return all types.",
        },
      },
      required: [],
    },
  },
];

function summarizeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    due_date: task.due_date,
    due_time: task.due_time,
    priority: task.priority,
    category: task.category,
  };
}

function buildSystemPrompt(timeZone: string): string {
  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  });
  const currentTime = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  return `You are a helpful assistant embedded in the user's personal task and calendar dashboard. Right now it is ${currentTime} on ${today}. The user's timezone is ${timeZone} -- always interpret and produce due_time values in that timezone.

When the user gives a time without a date (e.g. "add a meeting at 1am"), use today's date if that time hasn't happened yet today, otherwise use tomorrow's date.

Use the tools to look up or change the user's tasks and calendar before answering -- don't guess what's scheduled or already invent task ids. When you take an action (adding, completing, rescheduling a task), briefly confirm what you did in plain language.

Keep replies short and conversational, like a text message -- this is a small chat widget on a phone screen.`;
}

const MUTATING_TOOLS = new Set([
  "add_task",
  "complete_task",
  "delete_task",
  "reschedule_task",
  "update_account_balance",
  "add_recurring_payment",
  "delete_recurring_payment",
  "log_trading_journal_entry",
  "add_self_entry",
]);

async function executeTool(name: string, input: Record<string, unknown>, timeZone: string): Promise<unknown> {
  switch (name) {
    case "list_tasks": {
      const [open, completed] = await Promise.all([getOpenTasks(), getCompletedTasks()]);
      const { today, week } = splitTasksByWindow(open);
      return {
        today: today.map(summarizeTask),
        week: week.map(summarizeTask),
        completedCount: completed.length,
      };
    }
    case "list_week_events": {
      const connected = await isGoogleConnected();
      if (!connected) {
        return { connected: false, message: "Google Calendar isn't connected yet." };
      }
      const events = await listWeekEvents();
      return {
        connected: true,
        events: events.map((e) => ({ title: e.title, start: e.start, end: e.end, allDay: e.allDay })),
      };
    }
    case "add_task": {
      const title = String(input.title ?? "").trim();
      if (!title) return { error: "title is required" };
      const task = await createTask(
        {
          title,
          due_date: (input.due_date as string | undefined) || null,
          due_time: (input.due_time as string | undefined) || null,
          priority: (input.priority as "low" | "med" | "high" | undefined) ?? "med",
          category: (input.category as (typeof CATEGORIES)[number] | undefined) ?? "general",
        },
        timeZone,
      );
      return { task: summarizeTask(task) };
    }
    case "complete_task": {
      const taskId = String(input.task_id ?? "");
      if (!taskId) return { error: "task_id is required" };
      const task = await completeTask(taskId, true);
      return { task: summarizeTask(task) };
    }
    case "delete_task": {
      const taskId = String(input.task_id ?? "");
      if (!taskId) return { error: "task_id is required" };
      await deleteTask(taskId);
      return { deleted: true };
    }
    case "reschedule_task": {
      const taskId = String(input.task_id ?? "");
      if (!taskId) return { error: "task_id is required" };
      const current = await getTaskById(taskId);
      if (!current) return { error: `No task found with id ${taskId}` };
      const due_date = input.due_date !== undefined ? ((input.due_date as string) || null) : current.due_date;
      const due_time = input.due_time !== undefined ? ((input.due_time as string) || null) : current.due_time;
      const task = await rescheduleTask(taskId, due_date, due_time, timeZone);
      return { task: summarizeTask(task) };
    }
    case "list_net_worth": {
      const accounts = await getNetWorthAccounts();
      return {
        accounts: accounts.map((a) => ({ name: a.name, kind: a.kind, source: a.source, balance: a.balance })),
        total: computeTotal(accounts),
      };
    }
    case "update_account_balance": {
      const accountName = String(input.account_name ?? "");
      const balance = Number(input.balance);
      if (!accountName || !Number.isFinite(balance)) {
        return { error: "account_name and a numeric balance are required" };
      }
      const existing = await getAccountByName(accountName);
      if (!existing) return { error: `No account found named "${accountName}"` };
      if (existing.source !== "manual") {
        return { error: `"${accountName}" syncs automatically and can't be updated manually` };
      }
      const account = await updateAccountBalance(existing.id, balance);
      return { account: { name: account.name, balance: account.balance } };
    }
    case "list_recurring_payments": {
      const payments = await getRecurringPayments();
      return {
        payments: payments.map((p) => ({
          name: p.name,
          amount: p.amount,
          day_of_month: p.day_of_month,
          account: p.account,
          due_this_week: isDueThisWeek(p.day_of_month),
        })),
        monthly_total: payments.reduce((sum, p) => sum + p.amount, 0),
      };
    }
    case "add_recurring_payment": {
      const name = String(input.name ?? "").trim();
      const amount = Number(input.amount);
      const dayOfMonth = Number(input.day_of_month);
      const account = (input.account as string | undefined) || "HSBC Current Account";
      if (!name || !Number.isFinite(amount) || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
        return { error: "name, a numeric amount, and day_of_month (1-31) are required" };
      }
      const payment = await createRecurringPayment({ name, amount, day_of_month: dayOfMonth, account });
      return { payment };
    }
    case "delete_recurring_payment": {
      const name = String(input.name ?? "").trim();
      if (!name) return { error: "name is required" };
      await deleteRecurringPaymentByName(name);
      return { ok: true };
    }
    case "log_trading_journal_entry": {
      const traded = Boolean(input.traded);
      const summary = String(input.summary ?? "").trim();
      if (!summary) return { error: "summary is required" };
      const entryDate = (input.entry_date as string | undefined) || localDateKey(new Date());
      const pnl = input.pnl !== undefined && input.pnl !== null ? Number(input.pnl) : null;
      if (pnl !== null && !Number.isFinite(pnl)) return { error: "pnl must be a number" };

      if (pnl) {
        const account = await getAccountByName("AMP Trading");
        if (account) {
          await updateAccountBalance(account.id, account.balance + pnl);
        }
      }

      const entry = await upsertJournalEntry({ entry_date: entryDate, traded, summary, pnl });
      return { entry };
    }
    case "list_trading_journal_entries": {
      const entries = await getJournalEntries(30);
      return { entries };
    }
    case "add_self_entry": {
      const entryType = input.entry_type as EntryType | undefined;
      const content = String(input.content ?? "").trim();
      if (!entryType) return { error: "entry_type is required" };
      if (!content) return { error: "content is required" };
      const entry = await createSelfEntry({ entry_type: entryType, content });
      return { entry };
    }
    case "list_self_entries": {
      const entryType = input.entry_type as EntryType | undefined;
      const entries = await getSelfEntries(50);
      return { entries: entryType ? entries.filter((e) => e.entry_type === entryType) : entries };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    messages?: MessageParam[];
    time_zone?: string;
  } | null;

  const inputMessages = body?.messages;
  const timeZone = body?.time_zone || "UTC";

  if (!inputMessages || inputMessages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const anthropic = new Anthropic();
  const conversation: MessageParam[] = [...inputMessages];
  let mutated = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: buildSystemPrompt(timeZone),
      tools: TOOLS,
      output_config: { effort: "low" },
      messages: conversation,
    });

    conversation.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const text = response.content.find((b) => b.type === "text")?.text ?? "";
      return NextResponse.json({ reply: text, messages: conversation, mutated });
    }

    const toolResults: ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (MUTATING_TOOLS.has(block.name)) mutated = true;
      try {
        const result = await executeTool(block.name, block.input as Record<string, unknown>, timeZone);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      } catch (error) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: error instanceof Error ? error.message : "Tool failed",
          is_error: true,
        });
      }
    }
    conversation.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({ error: "Too many tool calls in a row" }, { status: 500 });
}
