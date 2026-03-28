import { HeatLoadSheet } from "./heat-load-sheet";

export function HeatLoadFormPanel() {
  return (
    <aside className="min-h-0 overflow-hidden border-b border-rose-100 bg-[#fff8fa] xl:border-r xl:border-b-0">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-rose-100 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#be123c]">Heat Load Form</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Load Input Sheet</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          <HeatLoadSheet />
        </div>

        <div className="border-t border-rose-100 px-1 py-2">
          <div className="flex justify-end">
            <button className="border border-rose-200 bg-[#9f1239] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#881337]">
              Calculate Heat Load
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
