import { describe, expect, it } from "vitest";
import { analyzeEmail } from "@/lib/triage/analyze-email";
import { detectDeadline } from "@/lib/triage/deadline";
import { analyzeInbox, compareTriagedEmail } from "@/lib/triage/analyze-inbox";
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

  it("sorts high-impact urgent work above casual high-priority events", () => {
    const dinner = {
      email: {
        id: "gmail:test-dinner",
        provider: "gmail" as const,
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
      triage: {
        emailId: "gmail:test-dinner",
        priority: "high" as const,
        category: "Events",
        requiresAction: true,
        deadline: "this Friday",
        actionSummary: "Events: respond by this Friday.",
        reason: "Asks for availability.",
        confidence: 0.86,
        suggestedNextAction: "Respond with your availability for this Friday.",
        reviewed: false,
        pinned: false,
        snoozedUntil: null,
      },
    };
    const security = {
      email: {
        id: "gmail:test-security",
        provider: "gmail" as const,
        senderName: "Google",
        senderEmail: "no-reply@accounts.google.com",
        subject: "Security alert",
        body: "New sign-in detected. Verify account activity and change your password if suspicious.",
        snippet: "New sign-in detected.",
        receivedAt: new Date().toISOString(),
        isRead: false,
        labels: ["UNREAD"],
        threadId: "thread-security",
      },
      triage: {
        emailId: "gmail:test-security",
        priority: "high" as const,
        category: "Urgent",
        requiresAction: true,
        deadline: null,
        actionSummary: "Security action needed.",
        reason: "Security alert.",
        confidence: 0.9,
        suggestedNextAction: "Check recent account activity.",
        reviewed: false,
        pinned: false,
        snoozedUntil: null,
      },
    };

    expect([dinner, security].sort(compareTriagedEmail)[0].email.id).toBe(
      "gmail:test-security",
    );
  });
});
