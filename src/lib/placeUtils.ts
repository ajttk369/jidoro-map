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
  if (!from || !isValidPoint(from) || !isValidPoint(to)) {
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

  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))));
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
  return !!place && isValidPoint(place);
}

export function isValidPoint(point: { lat?: number; lng?: number }): point is { lat: number; lng: number } {
  return typeof point.lat === "number" && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
    typeof point.lng === "number" && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
}

export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function placeIdentity(place: Place) {
  const address = place.roadAddress || place.address;
  return address ? `${place.name.trim()}|${address.trim()}` :
    hasCoordinates(place) ? `${place.name.trim()}|${place.lat}|${place.lng}` : place.id;
}

export function normalizeSavedPlace(value: unknown): Place | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id || typeof item.name !== "string" || !item.name.trim()) return null;
  const categories = ["카페", "음식점", "편의점", "병원", "지하철역", "주차장", "공원", "주소", "기타"];
  const text = (key: string, fallback = "") => typeof item[key] === "string" ? (item[key] as string).slice(0, 1000) : fallback;
  const point = { lat: item.lat as number, lng: item.lng as number };
  return {
    id: text("id"), name: text("name"), category: categories.includes(String(item.category)) ? item.category as Place["category"] : "기타",
    rawCategory: text("rawCategory"), address: text("address"), roadAddress: text("roadAddress"),
    distance: text("distance", "거리 미확인"), status: text("status", "정보 확인 필요"),
    description: text("description"), hours: text("hours", "영업시간 정보 없음"), phone: text("phone", "전화번호 정보 없음"),
    rating: typeof item.rating === "number" && Number.isFinite(item.rating) && item.rating >= 0 && item.rating <= 5 ? item.rating : null,
    parking: item.parking === true, link: safeHttpUrl(item.link),
    ...(isValidPoint(point) ? point : {})
  };
}
