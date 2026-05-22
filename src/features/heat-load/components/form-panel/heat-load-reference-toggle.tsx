export function RowReferenceToggle({
  rowId,
  referenceText,
  referenceIsOpen,
  onToggleReference,
}: {
  rowId: string;
  referenceText: string;
  referenceIsOpen: boolean;
  onToggleReference: () => void;
}) {
  if (!referenceText) {
    return <span>{rowId}</span>;
  }

  return (
    <div className="flex min-h-[24px] items-center justify-center gap-1">
      <button
        type="button"
        aria-label={`${rowId} reference`}
        aria-expanded={referenceIsOpen}
        title={referenceIsOpen ? "Hide ASHRAE reference" : "Show ASHRAE reference"}
        onClick={onToggleReference}
        className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-[#fff4f7] text-slate-900"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 10 6"
          className={`h-[6px] w-[10px] transition-transform ${referenceIsOpen ? "rotate-180" : ""}`}
        >
          <path
            d="M1 1l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      <span>{rowId}</span>
    </div>
  );
}
