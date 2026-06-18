export type PlaceCategory =
  | "전체"
  | "카페"
  | "음식점"
  | "편의점"
  | "병원"
  | "지하철역"
  | "주차장"
  | "공원"
  | "주소"
  | "기타";

export interface Place {
  id: string;
  name: string;
  category: Exclude<PlaceCategory, "전체">;
  rawCategory: string;
  address: string;
  roadAddress: string;
  distance: string;
  status: string;
  rating: number | null;
  description: string;
  lat?: number;
  lng?: number;
  mapx?: number;
  mapy?: number;
  hours: string;
  phone: string;
  parking: boolean;
  link?: string;
}

export type RouteMode = "transit" | "car" | "walk" | "bike";
export type RouteSegmentKind = "walk" | "bus" | "subway" | "car" | "bike" | "traffic";
export type TrafficLevel = "smooth" | "slow" | "jam";

export interface TransitArrival {
  type: "bus" | "subway";
  title: string;
  stationName: string;
  routeName?: string;
  routeType?: string;
  arrivalText: string;
  minutes?: number;
  detail?: string;
  vehicle?: string;
  congestion?: string;
}

export interface TransitLeg {
  type: "walk" | "bus" | "subway";
  title: string;
  from: string;
  to: string;
  duration: string;
  detail: string;
  color: string;
}

export interface TransitPlan {
  id: string;
  label: string;
  title: string;
  primaryType: "bus" | "subway" | "mixed";
  duration: string;
  durationMinutes: number;
  distance: string;
  fare: string;
  departureTime: string;
  arrivalTime: string;
  summary: string;
  legs: TransitLeg[];
  arrivals: TransitArrival[];
}

export interface RouteSegment {
  kind: RouteSegmentKind;
  color: string;
  traffic?: TrafficLevel;
  label: string;
  path: Array<{ lat: number; lng: number }>;
}

export interface RouteInfo {
  mode: RouteMode;
  distance: string;
  duration: string;
  title: string;
  summary: string;
  steps: string[];
  transitLines?: string[];
  transitArrivals?: TransitArrival[];
  transitLegs?: TransitLeg[];
  transitPlans?: TransitPlan[];
  routeSegments?: RouteSegment[];
  busArrivalNotice?: string;
  path: Array<{ lat: number; lng: number }>;
}
