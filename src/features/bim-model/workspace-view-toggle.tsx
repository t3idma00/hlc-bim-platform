"use client";

export type WorkspaceView = "2d" | "3d";

type WorkspaceViewToggleProps = {
  activeView: WorkspaceView;
  onChange: (view: WorkspaceView) => void;
};

const VIEW_OPTIONS: Array<{ value: WorkspaceView; label: string }> = [
  { value: "2d", label: "2D Canvas" },
  { value: "3d", label: "3D Canvas" },
];

export function WorkspaceViewToggle({
  activeView,
  onChange,
}: WorkspaceViewToggleProps) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-rose-200 bg-white p-1 shadow-sm shadow-rose-100/60">
      {VIEW_OPTIONS.map((option) => {
        const isActive = option.value === activeView;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 ${
              isActive
                ? "bg-[#be123c] text-white shadow-sm"
                : "text-slate-600 hover:bg-rose-50 hover:text-[#9f1239]"
            }`}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
