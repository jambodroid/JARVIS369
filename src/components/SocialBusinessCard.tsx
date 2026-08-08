import type { ContentItem, ContentStatus } from "@/lib/socialBusiness";
import Card from "@/components/Card";

const STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Idea",
  scripted: "Scripted",
  filmed: "Filmed",
  edited: "Edited",
  posted: "Posted",
};

const STATUS_CHIP_CLASS: Record<ContentStatus, string> = {
  idea: "bg-ink-3/15 text-ink-3",
  scripted: "bg-cat-blue/15 text-cat-blue",
  filmed: "bg-cat-purple/15 text-cat-purple",
  edited: "bg-cat-yellow/15 text-cat-yellow",
  posted: "bg-ok/15 text-ok",
};

const PERSONAL_BUCKET = "Personal";

function ItemRow({ item }: { item: ContentItem }) {
  return (
    <li className="rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-ink-0">{item.title}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${STATUS_CHIP_CLASS[item.status]}`}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </div>
      {item.platform && <p className="mt-0.5 font-mono text-xs text-ink-3">{item.platform}</p>}
    </li>
  );
}

function ClientGroup({ name, items }: { name: string; items: ContentItem[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-2">{name}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

export default function SocialBusinessCard({ items }: { items: ContentItem[] }) {
  const clientNames = Array.from(new Set(items.map((i) => i.client_name).filter((n): n is string => n !== null))).sort();
  const hasPersonal = items.some((i) => i.client_name === null);
  const groups = hasPersonal ? [...clientNames, PERSONAL_BUCKET] : clientNames;

  return (
    <Card title="Business" count={items.length}>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">Tell Jarvis about a client video or post to get started.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((name) => (
            <ClientGroup
              key={name}
              name={name}
              items={items.filter((i) => (name === PERSONAL_BUCKET ? i.client_name === null : i.client_name === name))}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
