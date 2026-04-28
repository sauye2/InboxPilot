"use client";

import type { TriageMode } from "@/types/triage";
import { modeDefinitions } from "@/lib/triage/modes";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ModeSelectorProps = {
  value: TriageMode;
  onChange: (mode: TriageMode) => void;
};

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="liquid-glass rounded-2xl border-white/70 bg-white/36 p-2 shadow-2xl shadow-black/15 ring-1 ring-white/45">
      <Tabs value={value} onValueChange={(next) => onChange(next as TriageMode)}>
        <TabsList className="grid h-12 w-full grid-cols-3 rounded-xl bg-[#ede9df]/58 p-1 backdrop-blur-xl">
          {modeDefinitions.map((mode) => (
            <TabsTrigger
              key={mode.id}
              value={mode.id}
              className="h-10 rounded-lg px-3 text-sm font-semibold text-[#4a504d] transition-all data-[state=active]:bg-[#fffdf7] data-[state=active]:text-[#141817] data-[state=active]:shadow-lg"
            >
              {mode.shortLabel}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
