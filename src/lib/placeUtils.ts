import type { Place } from "@/types/place";

export type SearchMode = "auto" | "place" | "address";
export type SortMode = "relevance" | "distance" | "name";
export type ResultFilter = "all" | "place" | "address";
export type PanelTab = "results" | "favorites";
export type PanelMode = "results" | "place" | "directions" | "favorites";

const addressPattern =
  /(시|군|구|읍|면|동|로|길)\s*\d|^\d{5}$|번길|대로|지번|\s\d+-?\d*|경기도|서울|부산|인천|대구|광주|대전|울산|세종|강원|충청|전라|경상|제주/;

export function inferSearchMode(query: string): Exclude<SearchMode, "auto"> {
  return addressPattern.test(query.trim()) ? "address" : "place";
}

export function getPlaceKind(place: Place): Exclude<ResultFilter, "all"> {
  return place.category === "주소" ? "address" : "place";
}

export function calculateDistanceMeters(
  from: { lat: number; lng: number } | null,
  to: { lat?: number; lng?: number }
) {
  if (!from || typeof to.lat !== "number" || typeof to.lng !== "number") {
    return null;
  }

  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatDistance(distance: number | null) {
  if (distance === null) {
    return "거리 미확인";
  }

  if (distance < 1000) {
    return `${distance}m`;
  }

  return `${(distance / 1000).toFixed(distance < 10000 ? 1 : 0)}km`;
}

export function sortPlaces(
  places: Place[],
  sortMode: SortMode,
  userLocation: { lat: number; lng: number } | null
) {
  const items = [...places];

  if (sortMode === "name") {
    return items.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  if (sortMode === "distance") {
    return items.sort((a, b) => {
      const distanceA = calculateDistanceMeters(userLocation, a) ?? Number.MAX_SAFE_INTEGER;
      const distanceB = calculateDistanceMeters(userLocation, b) ?? Number.MAX_SAFE_INTEGER;
      return distanceA - distanceB;
    });
  }

  return items;
}

export function getCategoryCounts(places: Place[]) {
  return places.reduce<Record<string, number>>((counts, place) => {
    counts[place.category] = (counts[place.category] ?? 0) + 1;
    return counts;
  }, {});
}

export function getPrimaryAddress(place: Place) {
  return place.roadAddress || place.address || place.name;
}

export function hasCoordinates(place: Place | null): place is Place & { lat: number; lng: number } {
  return !!place && typeof place.lat === "number" && typeof place.lng === "number";
}
