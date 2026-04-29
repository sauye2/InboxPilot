"use client";

import type { TriageMode } from "@/types/triage";
import { modeDefinitions } from "@/lib/triage/modes";

type ModeSelectorProps = {
  value: TriageMode;
  onChange: (mode: TriageMode) => void;
};

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  const activeIndex = modeDefinitions.findIndex((mode) => mode.id === value);

  return (
    <div className="liquid-glass rounded-2xl border-white/70 bg-white/42 p-2 shadow-2xl shadow-black/12 ring-1 ring-white/50">
      <div className="relative grid h-12 grid-cols-3 overflow-hidden rounded-xl border border-black/5 bg-[#ede9df]/70 p-1">
        <span
          className="absolute bottom-1 top-1 rounded-lg border border-white/70 bg-[#fffdf7]/92 shadow-lg shadow-black/10 transition-transform duration-300 ease-out"
          style={{
            left: "0.25rem",
            width: "calc((100% - 0.5rem) / 3)",
            transform: `translateX(calc(${activeIndex < 0 ? 0 : activeIndex} * ((100% - 0.5rem) / 3)))`,
          }}
        />
        {modeDefinitions.map((mode) => {
          const selected = mode.id === value;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={`relative z-10 flex h-full items-center justify-center rounded-lg px-3 text-center text-sm font-semibold transition-colors duration-300 ${
                selected ? "text-[#141817]" : "text-[#59635f] hover:text-[#141817]"
              }`}
            >
              {mode.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
