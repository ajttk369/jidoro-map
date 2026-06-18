import type { Place } from "@/types/place";

export interface NaverLocalItem {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

export interface NaverLocalResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverLocalItem[];
}

const categoryRules: Array<[Place["category"], string[]]> = [
  ["카페", ["카페", "커피", "디저트", "베이커리"]],
  ["음식점", ["음식점", "한식", "중식", "일식", "양식", "분식", "맛집", "레스토랑"]],
  ["편의점", ["편의점"]],
  ["병원", ["병원", "의원", "약국", "의료"]],
  ["지하철역", ["지하철", "역"]],
  ["주차장", ["주차"]],
  ["공원", ["공원"]]
];

export function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").trim();
}

export function normalizeCategory(rawCategory: string): Place["category"] {
  const plainCategory = stripHtml(rawCategory);
  const match = categoryRules.find(([, keywords]) =>
    keywords.some((keyword) => plainCategory.includes(keyword))
  );

  return match?.[0] ?? "기타";
}

function parseNaverCoordinate(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  return numericValue / 10000000;
}

export function toPlace(item: NaverLocalItem, index: number): Place {
  const name = stripHtml(item.title);
  const rawCategory = stripHtml(item.category);
  const description = stripHtml(item.description);
  const lng = parseNaverCoordinate(item.mapx);
  const lat = parseNaverCoordinate(item.mapy);

  return {
    id: `${item.mapx}-${item.mapy}-${index}`,
    name,
    category: normalizeCategory(rawCategory),
    rawCategory,
    address: stripHtml(item.address),
    roadAddress: stripHtml(item.roadAddress),
    distance: "검색 결과",
    status: "정보 확인 필요",
    rating: null,
    description: description || `${name}의 네이버 지역 검색 결과입니다.`,
    lat,
    lng,
    mapx: Number(item.mapx),
    mapy: Number(item.mapy),
    hours: "영업시간 정보 없음",
    phone: item.telephone ? stripHtml(item.telephone) : "전화번호 정보 없음",
    parking: false,
    link: item.link
  };
}
