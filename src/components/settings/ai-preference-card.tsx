"use client";

import { useEffect, useState } from "react";
import { Brain, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type OpenAIConsentPreference = "accepted" | "declined" | null;

const storageKey = "inboxpilot-openai-email-consent";

function getStoredPreference(): OpenAIConsentPreference {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(storageKey);
  if (stored === "accepted" || stored === "declined") return stored;
  return null;
}

export function AIPreferenceCard() {
  const [preference, setPreference] = useState<OpenAIConsentPreference>(
    getStoredPreference,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadPreference() {
      const response = await fetch("/api/user-preferences");
      if (!response.ok) return;

      const payload = await response.json();
      const enabled =
        payload.preferences?.aiProcessingEnabled &&
        payload.preferences?.openAITriageEnabled;

      if (mounted) {
        const nextPreference = enabled ? "accepted" : "declined";
        window.localStorage.setItem(storageKey, nextPreference);
        setPreference(nextPreference);
      }
    }

    void loadPreference();

    return () => {
      mounted = false;
    };
  }, []);

  function updatePreference(nextPreference: Exclude<OpenAIConsentPreference, null>) {
    window.localStorage.setItem(storageKey, nextPreference);
    setPreference(nextPreference);
    setIsSaving(true);
    void fetch("/api/user-preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        aiProcessingEnabled: nextPreference === "accepted",
        openAITriageEnabled: nextPreference === "accepted",
        openAIReplySuggestionsEnabled: nextPreference === "accepted",
      }),
    }).finally(() => setIsSaving(false));
  }

  const enabled = preference === "accepted";

  return (
    <article className="liquid-glass rounded-2xl border-black/10 bg-white/66 p-6 md:col-span-3">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e7f1ec] text-[#0e6f68]">
            <Brain className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[#141817]">
              OpenAI-assisted scanning
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4a504d]">
              Choose whether InboxPilot can use OpenAI to parse email context and
              produce clearer next steps. Local rules remain available when AI is off.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row md:items-center">
          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-black/8 bg-[#ede9df]/70 px-3 text-xs font-medium text-[#4a504d]">
            <CheckCircle2 className="size-3.5 text-[#0e6f68]" />
            {enabled ? "AI parsing on" : "Local rules only"}
          </span>
          {isSaving ? (
            <span className="text-xs font-medium text-[#68716d]">Saving...</span>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={enabled ? "default" : "outline"}
              onClick={() => updatePreference("accepted")}
              className={
                enabled
                  ? "h-9 bg-[#141817] px-4 text-[#f7f6f1] hover:bg-[#27302d]"
                  : "h-9 border-black/10 bg-white/60 px-4 text-[#4a504d]"
              }
            >
              Opt-In
            </Button>
            <Button
              type="button"
              variant={!enabled ? "default" : "outline"}
              onClick={() => updatePreference("declined")}
              className={
                !enabled
                  ? "h-9 bg-[#141817] px-4 text-[#f7f6f1] hover:bg-[#27302d]"
                  : "h-9 border-black/10 bg-white/60 px-4 text-[#4a504d]"
              }
            >
              Opt-Out
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
