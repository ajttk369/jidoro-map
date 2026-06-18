"use client";

import { ChevronDown, ListFilter, Star } from "lucide-react";
import CategoryFilter from "@/components/CategoryFilter";
import PlaceCard from "@/components/PlaceCard";
import type { PanelTab, ResultFilter, SortMode } from "@/lib/placeUtils";
import type { Place, PlaceCategory } from "@/types/place";

interface SearchPanelProps {
  places: Place[];
  selectedPlace: Place | null;
  selectedCategory: PlaceCategory;
  favoriteIds: string[];
  activeTab: PanelTab;
  sortMode: SortMode;
  resultFilter: ResultFilter;
  categoryCounts: Record<string, number>;
  isLoading: boolean;
  errorMessage: string;
  hasSearched: boolean;
  copiedText: string;
  onSelectPlace: (place: Place) => void;
  onSelectCategory: (category: PlaceCategory) => void;
  onToggleFavorite: (place: Place) => void;
  onSetDestination: (place: Place) => void;
  onSetActiveTab: (tab: PanelTab) => void;
  onSetSortMode: (mode: SortMode) => void;
  onSetResultFilter: (filter: ResultFilter) => void;
}

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "relevance", label: "관련순" },
  { value: "distance", label: "거리순" },
  { value: "name", label: "이름순" }
];

const resultFilters: Array<{ value: ResultFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "place", label: "장소" },
  { value: "address", label: "주소" }
];

export default function SearchPanel({
  places,
  selectedPlace,
  selectedCategory,
  favoriteIds,
  activeTab,
  sortMode,
  resultFilter,
  categoryCounts,
  isLoading,
  errorMessage,
  hasSearched,
  copiedText,
  onSelectPlace,
  onSelectCategory,
  onToggleFavorite,
  onSetDestination,
  onSetActiveTab,
  onSetSortMode,
  onSetResultFilter
}: SearchPanelProps) {
  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-jidoro-line bg-jidoro-surface lg:w-[400px] lg:shrink-0">
      <div className="border-b border-jidoro-line bg-white p-4">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-jidoro-surface p-1">
          <button
            type="button"
            onClick={() => onSetActiveTab("results")}
            className={`h-9 rounded-md text-sm font-extrabold transition ${
              activeTab === "results" ? "bg-white text-jidoro-blue shadow-sm" : "text-jidoro-muted"
            }`}
          >
            검색 결과
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTab("favorites")}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-extrabold transition ${
              activeTab === "favorites" ? "bg-white text-rose-600 shadow-sm" : "text-jidoro-muted"
            }`}
          >
            <Star size={15} fill={activeTab === "favorites" ? "currentColor" : "none"} />
            즐겨찾기
          </button>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-jidoro-muted">
              {activeTab === "favorites" ? "저장한 장소" : "검색 결과"}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-jidoro-ink">
              {isLoading ? "검색 중" : `${places.length}개`}
            </h1>
          </div>
          {copiedText ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-jidoro-green">
              {copiedText}
            </span>
          ) : (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-jidoro-blue">
              실시간
            </span>
          )}
        </div>

        <div className="mt-4">
          <CategoryFilter
            selectedCategory={selectedCategory}
            counts={categoryCounts}
            onSelectCategory={onSelectCategory}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="relative">
            <ListFilter
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jidoro-muted"
            />
            <select
              value={resultFilter}
              onChange={(event) => onSetResultFilter(event.target.value as ResultFilter)}
              className="h-10 w-full appearance-none rounded-lg border border-jidoro-line bg-white pl-9 pr-8 text-sm font-bold text-jidoro-ink outline-none"
            >
              {resultFilters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-jidoro-muted"
            />
          </label>
          <label className="relative">
            <select
              value={sortMode}
              onChange={(event) => onSetSortMode(event.target.value as SortMode)}
              className="h-10 w-full appearance-none rounded-lg border border-jidoro-line bg-white px-3 pr-8 text-sm font-bold text-jidoro-ink outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-jidoro-muted"
            />
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <StateBox title="장소를 검색하고 있습니다." body="네이버 검색 결과를 불러오는 중입니다." />
        ) : errorMessage ? (
          <StateBox title="검색을 불러오지 못했습니다." body={errorMessage} />
        ) : places.length > 0 ? (
          <div className="space-y-2.5">
            {places.map((place, index) => (
              <PlaceCard
                key={place.id}
                index={index + 1}
                place={place}
                selected={selectedPlace?.id === place.id}
                favorite={favoriteIds.includes(place.id)}
                onSelect={onSelectPlace}
                onToggleFavorite={onToggleFavorite}
                onSetDestination={onSetDestination}
              />
            ))}
          </div>
        ) : hasSearched || activeTab === "favorites" ? (
          <StateBox
            title={activeTab === "favorites" ? "즐겨찾기가 없습니다." : "검색 결과가 없습니다."}
            body={
              activeTab === "favorites"
                ? "장소 상세에서 저장을 누르면 이곳에서 다시 볼 수 있습니다."
                : "다른 장소명이나 주소로 검색해보세요."
            }
          />
        ) : (
          <StateBox
            title="장소나 주소를 검색해보세요."
            body="카페, 병원, 구리역 같은 장소명 또는 도로명 주소를 입력하면 결과가 표시됩니다."
          />
        )}
      </div>
    </aside>
  );
}

function StateBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-jidoro-line bg-white p-6 text-center">
      <p className="text-lg font-extrabold text-jidoro-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-jidoro-muted">{body}</p>
    </div>
  );
}
