import type { Place } from "@/types/place";
import { isValidPoint } from "@/lib/placeUtils";

interface NaverGeocodeAddress {
  roadAddress: string;
  jibunAddress: string;
  englishAddress: string;
  x: string;
  y: string;
  distance?: number;
}

export interface NaverGeocodeResponse {
  status: string;
  meta: {
    totalCount: number;
    page: number;
    count: number;
  };
  addresses: NaverGeocodeAddress[];
  errorMessage?: string;
}

export function geocodeAddressToPlace(address: NaverGeocodeAddress, index: number, query: string): Place {
  const roadAddress = address.roadAddress || "";
  const jibunAddress = address.jibunAddress || "";
  const displayAddress = roadAddress || jibunAddress || query;
  const lat = Number(address.y);
  const lng = Number(address.x);

  return {
    id: `address-${address.x}-${address.y}-${encodeURIComponent(displayAddress)}`,
    name: displayAddress,
    category: "주소",
    rawCategory: "주소",
    address: jibunAddress,
    roadAddress,
    distance: "주소 검색",
    status: "주소 확인",
    rating: null,
    description: `${displayAddress} 주소 검색 결과입니다.`,
    ...(address.x && address.y && isValidPoint({ lat, lng }) ? { lat, lng } : {}),
    hours: "해당 없음",
    phone: "해당 없음",
    parking: false,
    link: `https://map.naver.com/p/search/${encodeURIComponent(displayAddress)}`
  };
}
