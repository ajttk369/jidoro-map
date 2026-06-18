import { Route } from "lucide-react";

export default function LogoMark() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex size-10 items-center justify-center overflow-hidden rounded-xl bg-jidoro-blue text-white shadow-sm">
        <span className="absolute -right-2 -top-3 size-6 rounded-full bg-jidoro-green/80" />
        <Route size={21} strokeWidth={2.6} aria-hidden="true" />
      </span>
      <span className="leading-none">
        <span className="block text-xl font-black text-jidoro-ink">지도로</span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-jidoro-muted">
          JIDORO
        </span>
      </span>
    </div>
  );
}
