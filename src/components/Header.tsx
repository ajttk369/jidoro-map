"use client";

import { Heart, LocateFixed, Route, Search, X } from "lucide-react";
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
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 border-b border-transparent bg-transparent lg:pointer-events-auto lg:border-jidoro-line/70 lg:bg-white/95 lg:backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-3 pt-3 lg:grid lg:h-[72px] lg:grid-cols-[168px_minmax(0,1fr)_232px] lg:items-center lg:gap-4 lg:px-5 lg:pt-0">
        <div className="hidden lg:flex lg:items-center">
          <LogoMark />
        </div>

        <label className="pointer-events-auto relative flex min-w-0 items-center rounded-2xl bg-white shadow-panel ring-1 ring-slate-200/80 lg:col-start-2 lg:row-start-1 lg:rounded-2xl lg:border lg:border-transparent lg:bg-slate-50 lg:shadow-none lg:ring-1 lg:ring-slate-200 lg:transition lg:focus-within:bg-white lg:focus-within:ring-4 lg:focus-within:ring-blue-100">
          <span className="absolute left-2.5 flex size-8 items-center justify-center overflow-hidden rounded-xl bg-jidoro-blue text-white lg:hidden">
            <span className="absolute -right-1.5 -top-2 size-4 rounded-full bg-jidoro-green/80" />
            <Route size={17} strokeWidth={2.6} aria-hidden="true" />
          </span>
          <Search
            className="pointer-events-none absolute left-4 hidden text-jidoro-muted lg:block"
            size={19}
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="장소명 또는 주소를 검색하세요"
            className="h-12 w-full rounded-2xl bg-transparent pl-14 pr-11 text-[15px] text-jidoro-ink outline-none placeholder:text-jidoro-muted lg:h-12 lg:px-11"
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

        <div className="pointer-events-auto absolute right-3 top-3 flex gap-2 lg:static lg:col-start-3 lg:row-start-1 lg:grid lg:grid-cols-2">
          <button
            type="button"
            onClick={onCurrentLocation}
            className="hidden h-11 items-center justify-center gap-2 rounded-2xl border border-jidoro-line bg-white px-3 text-sm font-semibold text-jidoro-ink transition hover:border-jidoro-blue hover:bg-blue-50 hover:text-jidoro-blue lg:inline-flex"
            title="현재 위치"
          >
            <LocateFixed size={17} aria-hidden="true" />
            <span>현 위치</span>
          </button>
          <button
            type="button"
            onClick={onToggleFavorites}
            className={`hidden h-11 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition lg:inline-flex ${
              favoritesActive
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-jidoro-line bg-white text-jidoro-ink hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
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
