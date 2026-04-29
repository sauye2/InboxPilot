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

  it("detects this Friday as a nearby deadline", () => {
    expect(detectDeadline("Are you available for dinner this Friday?")).toBe(
      "this Friday",
    );
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

  it("treats personal event replies with nearby deadlines as important", () => {
    const result = analyzeEmail(
      {
        id: "gmail:test-dinner",
        provider: "gmail",
        senderName: "Stanley Auyeung",
        senderEmail: "stanley@example.com",
        subject: "Dinner",
        body: "Are you available for dinner this Friday? Let me know!",
        snippet: "Are you available for dinner this Friday? Let me know!",
        receivedAt: new Date().toISOString(),
        isRead: false,
        labels: ["UNREAD"],
        threadId: "thread-dinner",
      },
      "life_admin",
    );

    expect(result.priority).toBe("high");
    expect(result.category).toBe("Events");
    expect(result.requiresAction).toBe(true);
    expect(result.deadline).toBe("this Friday");
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
