const drawingGridStyle = {
  backgroundImage:
    "linear-gradient(rgba(0, 0, 0, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.12) 1px, transparent 1px)",
  backgroundSize: "30px 30px",
};

export function HeatLoadCanvasPanel() {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden bg-white">
      <div className="border-b border-rose-100 bg-white px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#be123c]">Drawing Area</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Canvas Panel</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div
          className="relative flex h-full w-full flex-1 items-center justify-center overflow-hidden border border-rose-100 bg-white"
          style={drawingGridStyle}
        >
          <div className="border border-rose-200 bg-white px-4 py-2 text-sm text-rose-500">
            Canvas area
          </div>
        </div>
      </div>
    </section>
  );
}
