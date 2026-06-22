"use client";

import { Heart, Map, Navigation, Star } from "lucide-react";
import type { Place } from "@/types/place";

interface PlaceCardProps {
  index: number;
  place: Place;
  selected: boolean;
  favorite: boolean;
  onSelect: (place: Place) => void;
  onToggleFavorite: (place: Place) => void;
  onSetDestination: (place: Place) => void;
}

export default function PlaceCard({
  index,
  place,
  selected,
  favorite,
  onSelect,
  onToggleFavorite,
  onSetDestination
}: PlaceCardProps) {
  return (
    <article
      className={`rounded-2xl border bg-white p-3 transition lg:p-4 ${
        selected
          ? "border-blue-200 shadow-panel ring-4 ring-blue-100"
          : "border-transparent shadow-sm ring-1 ring-slate-200/70 hover:-translate-y-0.5 hover:shadow-panel"
      }`}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onSelect(place)}
          className={`mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white shadow-sm ${
            selected ? "bg-jidoro-blue" : "bg-jidoro-green"
          }`}
          aria-label={`${place.name} 선택`}
        >
          {index}
        </button>

        <button type="button" onClick={() => onSelect(place)} className="min-w-0 flex-1 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-extrabold text-jidoro-ink">{place.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-jidoro-blue">
                  {place.category}
                </span>
                {place.rating ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                    <Star size={13} fill="currentColor" aria-hidden="true" />
                    {place.rating.toFixed(1)}
                  </span>
                ) : null}
                <span className="text-xs font-semibold text-jidoro-green">{place.status}</span>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-jidoro-muted">
              {place.distance}
            </span>
          </div>
          <p className="mt-2 line-clamp-1 text-sm text-jidoro-muted">
            {place.roadAddress || place.address || "주소 정보 없음"}
          </p>
          <p className="mt-1 line-clamp-1 text-sm text-jidoro-ink">{place.description}</p>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 pl-10">
        <button
          type="button"
          onClick={() => onSelect(place)}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-jidoro-blue px-2 text-xs font-bold text-white transition hover:bg-blue-700"
        >
          <Map size={14} aria-hidden="true" />
          상세
        </button>
        <button
          type="button"
          onClick={() => onSetDestination(place)}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-jidoro-line bg-white px-2 text-xs font-bold text-jidoro-ink transition hover:border-jidoro-blue hover:bg-blue-50 hover:text-jidoro-blue"
        >
          <Navigation size={14} aria-hidden="true" />
          도착
        </button>
        <button
          type="button"
          onClick={() => onToggleFavorite(place)}
          className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition ${
            favorite
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-jidoro-line bg-white text-jidoro-ink hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          }`}
        >
          <Heart size={14} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
          저장
        </button>
      </div>
    </article>
  );
}
