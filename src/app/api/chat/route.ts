import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { getCompletedTasks, getOpenTasks, getTaskById, splitTasksByWindow, type Task } from "@/lib/tasks";
import { completeTask, createTask, rescheduleTask } from "@/lib/taskActions";
import { isGoogleConnected, listWeekEvents } from "@/lib/google";
import { CATEGORIES } from "@/lib/colors";
import { computeTotal, getAccountByName, getNetWorthAccounts, updateAccountBalance } from "@/lib/netWorth";

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
      "Update the balance of a manually-tracked net worth account (currently only the AMP Trading account -- HSBC accounts sync automatically and can't be set this way). Use when the user tells you their new balance, e.g. 'my trading balance is now 12,400'.",
    input_schema: {
      type: "object",
      properties: {
        account_name: { type: "string", description: "Exact account name, e.g. 'AMP Trading'." },
        balance: { type: "number", description: "The new balance." },
      },
      required: ["account_name", "balance"],
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
  return `You are a helpful assistant embedded in the user's personal task and calendar dashboard. Today is ${today}. The user's timezone is ${timeZone} -- always interpret and produce due_time values in that timezone.

Use the tools to look up or change the user's tasks and calendar before answering -- don't guess what's scheduled or already invent task ids. When you take an action (adding, completing, rescheduling a task), briefly confirm what you did in plain language.

Keep replies short and conversational, like a text message -- this is a small chat widget on a phone screen.`;
}

const MUTATING_TOOLS = new Set(["add_task", "complete_task", "reschedule_task", "update_account_balance"]);

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
