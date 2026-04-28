import type { EmailMessage } from "@/types/email";
import type { TriageMode, TriageResult } from "@/types/triage";
import { analyzeEmail } from "@/lib/triage/analyze-email";

export type TriageService = {
  analyzeEmail(email: EmailMessage, mode: TriageMode): Promise<TriageResult>;
};

export class LocalTriageService implements TriageService {
  async analyzeEmail(email: EmailMessage, mode: TriageMode) {
    return analyzeEmail(email, mode);
  }
}

export class OpenAITriageServicePlaceholder implements TriageService {
  async analyzeEmail(): Promise<TriageResult> {
    throw new Error(
      "OpenAI triage is not connected in the local MVP. Swap this service in once API credentials and privacy controls are configured.",
    );
  }
}
