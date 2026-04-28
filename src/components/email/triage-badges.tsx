import type { PriorityLevel } from "@/types/triage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    <Badge variant="secondary" className="rounded-full bg-[#dff3eb] px-3 py-1 text-[#0e6f68]">
      {category}
    </Badge>
  );
}
