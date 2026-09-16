export default function Loading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#fff6f7] z-50">
      <div className="flex flex-col items-center gap-5">
        {/* Logo mark */}
        <div className="w-16 h-16 rounded-2xl bg-[#f53f64] flex items-center justify-center shadow-lg">
          <span className="text-3xl font-black text-white select-none">Q</span>
        </div>

        {/* App name */}
        <div className="text-center">
          <p className="text-xl font-bold text-[#252525] tracking-tight">Quick Sale</p>
          <p className="text-xs text-[#999999] mt-0.5">Loading your workspace…</p>
        </div>

        {/* Spinner */}
        <div className="flex gap-1.5 mt-2">
          <span className="w-2 h-2 rounded-full bg-[#f53f64] animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-[#f53f64] animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-[#f53f64] animate-bounce" />
        </div>
      </div>
    </div>
  );
}
