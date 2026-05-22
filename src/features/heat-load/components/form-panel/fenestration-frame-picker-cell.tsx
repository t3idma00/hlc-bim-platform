import { useEffect, useMemo, useRef, useState } from "react";

import {
  getAshraeTable5FramePart,
  normalizeAshraeTable5FrameLabel,
} from "./ashrae-calculations/fenestration-u-table5";

type FenestrationFramePickerCellProps = {
  ariaLabel: string;
  value: string;
  title?: string;
  align?: "left" | "center" | "right";
  options: readonly string[];
  onValueChange: (value: string) => void;
};

export function FenestrationFramePickerCell({
  ariaLabel,
  value,
  title,
  align = "left",
  options,
  onValueChange,
}: FenestrationFramePickerCellProps) {
  const selectedValue = normalizeAshraeTable5FrameLabel(value);
  const [pickerIsOpen, setPickerIsOpen] = useState(false);
  const [showContinued, setShowContinued] = useState(getAshraeTable5FramePart(selectedValue) === "continued");
  const pickerRef = useRef<HTMLDivElement>(null);
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const { firstPageOptions, continuedOptions } = useMemo(() => splitTable5Options(options), [options]);

  useEffect(() => {
    if (!pickerIsOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [pickerIsOpen]);

  return (
    <div
      ref={pickerRef}
      className="relative min-h-[24px] w-full"
      onKeyDown={(event) => {
        if (event.key === "Escape") setPickerIsOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={pickerIsOpen}
        title={title ?? selectedValue}
        onClick={() => setPickerIsOpen((current) => !current)}
        className={`relative min-h-[28px] w-full cursor-pointer bg-[#fff4f7] px-1 py-1 pr-5 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
      >
        <span>{selectedValue}</span>
        <PickerChevron open={pickerIsOpen} />
      </button>
      {pickerIsOpen ? (
        <div
          role="listbox"
          aria-label={`${ariaLabel} ASHRAE Table 5 products`}
          className="absolute left-0 top-full z-40 mt-0.5 w-[min(620px,calc(100vw-2rem))] border border-slate-300 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.20)]"
        >
          <div className="max-h-[380px] overflow-y-auto p-1">
            {firstPageOptions.length > 0 ? (
              <>
                <TablePageHeader label="ASHRAE Table 5, page 29.8" />
                {firstPageOptions.map((option) => (
                  <FrameOption
                    key={option}
                    option={option}
                    selected={option === selectedValue}
                    onSelect={() => {
                      onValueChange(option);
                      setPickerIsOpen(false);
                    }}
                  />
                ))}
              </>
            ) : null}
            {continuedOptions.length > 0 ? (
              <button
                type="button"
                aria-label={showContinued ? "Hide continued Table 5 options" : "Show continued Table 5 options"}
                aria-expanded={showContinued}
                onClick={() => setShowContinued((current) => !current)}
                className="my-1 grid w-full place-items-center border border-slate-200 bg-white py-1 hover:border-[#be123c] hover:bg-[#fff4f7]"
              >
                <ArrowButtonIcon open={showContinued} />
              </button>
            ) : null}
            {showContinued && continuedOptions.length > 0 ? (
              <>
                <TablePageHeader label="ASHRAE Table 5 continued, page 29.9" />
                {continuedOptions.map((option) => (
                  <FrameOption
                    key={option}
                    option={option}
                    selected={option === selectedValue}
                    onSelect={() => {
                      onValueChange(option);
                      setPickerIsOpen(false);
                    }}
                  />
                ))}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function splitTable5Options(options: readonly string[]) {
  return {
    firstPageOptions: options.filter((option) => getAshraeTable5FramePart(option) === "first"),
    continuedOptions: options.filter((option) => getAshraeTable5FramePart(option) === "continued"),
  };
}

function TablePageHeader({ label }: { label: string }) {
  return (
    <div className="bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
      {label}
    </div>
  );
}

function FrameOption({
  option,
  selected,
  onSelect,
}: {
  option: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`block w-full border-x border-b px-2 py-1.5 text-left text-[10px] leading-snug text-slate-900 hover:bg-[#fff4f7] ${
        selected ? "border-[#be123c] bg-[#fff4f7] font-semibold" : "border-slate-200 bg-white"
      }`}
    >
      {option}
    </button>
  );
}

function PickerChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 6"
      className={`pointer-events-none absolute right-1 top-1/2 h-[6px] w-[10px] -translate-y-1/2 text-slate-900 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function ArrowButtonIcon({ open }: { open: boolean }) {
  return (
    <span className="ml-2 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-700">
      <svg
        aria-hidden="true"
        viewBox="0 0 10 6"
        className={`h-[6px] w-[10px] transition-transform ${open ? "rotate-180" : ""}`}
      >
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    </span>
  );
}
