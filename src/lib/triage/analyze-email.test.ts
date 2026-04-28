import { describe, expect, it } from "vitest";
import { analyzeEmail } from "@/lib/triage/analyze-email";
import { detectDeadline } from "@/lib/triage/deadline";
import { analyzeInbox } from "@/lib/triage/analyze-inbox";
import { mockEmails } from "@/lib/mock/mock-emails";

describe("detectDeadline", () => {
  it("detects relative deadlines with times", () => {
    expect(detectDeadline("please respond by tomorrow at 5 PM")).toBe(
      "tomorrow 5 PM",
    );
  });

  it("detects absolute month/day deadlines", () => {
    expect(detectDeadline("Your bill is due May 3.")).toBe("May 3");
  });
});

describe("analyzeEmail", () => {
  it("prioritizes interview responses in job search mode", () => {
    const result = analyzeEmail(mockEmails[0], "job_search");

    expect(result.priority).toBe("high");
    expect(result.category).toBe("Interviews");
    expect(result.requiresAction).toBe(true);
  });

  it("classifies work approvals as high priority", () => {
    const result = analyzeEmail(
      mockEmails.find((email) => email.id === "work-001")!,
      "work",
    );

    expect(result.priority).toBe("high");
    expect(result.category).toBe("Urgent");
  });

  it("classifies finance alerts in life admin mode", () => {
    const result = analyzeEmail(
      mockEmails.find((email) => email.id === "life-004")!,
      "life_admin",
    );

    expect(result.priority).toBe("high");
    expect(result.category).toBe("Urgent");
    expect(result.requiresAction).toBe(true);
  });
});

describe("analyzeInbox", () => {
  it("returns sorted triage items and a summary", () => {
    const result = analyzeInbox(mockEmails, "job_search");

    expect(result.items).toHaveLength(mockEmails.length);
    expect(result.summary.totalEmails).toBe(mockEmails.length);
    expect(result.summary.highPriorityCount).toBeGreaterThan(0);
    expect(result.items[0].triage.priority).toBe("high");
  });
});
