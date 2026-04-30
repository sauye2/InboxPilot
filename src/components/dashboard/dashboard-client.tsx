"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Play, ShieldCheck, X } from "lucide-react";
import type { EmailMessage } from "@/types/email";
import type { TriageMode, TriageResult, TriagedEmail } from "@/types/triage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ModeSelector } from "@/components/dashboard/mode-selector";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { PriorityQueue } from "@/components/email/priority-queue";
import { analyzeInbox, compareTriagedEmail, summarizeInbox } from "@/lib/triage/analyze-inbox";
import { compactEmailText } from "@/lib/email/clean-email-text";
import { mockEmails } from "@/lib/mock/mock-emails";

type InboxSource = "mock" | "gmail";
type OpenAIConsentPreference = "accepted" | "declined" | null;

type DashboardClientProps = {
  hasGmailConnection?: boolean;
  initialAIProcessingEnabled?: boolean;
  initialOpenAITriageEnabled?: boolean;
};

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardClient({
  hasGmailConnection = false,
  initialAIProcessingEnabled = false,
  initialOpenAITriageEnabled = false,
}: DashboardClientProps) {
  const [mode, setMode] = useState<TriageMode>("job_search");
  const [hasRun, setHasRun] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [source, setSource] = useState<InboxSource>("mock");
  const [activeEmails, setActiveEmails] = useState<EmailMessage[]>(mockEmails);
  const [openAIItems, setOpenAIItems] = useState<TriagedEmail[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingScan, setPendingScan] = useState(false);
  const [greeting] = useState(getTimeGreeting);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("needs_action");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [reviewState, setReviewState] = useState<Record<string, Partial<TriageResult>>>({});
  const initialConsent: OpenAIConsentPreference =
    initialAIProcessingEnabled && initialOpenAITriageEnabled ? "accepted" : null;

  const analyzed = useMemo(() => {
    if (!openAIItems) {
      return analyzeInbox(activeEmails, mode, reviewState);
    }

    const items = openAIItems
      .map((item) => ({
        ...item,
        triage: {
          ...item.triage,
          reviewed: reviewState[item.email.id]?.reviewed ?? item.triage.reviewed,
          pinned: reviewState[item.email.id]?.pinned ?? item.triage.pinned,
          snoozedUntil:
            reviewState[item.email.id]?.snoozedUntil ?? item.triage.snoozedUntil,
        },
      }))
      .sort(sortItems);

    return {
      items,
      summary: summarizeInbox(items),
    };
  }, [activeEmails, mode, openAIItems, reviewState]);

  const visibleSummary = useMemo(
    () =>
      hasRun
        ? analyzed.summary
        : {
            totalEmails: 0,
            actionRequiredCount: 0,
            highPriorityCount: 0,
            upcomingDeadlineCount: 0,
            unreadImportantCount: 0,
            topCategories: [],
          },
    [analyzed.summary, hasRun],
  );

  const visibleItems = useMemo(
    () => (hasRun ? analyzed.items : []),
    [analyzed.items, hasRun],
  );

  const categoryCounts = useMemo(
    () =>
      visibleItems.reduce<Record<string, number>>((acc, item) => {
        acc[item.triage.category] = (acc[item.triage.category] ?? 0) + 1;
        return acc;
      }, {}),
    [visibleItems],
  );

  const filteredItems = useMemo(
    () =>
      visibleItems
        .filter((item) => {
          if (selectedFilter === "scanned") return true;
          if (selectedFilter === "needs_action") return item.triage.requiresAction;
          if (selectedFilter === "priority_high") return item.triage.priority === "high";
          return item.triage.category === selectedFilter;
        })
        .sort(sortItems),
    [visibleItems, selectedFilter],
  );

  function getOpenAIConsentPreference(): OpenAIConsentPreference {
    const preference = window.localStorage.getItem("inboxpilot-openai-email-consent");
    if (preference === "accepted" || preference === "declined") return preference;
    return initialConsent;
  }

  function runScan() {
    const preference = getOpenAIConsentPreference();

    if (!preference) {
      setPendingScan(true);
      setShowConsent(true);
      return;
    }

    void executeScan(preference === "accepted");
  }

  async function executeScan(useOpenAI: boolean) {
    setIsScanning(true);
    setScanError(null);

    try {
      let emails = source === "mock" ? mockEmails : activeEmails;

      if (source === "gmail") {
        const response = await fetch("/api/email-providers/gmail/messages");
        const payload = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to fetch Gmail messages.");
        }

        emails = payload.messages;
      }

      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          emails,
          useOpenAI,
        }),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Scan failed.");
      }

      setOpenAIItems(payload.items);
      setActiveEmails(payload.items.map((item: TriagedEmail) => item.email));
      setTaskIds(payload.taskEmailIds ?? []);
      setHasRun(true);
      setSelectedId(null);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setIsScanning(false);
      setPendingScan(false);
    }
  }

  function updateReviewState(id: string, patch: Partial<TriageResult>) {
    setReviewState((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  function toggleReviewed(id: string) {
    const currentReviewed =
      analyzed.items.find((item) => item.email.id === id)?.triage.reviewed ?? false;
    const reviewed = !currentReviewed;
    updateReviewState(id, { reviewed });
    void saveReviewAction(id, reviewed ? "reviewed" : "unreviewed");
  }

  function pin(id: string) {
    const currentPinned =
      analyzed.items.find((item) => item.email.id === id)?.triage.pinned ?? false;
    const pinned = !currentPinned;
    updateReviewState(id, { pinned });
    void saveReviewAction(id, pinned ? "pinned" : "unpinned");
  }

  function addTask(id: string) {
    setTaskIds((current) => (current.includes(id) ? current : [...current, id]));
    void saveReviewAction(id, "task_created");
  }

  async function saveReviewAction(
    emailId: string,
    actionType:
      | "reviewed"
      | "unreviewed"
      | "pinned"
      | "unpinned"
      | "task_created",
  ) {
    if (!hasRun) return;

    await fetch("/api/review-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emailId, actionType }),
    });
  }

  async function saveOpenAIPreference(enabled: boolean) {
    await fetch("/api/user-preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        aiProcessingEnabled: enabled,
        openAITriageEnabled: enabled,
        openAIReplySuggestionsEnabled: enabled,
      }),
    });
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:py-12">
      <section className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] xl:items-stretch">
        <div className="space-y-6">
          <div className="liquid-glass-dark relative rounded-2xl p-6 text-[#f7f6f1] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8bd3c7]/20 bg-[#8bd3c7]/12 px-3 py-1.5 text-xs font-medium text-[#8bd3c7]">
              <ShieldCheck className="size-3.5" />
              Local-first MVP with mock inbox data
            </div>

            <h1 className="-ml-2 mt-4 max-w-3xl text-6xl font-semibold leading-none tracking-normal sm:text-7xl">
              {greeting}.
              <span className="ml-1.5 mt-1.5 block text-3xl leading-tight sm:text-4xl">
                Here is your email summary.
              </span>
            </h1>
            <div className="mt-3 flex flex-col gap-5 lg:block">
              <p className="max-w-[calc(100%-10rem)] text-lg leading-8 text-white/64">
                Choose a workflow, scan realistic mock emails, and keep the next
                actions that matter visible without connecting a real inbox.
              </p>
            </div>
            <div
              style={{
                position: "absolute",
                right: "0.75rem",
                bottom: "0.75rem",
              }}
            >
              <Button
                size="lg"
                onClick={runScan}
                disabled={isScanning}
                className="h-10 w-fit shrink-0 rounded-full border border-white/70 bg-[#fffdf7]/92 px-4 text-[#141817] shadow-lg shadow-black/18 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-xl"
              >
                {isScanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4 fill-[#141817]" />
                )}
                {isScanning
                  ? source === "gmail"
                    ? "Scanning Gmail Inbox"
                    : "Scanning Mock Inbox"
                  : hasRun
                    ? "Run Scan again"
                    : "Run Scan"}
              </Button>
            </div>
          </div>

          <div className="liquid-glass rounded-xl border-black/10 bg-white/58 p-2">
            <div className="relative grid h-10 grid-cols-2 overflow-hidden rounded-lg border border-black/5 bg-[#ede9df]/66 p-1">
              <span
                className="absolute bottom-1 top-1 rounded-md border border-white/70 bg-[#fffdf7]/92 shadow-lg shadow-black/10 transition-transform duration-300 ease-out"
                style={{
                  left: "0.25rem",
                  width: "calc((100% - 0.5rem) / 2)",
                  transform: `translateX(${source === "gmail" ? 100 : 0}%)`,
                }}
              />
            {(["mock", "gmail"] as const).map((option) => {
              const selected = source === option;
              const disabled = option === "gmail" && !hasGmailConnection;

              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setSource(option);
                    setActiveEmails(option === "mock" ? mockEmails : []);
                    setOpenAIItems(null);
                    setHasRun(false);
                    setSelectedId(null);
                  }}
                    className={`relative z-10 flex h-full items-center justify-center rounded-md text-sm font-semibold transition-colors duration-300 ${
                      selected
                        ? "text-[#141817]"
                        : "text-[#59635f] hover:text-[#141817]"
                    } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    {option === "mock" ? "Mock Inbox" : "Gmail Inbox"}
                  </button>
                );
              })}
            </div>
          </div>

          {scanError ? (
            <div className="rounded-xl border border-[#c86a3b]/20 bg-[#fff1e8] px-4 py-3 text-sm text-[#8b4d2c]">
              {scanError}
            </div>
          ) : null}

          <ModeSelector
            value={mode}
            onChange={(next) => {
              setMode(next);
              setHasRun(false);
              setOpenAIItems(null);
              setSelectedId(null);
              setSelectedFilter("needs_action");
              setTaskIds([]);
            }}
          />

          <section>
            {isScanning ? (
              <ScanningState />
            ) : (
              <SummaryCards
                summary={visibleSummary}
                mode={mode}
                selectedFilter={selectedFilter}
                categoryCounts={categoryCounts}
                onSelectFilter={(filter) => {
                  setSelectedId(null);
                  setSelectedFilter((current) =>
                    current === filter && filter !== "scanned"
                      ? "needs_action"
                      : filter,
                  );
                }}
              />
            )}
          </section>
        </div>

        <div className="flex min-h-full">
          {hasRun ? (
            <PriorityQueue
              items={filteredItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleReviewed={toggleReviewed}
              onPin={pin}
              onBack={() => setSelectedId(null)}
              onAddTask={addTask}
            />
          ) : (
            <div className="liquid-glass flex min-h-[720px] flex-1 flex-col items-center justify-center rounded-2xl border-dashed border-black/15 bg-white/48 p-10 text-center ring-1 ring-white/40">
              <h2 className="text-lg font-semibold text-[#141817]">
                Ready when you are
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#68716d]">
                Run Scan to process the local mock inbox. No email account is
                connected and no credentials are required.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <TaskList
          tasks={analyzed.items.filter((item) => taskIds.includes(item.email.id))}
          onToggleReviewed={toggleReviewed}
          onRemove={(id) =>
            setTaskIds((current) => current.filter((taskId) => taskId !== id))
          }
        />
      </section>

      {showConsent ? (
        <OpenAIConsentDialog
          onAccept={() => {
            window.localStorage.setItem("inboxpilot-openai-email-consent", "accepted");
            void saveOpenAIPreference(true);
            setShowConsent(false);
            if (pendingScan) void executeScan(true);
          }}
          onLocalOnly={() => {
            window.localStorage.setItem("inboxpilot-openai-email-consent", "declined");
            void saveOpenAIPreference(false);
            setShowConsent(false);
            if (pendingScan) void executeScan(false);
          }}
          onCancel={() => {
            setShowConsent(false);
            setPendingScan(false);
          }}
        />
      ) : null}
    </main>
  );
}

function OpenAIConsentDialog({
  onAccept,
  onLocalOnly,
  onCancel,
}: {
  onAccept: () => void;
  onLocalOnly: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#111614]/58 px-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="liquid-glass-dark max-w-lg rounded-2xl p-6 text-[#f7f6f1] shadow-2xl shadow-black/30"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="openai-consent-title"
      >
        <p className="text-sm font-semibold uppercase text-[#8bd3c7]">
          OpenAI email analysis
        </p>
        <h2
          id="openai-consent-title"
          className="mt-2 text-3xl font-semibold tracking-normal text-[#f7f6f1]"
        >
          Allow OpenAI-assisted scanning?
        </h2>
        <p className="mt-4 text-sm leading-6 text-white/78">
          OpenAI helps parse message context and turn emails into clearer next
          steps. If you opt out, InboxPilot will scan with local rules only.
          <span className="block text-white/54">You can change this in Settings.</span>
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onLocalOnly}
            className="h-9 border-white/18 bg-white/82 px-4 text-[#141817] hover:bg-white"
          >
            Opt-Out
          </Button>
          <Button
            type="button"
            onClick={onAccept}
            className="h-9 bg-[#f7f6f1] px-4 text-[#141817] hover:bg-white"
          >
            Opt-In (Recommended)
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskList({
  tasks,
  onToggleReviewed,
  onRemove,
}: {
  tasks: TriagedEmail[];
  onToggleReviewed: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = tasks.find((task) => task.email.id === selectedTaskId) ?? null;

  async function generateReply(emailId: string) {
    setDraftingId(emailId);
    setDraftError(null);

    try {
      const response = await fetch("/api/reply-suggestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emailId, tone: "professional" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to draft reply.");
      }

      setDrafts((current) => ({
        ...current,
        [emailId]: payload.suggestion.body,
      }));
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : "Unable to draft reply.",
      );
    } finally {
      setDraftingId(null);
    }
  }

  return (
    <section className="liquid-glass rounded-2xl border-black/10 bg-white/64 p-5 shadow-xl shadow-black/8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal text-[#141817]">
            Task list
          </h2>
          <p className="mt-1 text-sm text-[#4a504d]">
            Saved email follow-ups with editable AI draft space.
          </p>
        </div>
        <span className="rounded-full border border-black/10 bg-[#fffdf7]/70 px-3 py-1 text-sm font-medium text-[#68716d]">
          {tasks.length} tasks
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="liquid-glass mt-5 rounded-xl border-white/60 bg-[#fffdf7]/36 p-8 text-center shadow-inner ring-1 ring-white/45">
          <p className="font-medium text-[#141817]">No email tasks yet</p>
          <p className="mt-2 text-sm text-[#68716d]">
            Open a priority email and add it to your task list.
          </p>
        </div>
      ) : selectedTask ? (
        <div className="animate-in fade-in slide-in-from-bottom-3 mt-5 rounded-xl border border-black/10 bg-[#fffdf7]/78 p-4 duration-300">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[#68716d]">
                Selected task
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[#141817]">
                {selectedTask.email.subject}
              </h3>
              <p className="mt-1 text-sm text-[#68716d]">
                {selectedTask.email.senderName} &lt;{selectedTask.email.senderEmail}&gt;
              </p>
            </div>
            <button
              type="button"
              aria-label="Close selected task"
              className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[#4a504d] transition hover:bg-white hover:text-[#141817]"
              onClick={() => setSelectedTaskId(null)}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-xl bg-[#f1f0ea] p-4">
              <p className="text-xs font-semibold uppercase text-[#68716d]">
                Original email
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#33423d]">
                {compactEmailText(selectedTask.email.body || selectedTask.email.snippet)}
              </p>
            </div>
            <div className="rounded-xl border border-black/8 bg-white/62 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-[#68716d]">
                  Draft reply
                </p>
                <button
                  className="rounded-full border border-black/10 bg-[#fffdf7]/80 px-3 py-1.5 text-xs font-semibold text-[#33423d] transition hover:bg-white"
                  disabled={draftingId === selectedTask.email.id}
                  onClick={() => generateReply(selectedTask.email.id)}
                >
                  {draftingId === selectedTask.email.id ? "Drafting..." : "Generate draft"}
                </button>
              </div>
              <textarea
                value={drafts[selectedTask.email.id] ?? ""}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [selectedTask.email.id]: event.target.value,
                  }))
                }
                placeholder="Generate a draft, then edit it here."
                className="mt-3 min-h-44 w-full resize-y rounded-lg border border-black/10 bg-[#fffdf7]/85 p-3 text-sm leading-6 text-[#33423d] outline-none transition focus:border-[#0e6f68]/40 focus:ring-2 focus:ring-[#8bd3c7]/30"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-sm"
              onClick={() => onToggleReviewed(selectedTask.email.id)}
            >
              {selectedTask.triage.reviewed ? "Unmark reviewed" : "Mark reviewed"}
            </button>
            <button
              className="rounded-full border border-[#c86a3b]/20 bg-[#fff1e8] px-3 py-1.5 text-sm font-medium text-[#9a4d2c]"
              onClick={() => {
                onRemove(selectedTask.email.id);
                setSelectedTaskId(null);
              }}
            >
              Remove from tasks
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-2">
          {draftError ? (
            <div className="rounded-xl border border-[#c86a3b]/20 bg-[#fff1e8] px-4 py-3 text-sm text-[#8b4d2c]">
              {draftError}
            </div>
          ) : null}
          {tasks.map((item) => (
            <button
              key={item.email.id}
              type="button"
              onClick={() => setSelectedTaskId(item.email.id)}
              className={`flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-[#fffdf7]/78 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md ${
                item.triage.reviewed ? "opacity-60" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#141817]">
                  {item.email.senderName}
                </p>
                <p className="mt-1 truncate text-sm text-[#4a504d]">
                  {item.triage.suggestedNextAction}
                </p>
              </div>
              {item.triage.reviewed ? (
                <CheckCircle2 className="size-5 shrink-0 text-[#0e6f68]" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ScanningState() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-[112px] rounded-xl bg-white/70" />
      ))}
    </div>
  );
}

function sortItems(a: TriagedEmail, b: TriagedEmail) {
  return compareTriagedEmail(a, b);
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: response.ok
        ? "The server returned an unreadable response."
        : "The scan service returned an unreadable error. Please try again.",
    };
  }
}
