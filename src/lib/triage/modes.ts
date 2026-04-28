import type { ModeDefinition } from "@/types/triage";

export const modeDefinitions: ModeDefinition[] = [
  {
    id: "job_search",
    label: "Recruiting Mode",
    shortLabel: "Recruiting",
    description:
      "Surfaces recruiters, interviews, offers, assessments, application updates, and deadlines.",
    categories: [
      "Interviews",
      "Applications",
      "Job Offers",
      "Online Assessment",
      "Recruiters",
      "Inbox Noise",
    ],
  },
  {
    id: "work",
    label: "Work Mode",
    shortLabel: "Working",
    description:
      "Ranks manager messages, client asks, blockers, approvals, meetings, and documents needing review.",
    categories: [
      "Meetings",
      "Manager",
      "Clients",
      "Documents",
      "Project Updates",
      "Urgent",
      "Inbox Noise",
    ],
  },
  {
    id: "life_admin",
    label: "Life Mode",
    shortLabel: "Living",
    description:
      "Organizes bills, appointments, purchases, reservations, finance alerts, and personal tasks.",
    categories: [
      "Purchases",
      "Reservations",
      "Events",
      "Finance",
      "Documents",
      "Urgent",
      "Inbox Noise",
    ],
  },
];

export function getModeDefinition(mode: ModeDefinition["id"]) {
  return modeDefinitions.find((item) => item.id === mode) ?? modeDefinitions[0];
}
