type CompletionBadgeProps = {
  percent: number;
};

export function CompletionBadge({ percent }: CompletionBadgeProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const toneClass =
    clamped === 100
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : clamped >= 50
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span
      className={`inline-flex min-w-[46px] items-center justify-center rounded-md border px-1.5 py-1 text-[10px] font-semibold leading-none ${toneClass}`}
      aria-label={`${clamped}% complete`}
      title={`${clamped}% complete`}
    >
      {clamped}%
    </span>
  );
}
