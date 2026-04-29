import type { ReactNode } from "react";
import type { PriorityLevel } from "@/types/triage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const pillBase =
  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold leading-none";

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "mt-1 inline-flex rounded-full border-0 px-2.5 py-1 text-xs font-semibold capitalize",
        priority === "high" && "bg-[#e46f3d] text-white",
        priority === "medium" && "bg-[#f0d7c8] text-[#9a4d2c]",
        priority === "low" && "bg-[#e5e2d9] text-[#59635f]",
      )}
    >
      {priority}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(pillBase, "border-[#c8e8df] bg-[#dff3eb] text-[#0e6f68]")}
    >
      {category}
    </Badge>
  );
}

export function DeadlineBadge({
  deadline,
  icon,
}: {
  deadline: string;
  icon?: ReactNode;
}) {
  return (
    <span className={cn(pillBase, "border-[#f0d7c8] bg-[#fff3eb] text-[#9a4d2c]")}>
      {icon}
      {formatDeadlineLabel(deadline)}
    </span>
  );
}

export function ActionBadge() {
  return (
    <span className={cn(pillBase, "border-[#c8e8df] bg-[#dff3eb] text-[#0e6f68]")}>
      Action
    </span>
  );
}

function formatDeadlineLabel(deadline: string) {
  const parsed = new Date(deadline);

  if (!Number.isNaN(parsed.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(deadline)) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (parsed.toDateString() === today.toDateString()) {
      return `today ${formatTime(parsed)}`;
    }

    if (parsed.toDateString() === tomorrow.toDateString()) {
      return `tomorrow ${formatTime(parsed)}`;
    }

    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
      .format(parsed)
      .replace(",", "");
  }

  return deadline;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  })
    .format(date)
    .toLowerCase();
}
