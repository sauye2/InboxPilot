"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, Pencil, Play, Send, ShieldCheck, Trash2, X } from "lucide-react";
import type { EmailMessage } from "@/types/email";
import type { PriorityLevel, TaskState, TaskStatus, TriageMode, TriageResult, TriagedEmail } from "@/types/triage";
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
  const [taskStates, setTaskStates] = useState<TaskState[]>([]);
  const [reviewState, setReviewState] = useState<Record<string, Partial<TriageResult>>>({});
  const modeRef = useRef<TriageMode>("job_search");
  const sourceRef = useRef<InboxSource>("mock");
  const initialConsent: OpenAIConsentPreference =
    initialAIProcessingEnabled && initialOpenAITriageEnabled ? "accepted" : null;
  const controlsLocked = isScanning || showConsent;

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
    if (isScanning) return;

    const preference = getOpenAIConsentPreference();
    const scanSource = sourceRef.current;
    const scanMode = modeRef.current;

    if (!preference) {
      setPendingScan(true);
      setShowConsent(true);
      return;
    }

    void executeScan(preference === "accepted", scanSource, scanMode);
  }

  async function executeScan(
    useOpenAI: boolean,
    scanSource = sourceRef.current,
    scanMode = modeRef.current,
  ) {
    setIsScanning(true);
    setScanError(null);

    try {
      let emails = scanSource === "mock" ? mockEmails : activeEmails;

      if (scanSource === "gmail") {
        emails = await fetchGmailMessagesWithRetry();
      }

      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: scanMode,
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
      setTaskStates(payload.taskStates ?? []);
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
    setTaskStates((current) =>
      current.some((task) => task.emailId === id)
        ? current
        : [...current, { emailId: id, status: "to_reply", draftSubject: null, draftBody: null }],
    );
    void saveReviewAction(id, "task_created");
  }

  async function deleteEmail(id: string) {
    const item = analyzed.items.find((candidate) => candidate.email.id === id);

    if (!item) return;

    const confirmed = window.confirm(
      item.email.provider === "gmail"
        ? "Archive this Gmail message? It will be removed from your inbox but kept in All Mail."
        : "Archive this mock email from the current scan?",
    );

    if (!confirmed) return;

    setScanError(null);

    try {
      if (item.email.provider === "gmail") {
        const response = await fetch("/api/email-providers/gmail/archive", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ emailId: id }),
        });
        const payload = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to archive Gmail message.");
        }
      }

      setOpenAIItems((current) =>
        current ? current.filter((candidate) => candidate.email.id !== id) : current,
      );
      setActiveEmails((current) => current.filter((email) => email.id !== id));
      setTaskIds((current) => current.filter((emailId) => emailId !== id));
      setTaskStates((current) => current.filter((task) => task.emailId !== id));
      setSelectedId((current) => (current === id ? null : current));
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : "Unable to archive email.",
      );
    }
  }

  function updateTaskState(id: string, patch: Partial<TaskState>) {
    setTaskStates((current) =>
      current.map((task) => (task.emailId === id ? { ...task, ...patch } : task)),
    );
    void fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        emailId: id,
        status: patch.status,
        draftSubject: patch.draftSubject,
        draftBody: patch.draftBody,
      }),
    });
  }

  function saveTriageFeedback(
    emailId: string,
    patch: { categoryOverride?: string; priorityOverride?: PriorityLevel },
  ) {
    setOpenAIItems((current) =>
      current
        ? current.map((item) =>
            item.email.id === emailId
              ? {
                  ...item,
                  triage: {
                    ...item.triage,
                    category: patch.categoryOverride ?? item.triage.category,
                    priority: patch.priorityOverride ?? item.triage.priority,
                    requiresAction:
                      patch.categoryOverride === "Inbox Noise"
                        ? false
                        : item.triage.requiresAction,
                  },
                }
              : item,
          )
        : current,
    );
    void fetch("/api/triage-feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emailId, mode, ...patch }),
    });
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
              const disabled =
                controlsLocked || (option === "gmail" && !hasGmailConnection);

              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (controlsLocked) return;
                    sourceRef.current = option;
                    setSource(option);
                    setActiveEmails(option === "mock" ? mockEmails : []);
                    setOpenAIItems(null);
                    setHasRun(false);
                    setSelectedId(null);
                    setTaskIds([]);
                    setTaskStates([]);
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
            disabled={controlsLocked}
            onChange={(next) => {
              if (controlsLocked) return;
              modeRef.current = next;
              setMode(next);
              setHasRun(false);
              setOpenAIItems(null);
              setSelectedId(null);
              setSelectedFilter("needs_action");
              setTaskIds([]);
              setTaskStates([]);
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

        <div className="flex h-[910px] min-h-0">
          {hasRun ? (
            <PriorityQueue
              items={filteredItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleReviewed={toggleReviewed}
              onPin={pin}
              onBack={() => setSelectedId(null)}
              onAddTask={addTask}
              onDeleteEmail={deleteEmail}
              mode={mode}
              onFeedback={saveTriageFeedback}
            />
          ) : (
            <div className="liquid-glass flex h-full flex-1 flex-col items-center justify-center rounded-2xl border-dashed border-black/15 bg-white/48 p-10 text-center ring-1 ring-white/40">
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
          taskStates={taskStates}
          onToggleReviewed={toggleReviewed}
          onRemove={(id) => {
            setTaskIds((current) => current.filter((taskId) => taskId !== id));
            updateTaskState(id, { status: "archived" });
          }}
          onUpdateTask={updateTaskState}
        />
      </section>

      {showConsent ? (
        <OpenAIConsentDialog
          onAccept={() => {
            window.localStorage.setItem("inboxpilot-openai-email-consent", "accepted");
            void saveOpenAIPreference(true);
            setShowConsent(false);
            if (pendingScan) void executeScan(true, sourceRef.current, modeRef.current);
          }}
          onLocalOnly={() => {
            window.localStorage.setItem("inboxpilot-openai-email-consent", "declined");
            void saveOpenAIPreference(false);
            setShowConsent(false);
            if (pendingScan) void executeScan(false, sourceRef.current, modeRef.current);
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
  taskStates,
  onToggleReviewed,
  onRemove,
  onUpdateTask,
}: {
  tasks: TriagedEmail[];
  taskStates: TaskState[];
  onToggleReviewed: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<TaskState>) => void;
}) {
  const taskStateById = useMemo(
    () => new Map(taskStates.map((task) => [task.emailId, task])),
    [taskStates],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      taskStates
        .filter((task) => task.draftBody)
        .map((task) => [task.emailId, task.draftBody ?? ""]),
    ),
  );
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [tone, setTone] = useState<"concise" | "professional" | "warm" | "firm">("professional");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isClosingTask, setIsClosingTask] = useState(false);
  const [isEditingTasks, setIsEditingTasks] = useState(false);
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null);
  const selectedTask = tasks.find((task) => task.email.id === selectedTaskId) ?? null;

  function closeSelectedTask() {
    setIsClosingTask(true);
    window.setTimeout(() => {
      setSelectedTaskId(null);
      setIsClosingTask(false);
      setSentSuccessId(null);
    }, 180);
  }

  async function generateReply(emailId: string) {
    setDraftingId(emailId);
    setDraftError(null);

    try {
      const response = await fetch("/api/reply-suggestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emailId, tone }),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to draft reply.");
      }

      setDrafts((current) => ({
        ...current,
        [emailId]: payload.suggestion.body,
      }));
      onUpdateTask(emailId, {
        draftSubject: payload.suggestion.subject,
        draftBody: payload.suggestion.body,
      });
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : "Unable to draft reply.",
      );
    } finally {
      setDraftingId(null);
    }
  }

  async function sendGmailReply(emailId: string) {
    const body = normalizeDraftBody(getDraftBody(emailId));
    if (!body) return;
    if (!window.confirm("Send this edited draft as a Gmail reply in the original thread?")) {
      return;
    }

    setSendingId(emailId);
    setSendError(null);

    try {
      const response = await fetch("/api/email-providers/gmail/send-reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emailId, body }),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send Gmail reply.");
      }

      onUpdateTask(emailId, { status: "waiting", draftBody: body });
      setDrafts((current) => ({ ...current, [emailId]: body }));
      setSentSuccessId(emailId);
      window.setTimeout(() => {
        closeSelectedTask();
      }, 900);
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Unable to send Gmail reply.",
      );
    } finally {
      setSendingId(null);
    }
  }

  function getDraftBody(emailId: string) {
    return drafts[emailId] ?? taskStateById.get(emailId)?.draftBody ?? "";
  }

  return (
    <section className="liquid-glass rounded-2xl border-black/10 bg-white/64 p-5 shadow-xl shadow-black/8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal text-[#141817]">
            Task list
          </h2>
          <p className="mt-1 text-sm text-[#4a504d]">
            Saved email follow-ups with editable AI draft space.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tasks.length > 0 ? (
            <button
              type="button"
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
                isEditingTasks
                  ? "border-[#c86a3b]/25 bg-[#fff1e8] text-[#9a4d2c]"
                  : "border-black/10 bg-[#fffdf7]/70 text-[#4a504d] hover:bg-white"
              }`}
              onClick={() => setIsEditingTasks((current) => !current)}
            >
              <Pencil className="size-3.5" />
              {isEditingTasks ? "Done" : "Edit list"}
            </button>
          ) : null}
          <span className="rounded-full border border-black/10 bg-[#fffdf7]/70 px-3 py-1 text-sm font-medium text-[#68716d]">
            {tasks.length} tasks
          </span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="liquid-glass mt-5 rounded-xl border-white/60 bg-[#fffdf7]/36 p-8 text-center shadow-inner ring-1 ring-white/45">
          <p className="font-medium text-[#141817]">No email tasks yet</p>
          <p className="mt-2 text-sm text-[#68716d]">
            Open a priority email and add it to your task list.
          </p>
        </div>
      ) : selectedTask ? (
        <div
          className={`relative mt-5 overflow-hidden rounded-xl border border-black/10 bg-[#fffdf7]/78 p-4 duration-300 ${
            isClosingTask
              ? "animate-out fade-out slide-out-to-bottom-3 zoom-out-95"
              : "animate-in fade-in slide-in-from-bottom-3 zoom-in-95"
          }`}
        >
          {sentSuccessId === selectedTask.email.id ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#fffdf7]/90 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300">
              <div className="liquid-glass flex items-center gap-3 rounded-full border-[#c8e8df] bg-[#dff3eb]/88 px-5 py-3 text-sm font-semibold text-[#0e6f68] shadow-lg shadow-black/10">
                <CheckCircle2 className="size-5" />
                Email sent successfully
              </div>
            </div>
          ) : null}
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
              <TaskStatusPicker
                status={taskStateById.get(selectedTask.email.id)?.status ?? "to_reply"}
                onChange={(status) => onUpdateTask(selectedTask.email.id, { status })}
              />
            </div>
            <button
              type="button"
              aria-label="Close selected task"
              className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[#4a504d] transition hover:bg-white hover:text-[#141817]"
              onClick={closeSelectedTask}
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
                <div className="flex items-center gap-2">
                  <select
                    value={tone}
                    onChange={(event) =>
                      setTone(event.target.value as "concise" | "professional" | "warm" | "firm")
                    }
                    className="h-8 rounded-full border border-black/10 bg-[#fffdf7]/80 px-3 text-xs font-semibold text-[#33423d] outline-none"
                  >
                    <option value="professional">Professional</option>
                    <option value="concise">Concise</option>
                    <option value="warm">Warm</option>
                    <option value="firm">Firm</option>
                  </select>
                  <button
                    className="rounded-full border border-black/10 bg-[#fffdf7]/80 px-3 py-1.5 text-xs font-semibold text-[#33423d] transition hover:bg-white"
                    disabled={draftingId === selectedTask.email.id}
                    onClick={() => generateReply(selectedTask.email.id)}
                  >
                    {draftingId === selectedTask.email.id ? "Drafting..." : "Generate draft"}
                  </button>
                </div>
              </div>
              <textarea
                value={getDraftBody(selectedTask.email.id)}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [selectedTask.email.id]: event.target.value,
                  }))
                }
                onBlur={(event) =>
                  onUpdateTask(selectedTask.email.id, {
                    draftBody: event.target.value,
                  })
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
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-sm transition hover:bg-white disabled:opacity-45"
              disabled={!getDraftBody(selectedTask.email.id)}
              onClick={() => navigator.clipboard.writeText(getDraftBody(selectedTask.email.id))}
            >
              <Copy className="size-3.5" />
              Copy draft
            </button>
            {selectedTask.email.provider === "gmail" ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-[#0e6f68]/20 bg-[#dff4ef] px-3 py-1.5 text-sm font-semibold text-[#0e6f68] transition hover:bg-[#cff0e9] disabled:opacity-45"
                disabled={!getDraftBody(selectedTask.email.id) || sendingId === selectedTask.email.id}
                onClick={() => sendGmailReply(selectedTask.email.id)}
              >
                <Send className="size-3.5" />
                {sendingId === selectedTask.email.id ? "Sending..." : "Send Gmail reply"}
              </button>
            ) : null}
            <button
              className="rounded-full border border-[#c86a3b]/20 bg-[#fff1e8] px-3 py-1.5 text-sm font-medium text-[#9a4d2c]"
              onClick={() => {
                onRemove(selectedTask.email.id);
                closeSelectedTask();
              }}
            >
              Remove from tasks
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid max-w-3xl gap-2">
          {draftError ? (
            <div className="rounded-xl border border-[#c86a3b]/20 bg-[#fff1e8] px-4 py-3 text-sm text-[#8b4d2c]">
              {draftError}
            </div>
          ) : null}
          {sendError ? (
            <div className="rounded-xl border border-[#c86a3b]/20 bg-[#fff1e8] px-4 py-3 text-sm text-[#8b4d2c]">
              {sendError}
            </div>
          ) : null}
          {tasks.map((item) => (
            <TaskListRow
              key={item.email.id}
              item={item}
              status={taskStateById.get(item.email.id)?.status ?? "to_reply"}
              isEditingTasks={isEditingTasks}
              onOpen={() => {
                setIsEditingTasks(false);
                setSelectedTaskId(item.email.id);
              }}
              onRemove={() => onRemove(item.email.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskListRow({
  item,
  status,
  isEditingTasks,
  onOpen,
  onRemove,
}: {
  item: TriagedEmail;
  status: TaskStatus;
  isEditingTasks: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const muted = item.triage.reviewed || status === "waiting" || status === "done";

  return (
    <div
      className={`group flex items-center gap-2 rounded-xl border border-black/10 bg-[#fffdf7]/78 p-2 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md ${
        muted ? "opacity-55" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-lg px-3 py-2 text-left transition group-hover:bg-[#f1f0ea]/70"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#141817]">
            {item.email.senderName}
          </p>
          <p className="mt-1 truncate text-sm text-[#4a504d]">
            {item.triage.suggestedNextAction}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-black/10 bg-[#ede9df]/70 px-2.5 py-1 text-[11px] font-semibold text-[#59635f]">
          {formatTaskStatus(status)}
        </span>
        {item.triage.reviewed ? (
          <CheckCircle2 className="size-5 shrink-0 text-[#0e6f68]" />
        ) : null}
      </button>
      {isEditingTasks ? (
        <button
          type="button"
          aria-label={`Remove ${item.email.senderName} from task list`}
          className="animate-in fade-in zoom-in-95 flex size-9 shrink-0 items-center justify-center rounded-full border border-[#c86a3b]/20 bg-[#fff1e8] text-[#9a4d2c] transition hover:bg-[#ffe5d4]"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function normalizeDraftBody(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\n\n");
}

function TaskStatusPicker({
  status,
  onChange,
}: {
  status: TaskStatus;
  onChange: (status: TaskStatus) => void;
}) {
  const options: Array<{ value: TaskStatus; label: string }> = [
    { value: "to_reply", label: "To reply" },
    { value: "waiting", label: "Waiting" },
    { value: "done", label: "Done" },
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            status === option.value
              ? "border-[#0e6f68]/25 bg-[#dff4ef] text-[#0e6f68]"
              : "border-black/10 bg-white/60 text-[#59635f] hover:bg-white"
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function formatTaskStatus(status: TaskStatus) {
  if (status === "to_reply") return "To reply";
  if (status === "waiting") return "Waiting";
  if (status === "done") return "Done";
  return "Archived";
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

async function fetchGmailMessagesWithRetry() {
  const delays = [0, 450, 1200, 2200];
  let lastError = "Unable to fetch Gmail messages.";

  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const response = await fetch("/api/email-providers/gmail/messages", {
      cache: "no-store",
    });
    const payload = await readJsonResponse(response);

    if (response.ok) {
      return payload.messages as EmailMessage[];
    }

    lastError = payload.error ?? lastError;

    if (response.status !== 401 && response.status !== 409 && response.status < 500) {
      break;
    }
  }

  throw new Error(lastError);
}
