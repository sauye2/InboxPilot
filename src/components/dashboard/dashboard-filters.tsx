"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import type { PriorityLevel, SortOption } from "@/types/triage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type DashboardFilterState = {
  search: string;
  priority: PriorityLevel | "all";
  category: string;
  requiresActionOnly: boolean;
  hasDeadlineOnly: boolean;
  unreadOnly: boolean;
  hideLowPriority: boolean;
  sort: SortOption;
};

type DashboardFiltersProps = {
  filters: DashboardFilterState;
  categories: string[];
  onChange: (filters: DashboardFilterState) => void;
  onClearReviewed: () => void;
};

export function DashboardFilters({
  filters,
  categories,
  onChange,
  onClearReviewed,
}: DashboardFiltersProps) {
  const update = (patch: Partial<DashboardFilterState>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className="liquid-glass rounded-xl border-black/10 bg-white/62 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search email sender, subject, or body</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Search sender, subject, body..."
            className="h-10 border-black/10 bg-[#fffdf7]/70 pl-9"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-3 xl:flex">
          <Select
            value={filters.priority}
            onValueChange={(priority) =>
              update({ priority: priority as DashboardFilterState["priority"] })
            }
          >
            <SelectTrigger className="h-10 w-full border-black/10 bg-[#fffdf7]/70 xl:w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.category}
            onValueChange={(category) => update({ category: category ?? "all" })}
          >
            <SelectTrigger className="h-10 w-full border-black/10 bg-[#fffdf7]/70 xl:w-[170px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.sort}
            onValueChange={(sort) => update({ sort: sort as SortOption })}
          >
            <SelectTrigger className="h-10 w-full border-black/10 bg-[#fffdf7]/70 xl:w-[145px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="deadline">Deadline</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-black/10 pt-3">
        <ToggleRow
          label="Action only"
          checked={filters.requiresActionOnly}
          onCheckedChange={(requiresActionOnly) => update({ requiresActionOnly })}
        />
        <ToggleRow
          label="Has deadline"
          checked={filters.hasDeadlineOnly}
          onCheckedChange={(hasDeadlineOnly) => update({ hasDeadlineOnly })}
        />
        <ToggleRow
          label="Unread only"
          checked={filters.unreadOnly}
          onCheckedChange={(unreadOnly) => update({ unreadOnly })}
        />
        <ToggleRow
          label="Hide low"
          checked={filters.hideLowPriority}
          onCheckedChange={(hideLowPriority) => update({ hideLowPriority })}
        />
        <Button
          variant="outline"
          size="sm"
          className="ml-auto border-black/10 bg-[#fffdf7]/70"
          onClick={onClearReviewed}
        >
          <SlidersHorizontal className="size-4" />
          Clear reviewed
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-md border border-black/10 bg-[#fffdf7]/64 px-3 text-sm text-[#4a504d]">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      {label}
    </label>
  );
}
