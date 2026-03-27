export function HeatLoadFormPanel() {
  return (
    <aside className="min-h-0 overflow-hidden border-b border-rose-100 bg-[#fff8fa] xl:border-r xl:border-b-0">
      <div className="flex h-full min-h-0 flex-col p-4">
        <div className="border-b border-rose-100 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#be123c]">Heat Load Form</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Form Panel</h2>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-6">
          <div className="flex h-full min-h-[320px] w-full items-center justify-center border border-dashed border-rose-200 bg-white text-sm text-rose-500">
            Form content area
          </div>
        </div>
      </div>
    </aside>
  );
}
