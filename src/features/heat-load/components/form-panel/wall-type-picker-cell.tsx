import { useEffect, useRef, useState } from "react";

import { getAshrae1997WallDetails, getAshrae1997WallDropdownLabel } from "./ashrae-wall-assemblies";

type WallTypePickerCellProps = {
  ariaLabel: string;
  value: string;
  title?: string;
  align?: "left" | "center" | "right";
  options: readonly string[];
  onValueChange: (value: string) => void;
};

export function WallTypePickerCell({
  ariaLabel,
  value,
  title,
  align = "left",
  options,
  onValueChange,
}: WallTypePickerCellProps) {
  const [pickerIsOpen, setPickerIsOpen] = useState(false);
  const [openOptionDetails, setOpenOptionDetails] = useState<Record<string, boolean>>({});
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedDetails = getAshrae1997WallDetails(value);
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  useEffect(() => {
    if (!pickerIsOpen) {
      return;
    }

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
      className="relative min-h-[24px] min-w-0 w-full"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setPickerIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={pickerIsOpen}
        title={title ?? selectedDetails?.dropdownLabel ?? value}
        onClick={() => setPickerIsOpen((current) => !current)}
        className={`relative grid min-h-[34px] min-w-0 w-full cursor-pointer gap-0.5 bg-[#fff4f7] px-1 py-1 pr-5 text-[10px] leading-snug text-slate-900 outline-none ${alignClass}`}
      >
        <span className="min-w-0 whitespace-normal break-words font-semibold">
          {selectedDetails?.dropdownLabel ?? getAshrae1997WallDropdownLabel(value)}
        </span>
        {selectedDetails?.thicknessSummary ? (
          <span className="min-w-0 whitespace-normal break-words text-[9px] text-slate-600">
            {selectedDetails.thicknessSummary}
          </span>
        ) : null}
        <PickerChevron open={pickerIsOpen} />
      </button>
      {pickerIsOpen ? (
        <div
          role="listbox"
          aria-label={`${ariaLabel} wall types`}
          className="absolute left-0 top-full z-40 mt-0.5 w-[min(560px,calc(100vw-2rem))] border border-slate-300 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.20)]"
        >
          <div className="max-h-[360px] overflow-y-auto p-1">
            {options.map((option) => (
              <WallTypePickerOption
                key={option}
                option={option}
                selected={option === value}
                detailIsOpen={Boolean(openOptionDetails[option])}
                onSelect={() => {
                  onValueChange(option);
                  setPickerIsOpen(false);
                }}
                onToggleDetail={() =>
                  setOpenOptionDetails((current) => ({
                    ...current,
                    [option]: !current[option],
                  }))
                }
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WallTypePickerOption({
  option,
  selected,
  detailIsOpen,
  onSelect,
  onToggleDetail,
}: {
  option: string;
  selected: boolean;
  detailIsOpen: boolean;
  onSelect: () => void;
  onToggleDetail: () => void;
}) {
  const details = getAshrae1997WallDetails(option);

  if (!details) {
    return (
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className="w-full border border-transparent px-2 py-1 text-left text-[10px] text-slate-900 hover:border-slate-200 hover:bg-[#fff4f7]"
      >
        {option}
      </button>
    );
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      className={`mb-1 border ${selected ? "border-[#be123c] bg-[#fff4f7]" : "border-slate-200 bg-white"}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch">
        <button
          type="button"
          onClick={onSelect}
          className="grid min-w-0 gap-0.5 px-2 py-1.5 text-left text-slate-900 hover:bg-[#fff4f7]"
        >
          <span className="font-semibold">{details.dropdownLabel}</span>
          <span className="text-[9px] leading-snug text-slate-600">{details.thicknessSummary}</span>
        </button>
        <button
          type="button"
          aria-expanded={detailIsOpen}
          onClick={onToggleDetail}
          className="border-l border-slate-200 px-2 text-[9px] font-semibold tracking-[0.08em] text-[#9f1239] hover:bg-[#fff4f7]"
        >
          {detailIsOpen ? "Less" : "More"}
        </button>
      </div>
      {detailIsOpen ? (
        <div className="border-t border-slate-200 bg-[#fffafb] px-1 py-1">
          <WallConstructionDetails construction={details.construction} />
        </div>
      ) : null}
    </div>
  );
}

function WallConstructionDetails({ construction }: { construction: string }) {
  return (
    <div className="px-1 py-1 leading-snug">
      <span className="font-semibold">Construction: </span>
      <span>{construction}</span>
    </div>
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
