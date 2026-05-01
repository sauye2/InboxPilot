"use client";

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Circle,
  ListPlus,
  Pin,
  Trash2,
} from "lucide-react";
import type { PriorityLevel, TriageMode, TriagedEmail } from "@/types/triage";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ActionBadge,
  CategoryBadge,
  DeadlineBadge,
  PriorityBadge,
} from "@/components/email/triage-badges";
import { compactEmailText } from "@/lib/email/clean-email-text";
import { getModeDefinition } from "@/lib/triage/modes";
import { cn } from "@/lib/utils";

type PriorityQueueProps = {
  items: TriagedEmail[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleReviewed: (id: string) => void;
  onPin: (id: string) => void;
  onBack: () => void;
  onAddTask: (id: string) => void;
  onDeleteEmail: (id: string) => void;
  mode: TriageMode;
  onFeedback: (
    id: string,
    patch: { categoryOverride?: string; priorityOverride?: PriorityLevel },
  ) => void;
};

export function PriorityQueue({
  items,
  selectedId,
  onSelect,
  onToggleReviewed,
  onPin,
  onBack,
  onAddTask,
  onDeleteEmail,
  mode,
  onFeedback,
}: PriorityQueueProps) {
  const selectedItem = items.find((item) => item.email.id === selectedId) ?? null;
  const categories = getModeDefinition(mode).categories;

  if (items.length === 0) {
    return (
      <div className="liquid-glass flex h-[720px] flex-1 flex-col items-center justify-center rounded-2xl border-dashed border-black/15 bg-white/64 p-8 text-center">
        <CheckCircle2 className="size-10 text-teal-700" />
        <h2 className="mt-4 text-base font-semibold text-[#141817]">
          Nothing matches these filters
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#68716d]">
          Loosen the filters or rerun triage in another mode to inspect a
          different priority model.
        </p>
      </div>
    );
  }

  return (
    <div className="liquid-glass flex h-[720px] flex-1 flex-col overflow-hidden rounded-2xl border-white/70 bg-white/34 p-5 shadow-2xl shadow-black/20 ring-1 ring-white/45">
      <div className="flex items-start justify-between border-b border-black/10 pb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal text-[#141817]">
            Priority actions
          </h2>
          <p className="mt-1 text-sm text-[#4a504d]">
            Emails most likely to need a reply or deadline check.
          </p>
        </div>
        <span className="rounded-full bg-[#f2c7ad] px-3 py-1 text-xs font-semibold text-[#9a4d2c]">
          {items.filter((item) => item.triage.priority === "high").length} urgent
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col transition-all duration-500 ease-out">
        {selectedItem ? (
          <EmailFocusView
            item={selectedItem}
            onBack={onBack}
            onToggleReviewed={onToggleReviewed}
            onAddTask={onAddTask}
            onDeleteEmail={onDeleteEmail}
            onPin={onPin}
            categories={categories}
            onFeedback={onFeedback}
          />
        ) : (
          <ScrollArea className="mt-4 h-full min-h-0 flex-1 pr-3">
            <div className="grid gap-3">
              {items.map((item) => (
                <QueueItem
                  key={item.email.id}
                  item={item}
                  onSelect={onSelect}
                  onToggleReviewed={onToggleReviewed}
                  onAddTask={onAddTask}
                  onDeleteEmail={onDeleteEmail}
                  categories={categories}
                  onFeedback={onFeedback}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function QueueItem({
  item,
  onSelect,
  onToggleReviewed,
  onAddTask,
  onDeleteEmail,
  categories,
  onFeedback,
}: {
  item: TriagedEmail;
  onSelect: (id: string) => void;
  onToggleReviewed: (id: string) => void;
  onAddTask: (id: string) => void;
  onDeleteEmail: (id: string) => void;
  categories: string[];
  onFeedback: (
    id: string,
    patch: { categoryOverride?: string; priorityOverride?: PriorityLevel },
  ) => void;
}) {
  const { email, triage } = item;

  return (
    <article
      className={cn(
        "group grid cursor-pointer gap-3 rounded-xl border border-black/10 bg-[#fffdf7]/78 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md",
        triage.reviewed && "opacity-65",
      )}
      onClick={() => onSelect(email.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {triage.reviewed ? (
              <CheckCircle2 className="size-4 text-[#0e6f68]" />
            ) : email.isRead ? (
              <Circle className="size-2.5 fill-slate-300 text-slate-300" />
            ) : (
              <Circle className="size-2.5 fill-teal-600 text-teal-600" />
            )}
            <p className="truncate text-sm font-semibold text-[#141817]">
              {email.senderName}
            </p>
          </div>
          <h3 className="mt-1 line-clamp-1 text-sm font-medium text-[#4a504d]">
            {email.subject}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <time className="block text-xs text-[#68716d]">
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(email.receivedAt))}
          </time>
          <PriorityBadge priority={triage.priority} />
        </div>
      </div>

      <p className="rounded-lg bg-[#f1f0ea] px-3 py-2 text-sm leading-6 text-[#33423d]">
        {triage.suggestedNextAction}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={triage.category} />
        {triage.deadline ? (
          <DeadlineBadge deadline={triage.deadline} icon={<CalendarClock className="size-3" />} />
        ) : null}
        {triage.requiresAction ? <ActionBadge /> : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-[#d9e8e4] bg-[#eef8f5] px-3 text-xs font-semibold text-[#0e6f68] hover:bg-[#dff3eb]"
            onClick={(event) => {
              event.stopPropagation();
              onToggleReviewed(email.id);
            }}
          >
            <CheckCircle2 className="size-3.5" />
            {triage.reviewed ? "Unmark reviewed" : "Mark reviewed"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-[#d9e8e4] bg-[#eef8f5] px-3 text-xs font-semibold text-[#0e6f68] hover:bg-[#dff3eb]"
            onClick={(event) => {
              event.stopPropagation();
              onAddTask(email.id);
            }}
          >
            <ListPlus className="size-3.5" />
            Add to task list
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <FeedbackControls
            emailId={email.id}
            category={triage.category}
            priority={triage.priority}
            categories={categories}
            onFeedback={onFeedback}
          />
          <button
            type="button"
            aria-label="Delete email"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[#e9b9a9] bg-[#fff1e8] text-[#b44927] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#ffe2d6] hover:text-[#8f341d]"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteEmail(email.id);
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmailFocusView({
  item,
  onBack,
  onToggleReviewed,
  onAddTask,
  onDeleteEmail,
  onPin,
  categories,
  onFeedback,
}: {
  item: TriagedEmail;
  onBack: () => void;
  onToggleReviewed: (id: string) => void;
  onAddTask: (id: string) => void;
  onDeleteEmail: (id: string) => void;
  onPin: (id: string) => void;
  categories: string[];
  onFeedback: (
    id: string,
    patch: { categoryOverride?: string; priorityOverride?: PriorityLevel },
  ) => void;
}) {
  const { email, triage } = item;

  return (
      <div className="animate-in fade-in slide-in-from-right-4 mt-4 duration-500">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back to priority emails
        </Button>
        <Button
          variant={triage.pinned ? "default" : "outline"}
          size="icon"
          aria-label={triage.pinned ? "Unpin email" : "Pin email"}
          onClick={() => onPin(email.id)}
        >
          <Pin className="size-4" />
        </Button>
      </div>

      <div className="mt-5 rounded-xl border border-black/10 bg-[#fffdf7]/78 p-5">
        <div className="liquid-glass rounded-xl border-white/70 bg-white/38 p-4 shadow-lg shadow-black/10 ring-1 ring-white/45">
          <p className="text-xs font-medium uppercase text-[#68716d]">
            Email detail
          </p>
          <h3 className="mt-2 text-2xl font-semibold leading-tight text-[#141817]">
            {email.subject}
          </h3>
          <p className="mt-2 text-sm text-[#68716d]">
            {email.senderName} &lt;{email.senderEmail}&gt;
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <CategoryBadge category={triage.category} />
            {triage.deadline ? (
              <DeadlineBadge deadline={triage.deadline} />
            ) : null}
          </div>
          <FeedbackControls
            emailId={email.id}
            category={triage.category}
            priority={triage.priority}
            categories={categories}
            onFeedback={onFeedback}
            className="mt-4"
          />
        </div>

        <div className="mt-6 grid gap-5">
          <InfoBlock label="Required next step" value={triage.suggestedNextAction} />
          <div>
            <p className="text-xs font-medium uppercase text-[#68716d]">
              Original email
            </p>
            <p className="mt-2 rounded-lg bg-[#f1f0ea] p-4 text-sm leading-6 text-[#33423d]">
              {compactEmailText(email.body || email.snippet)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <Button
            className="bg-[#141817] text-[#f7f6f1] hover:bg-[#27302d]"
            onClick={() => {
              onToggleReviewed(email.id);
              window.setTimeout(onBack, 180);
            }}
          >
            <CheckCircle2 className="size-4" />
            {triage.reviewed ? "Unmark reviewed" : "Mark reviewed"}
          </Button>
          <Button variant="outline" onClick={() => onAddTask(email.id)}>
            <ListPlus className="size-4" />
            Add to task list
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-[#e9b9a9] bg-[#fff1e8] text-[#b44927] hover:bg-[#ffe2d6] hover:text-[#8f341d]"
            onClick={() => onDeleteEmail(email.id)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeedbackControls({
  emailId,
  category,
  priority,
  categories,
  onFeedback,
  className,
}: {
  emailId: string;
  category: string;
  priority: PriorityLevel;
  categories: string[];
  onFeedback: (
    id: string,
    patch: { categoryOverride?: string; priorityOverride?: PriorityLevel },
  ) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      onClick={(event) => event.stopPropagation()}
    >
      <select
        aria-label="Wrong category: move email"
        value={category}
        onChange={(event) =>
          onFeedback(emailId, { categoryOverride: event.target.value })
        }
        className="h-8 rounded-full border border-black/10 bg-white/70 px-3 text-xs font-semibold text-[#33423d] outline-none transition hover:bg-white"
      >
        {categories.map((candidate) => (
          <option key={candidate} value={candidate}>
            {candidate}
          </option>
        ))}
      </select>
      <select
        aria-label="Not important: adjust priority"
        value={priority}
        onChange={(event) =>
          onFeedback(emailId, {
            priorityOverride: event.target.value as PriorityLevel,
          })
        }
        className="h-8 rounded-full border border-black/10 bg-white/70 px-3 text-xs font-semibold text-[#33423d] outline-none transition hover:bg-white"
      >
        <option value="high">High priority</option>
        <option value="medium">Medium priority</option>
        <option value="low">Low priority</option>
      </select>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[#68716d]">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[#33423d]">{value}</p>
    </div>
  );
}
