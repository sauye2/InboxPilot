import type { LucideIcon } from "lucide-react";
import { Activity, AlertCircle, BriefcaseBusiness, CalendarCheck, Clock3, FileCheck2, Gift, Inbox, MailCheck, Tag, Users, Zap } from "lucide-react";
import type { InboxSummary } from "@/types/triage";
import type { TriageMode } from "@/types/triage";
import { getModeDefinition } from "@/lib/triage/modes";

type SummaryCardsProps = {
  summary: InboxSummary;
  mode: TriageMode;
  selectedFilter: string;
  categoryCounts: Record<string, number>;
  onSelectFilter: (filter: string) => void;
};

const toneClasses = [
  "text-[#141817]",
  "text-[#c86a3b]",
  "text-[#0e6f68]",
  "text-[#b78a24]",
  "text-[#347a6f]",
  "text-[#59635f]",
];

const categoryIcons: Record<string, LucideIcon> = {
  Scanned: Inbox,
  "Needs action": MailCheck,
  Interviews: CalendarCheck,
  Applications: FileCheck2,
  "Job Offers": Gift,
  "Online Assessment": Activity,
  Recruiters: Users,
  Urgent: Zap,
  "Inbox Noise": Tag,
  Meetings: CalendarCheck,
  Manager: BriefcaseBusiness,
  Clients: Users,
  Documents: FileCheck2,
  "Project Updates": Activity,
  Deadlines: Clock3,
  Bills: FileCheck2,
  Purchases: Gift,
  Reservations: CalendarCheck,
  Events: CalendarCheck,
  Finance: AlertCircle,
};

export function SummaryCards({
  summary,
  mode,
  selectedFilter,
  categoryCounts,
  onSelectFilter,
}: SummaryCardsProps) {
  const modeCategories = getModeDefinition(mode).categories;
  const metrics = [
    {
      label: "Scanned",
      value: summary.totalEmails,
      detail: "mock emails",
      filter: "scanned",
    },
    {
      label: "Needs action",
      value: summary.actionRequiredCount,
      detail: "detected asks",
      filter: "needs_action",
    },
    {
      label: "Urgent",
      value: summary.highPriorityCount,
      detail: "review first",
      filter: "priority_high",
    },
    ...modeCategories.map((category) => ({
      label: category,
      value: categoryCounts[category] ?? 0,
      detail: category === "Inbox Noise" ? "filtered out" : "classified",
      filter: category,
    })).filter((metric) => metric.label !== "Urgent"),
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric, index) => {
        const Icon = categoryIcons[metric.label] ?? Clock3;
        const selected = selectedFilter === metric.filter;

        return (
          <button
            key={metric.label}
            className={`liquid-glass rounded-xl border-black/10 p-4 text-left transition-all hover:-translate-y-0.5 ${
              selected
                ? "liquid-glass-dark border-white/15 bg-[#141817]/68 text-[#f7f6f1] shadow-xl shadow-black/15"
                : "bg-white/70"
            }`}
            onClick={() => onSelectFilter(metric.filter)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`block text-3xl font-semibold tracking-normal ${selected ? "text-[#f7f6f1]" : toneClasses[index % toneClasses.length]}`}
                >
                  {metric.value}
                </span>
                <span className={`mt-2 block text-sm leading-5 ${selected ? "text-white/86" : "text-[#4a504d]"}`}>
                  {metric.label}
                </span>
                <span className={`mt-0.5 block text-xs ${selected ? "text-white/62" : "text-[#7d8680]"}`}>
                  {metric.detail}
                </span>
              </div>
              <span className={`flex size-9 items-center justify-center rounded-lg ${selected ? "bg-white/12 text-[#8bd3c7]" : "bg-[#f7f6f1]/80 text-[#0e6f68]"}`}>
                <Icon className="size-4" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
