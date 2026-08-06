import Card from "@/components/Card";

export default function ConnectGoogleCalendar({ error }: { error?: string }) {
  return (
    <Card title="Calendar">
      <p className="mb-3 text-sm text-ink-2">
        Connect your Google Calendar to see this week&apos;s events here, and to have timed tasks
        show up on your calendar automatically.
      </p>
      {error && <p className="mb-3 text-sm text-danger">Couldn&apos;t connect: {error}</p>}
      <a
        href="/api/google/connect"
        className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
      >
        Connect Google Calendar
      </a>
    </Card>
  );
}
