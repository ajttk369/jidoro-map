"use client";

import { Heart, LocateFixed, Search, X } from "lucide-react";
import LogoMark from "@/components/LogoMark";

interface HeaderProps {
  query: string;
  favoritesActive: boolean;
  onQueryChange: (query: string) => void;
  onCurrentLocation: () => void;
  onToggleFavorites: () => void;
}

export default function Header({
  query,
  favoritesActive,
  onQueryChange,
  onCurrentLocation,
  onToggleFavorites
}: HeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-jidoro-line bg-white">
      <div className="mx-auto grid h-[72px] max-w-[1600px] grid-cols-[168px_minmax(0,1fr)_224px] items-center gap-3 px-4 max-lg:h-auto max-lg:grid-cols-1 max-lg:py-3">
        <div className="flex items-center">
          <LogoMark />
        </div>

        <label className="relative flex min-w-0 items-center">
          <Search
            className="pointer-events-none absolute left-4 text-jidoro-muted"
            size={19}
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="장소명 또는 주소를 검색하세요"
            className="h-11 w-full rounded-lg border border-jidoro-line bg-jidoro-surface px-11 text-[15px] text-jidoro-ink outline-none transition placeholder:text-jidoro-muted focus:border-jidoro-blue focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-3 flex size-7 items-center justify-center rounded-md text-jidoro-muted hover:bg-slate-100 hover:text-jidoro-ink"
              title="검색어 지우기"
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCurrentLocation}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-jidoro-line bg-white px-3 text-sm font-semibold text-jidoro-ink transition hover:border-jidoro-blue hover:text-jidoro-blue"
            title="현재 위치"
          >
            <LocateFixed size={17} aria-hidden="true" />
            <span>현 위치</span>
          </button>
          <button
            type="button"
            onClick={onToggleFavorites}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
              favoritesActive
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-jidoro-line bg-white text-jidoro-ink hover:border-rose-200 hover:text-rose-600"
            }`}
            title="즐겨찾기"
          >
            <Heart size={17} fill={favoritesActive ? "currentColor" : "none"} aria-hidden="true" />
            <span>즐겨찾기</span>
          </button>
        </div>
      </div>
    </header>
  );
}
