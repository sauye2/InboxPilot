"use client";

import { Bell, CheckCircle2, Clipboard, ListPlus, Pin, TimerReset } from "lucide-react";
import type { TriagedEmail } from "@/types/triage";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CategoryBadge, PriorityBadge } from "@/components/email/triage-badges";

type EmailDetailPanelProps = {
  item: TriagedEmail | null;
  onMarkReviewed: (id: string) => void;
  onSnooze: (id: string) => void;
  onPin: (id: string) => void;
};

export function EmailDetailPanel({
  item,
  onMarkReviewed,
  onSnooze,
  onPin,
}: EmailDetailPanelProps) {
  if (!item) {
    return (
      <aside className="liquid-glass flex min-h-[420px] flex-col items-center justify-center rounded-2xl border-dashed border-black/15 bg-white/64 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg bg-[#e7f1ec]">
          <Bell className="size-5 text-[#0e6f68]" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-[#141817]">
          Select an email
        </h2>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[#68716d]">
          Open a priority item to see the local analysis, action summary, and
          review controls.
        </p>
      </aside>
    );
  }

  const { email, triage } = item;

  return (
    <aside className="liquid-glass rounded-2xl border-black/10 bg-white/66 shadow-xl shadow-black/10">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase text-[#68716d]">
              Email detail
            </p>
            <h2 className="mt-2 text-xl font-semibold leading-tight text-[#141817]">
              {email.subject}
            </h2>
            <p className="mt-2 text-sm text-[#68716d]">
              {email.senderName} &lt;{email.senderEmail}&gt;
            </p>
          </div>
          <Button
            variant={triage.pinned ? "default" : "outline"}
            size="icon"
            aria-label={triage.pinned ? "Unpin email" : "Pin email"}
            onClick={() => onPin(email.id)}
          >
            <Pin className="size-4" />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <PriorityBadge priority={triage.priority} />
          <CategoryBadge category={triage.category} />
          {triage.deadline ? (
            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
              {triage.deadline}
            </span>
          ) : null}
          {triage.requiresAction ? (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
              Action
            </span>
          ) : null}
        </div>
      </div>

      <Separator />

      <div className="space-y-5 p-5">
        <InfoBlock label="AI-ready summary" value={triage.actionSummary} />
        <InfoBlock label="Suggested next action" value={triage.suggestedNextAction} />
        <InfoBlock label="Why this was prioritized" value={triage.reason} />
        <InfoBlock
          label="Confidence"
          value={`${Math.round(triage.confidence * 100)}% local rule confidence`}
        />

        <div>
          <p className="text-xs font-medium uppercase text-[#68716d]">
            Original email
          </p>
          <p className="mt-2 rounded-lg bg-[#fffdf7]/78 p-3 text-sm leading-6 text-[#33423d]">
            {email.body}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => onMarkReviewed(email.id)}>
            <CheckCircle2 className="size-4" />
            Mark reviewed
          </Button>
          <Button variant="outline" onClick={() => onSnooze(email.id)}>
            <TimerReset className="size-4" />
            Snooze
          </Button>
          <Button variant="outline" onClick={() => navigator.clipboard?.writeText(triage.suggestedNextAction)}>
            <Clipboard className="size-4" />
            Copy suggested reply
          </Button>
          <Button variant="outline">
            <ListPlus className="size-4" />
            Add to Tasks
          </Button>
        </div>
      </div>
    </aside>
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
