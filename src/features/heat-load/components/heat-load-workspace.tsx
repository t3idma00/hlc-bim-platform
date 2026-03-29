import { HeatLoadCanvasPanel } from "../../bim-model/view2D";
import { HeatLoadFormPanel } from "./form-panel";

export default function HeatLoadWorkspace() {
  return (
    <div className="h-screen overflow-hidden bg-[#fff4f6] text-slate-900">
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <header className="flex flex-col gap-4 border-b border-rose-100 bg-[#fffafb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center bg-[#9f1239] text-lg font-semibold text-white">
              H
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#be123c]">HLC Platform</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">HVAC Design Studio</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-[#9f1239] hover:bg-rose-50">Export</button>
            <button className="bg-[#be123c] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9f1239]">Run Analysis</button>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[40%_60%]">
          <HeatLoadFormPanel />
          <HeatLoadCanvasPanel />
        </main>

        <footer className="border-t border-rose-100 bg-[#fffafb] px-5 py-2 text-center text-xs text-rose-600">
          HLC Platform
        </footer>
      </div>
    </div>
  );
}
