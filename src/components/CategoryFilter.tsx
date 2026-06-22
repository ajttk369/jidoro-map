"use client";

import { categories } from "@/data/places";
import type { PlaceCategory } from "@/types/place";

interface CategoryFilterProps {
  selectedCategory: PlaceCategory;
  counts: Record<string, number>;
  onSelectCategory: (category: PlaceCategory) => void;
}

export default function CategoryFilter({
  selectedCategory,
  counts,
  onSelectCategory
}: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1.5">
      {categories.map((category) => {
        const isSelected = selectedCategory === category;
        const count =
          category === "전체" ? Object.values(counts).reduce((sum, value) => sum + value, 0) : counts[category] ?? 0;

        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelectCategory(category)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition lg:px-4 lg:py-2 ${
              isSelected
                ? "border-jidoro-blue bg-jidoro-blue text-white shadow-md shadow-blue-500/20"
                : "border-slate-200 bg-white text-jidoro-muted shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-jidoro-blue"
            }`}
          >
            <span>{category}</span>
            {count > 0 ? <span className="ml-1 opacity-75">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
