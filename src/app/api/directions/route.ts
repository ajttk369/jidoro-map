import { NextResponse } from "next/server";
import { getTransitArrivals } from "@/lib/tagoTransit";
import { calculateDistanceMeters, formatDistance, isValidPoint } from "@/lib/placeUtils";
import { ApiError, fetchApiJson, publicError, readCoordinate, requestScope, validateRequest } from "@/lib/serverRequest";
import type { RouteInfo, RouteMode, RouteSegment, TrafficLevel } from "@/types/place";

export const dynamic = "force-dynamic";
interface DrivingRoute {
  summary?: { distance?: number; duration?: number };
  path?: Array<[number, number]>;
  section?: Array<{ pointIndex: number; pointCount: number; congestion: number }>;
  guide?: Array<{ instructions?: string }>;
}
interface DirectionsResponse { code?: number; route?: { trafast?: DrivingRoute[] } }

function duration(milliseconds: number) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60000));
  return minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

async function driving(start: { lat: number; lng: number }, goal: { lat: number; lng: number }, signal: AbortSignal): Promise<RouteInfo> {
  const id = process.env.NAVER_CLOUD_MAP_CLIENT_ID || process.env.NAVER_MAPS_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const secret = process.env.NAVER_CLOUD_MAP_CLIENT_SECRET || process.env.NAVER_MAPS_CLIENT_SECRET;
  if (!id || !secret) throw new ApiError(503, "자동차 길찾기 API 설정이 필요합니다.");
  const url = new URL("https://maps.apigw.ntruss.com/map-direction/v1/driving");
  url.searchParams.set("start", `${start.lng},${start.lat}`);
  url.searchParams.set("goal", `${goal.lng},${goal.lat}`);
  url.searchParams.set("option", "trafast");
  const data = await fetchApiJson<DirectionsResponse>(url, {
    headers: { "x-ncp-apigw-api-key-id": id, "x-ncp-apigw-api-key": secret }
  }, signal);
  if (data.code !== 0) throw new ApiError(422, "자동차 경로를 찾지 못했습니다. 도로에 가까운 출발지와 도착지를 선택해주세요.");
  const route = data.route?.trafast?.[0];
  const distance = route?.summary?.distance;
  const time = route?.summary?.duration;
  if (!route || !Array.isArray(route.path) || route.path.length < 2 ||
      typeof distance !== "number" || !Number.isFinite(distance) || distance < 0 ||
      typeof time !== "number" || !Number.isFinite(time) || time < 0) {
    throw new ApiError(502, "자동차 경로 응답을 처리하지 못했습니다.");
  }
  const path = route.path.map(point => ({ lng: point?.[0], lat: point?.[1] }));
  if (!path.every(isValidPoint)) throw new ApiError(502, "경로 좌표가 올바르지 않습니다.");
  const segments: RouteSegment[] = [{ kind: "car", color: "#2563EB", label: "자동차 경로", path }];
  const traffic: Record<number, { traffic: TrafficLevel; color: string; label: string }> = {
    1: { traffic: "smooth", color: "#16A34A", label: "원활" },
    2: { traffic: "slow", color: "#F59E0B", label: "서행" },
    3: { traffic: "jam", color: "#EF4444", label: "정체" }
  };
  // Only provider-reported sections receive traffic colors.
  for (const section of Array.isArray(route.section) ? route.section : []) {
    const state = traffic[section.congestion];
    const end = section.pointIndex + section.pointCount;
    if (!state || !Number.isInteger(section.pointIndex) || !Number.isInteger(section.pointCount) ||
        section.pointIndex < 0 || section.pointCount < 2 || end > path.length) continue;
    segments.push({ kind: "traffic", ...state, path: path.slice(section.pointIndex, end) });
  }
  return {
    mode: "car", source: "road", checkedAt: new Date().toISOString(),
    distance: formatDistance(distance), duration: duration(time), title: "자동차 빠른 경로",
    summary: "네이버 Directions 5 조회 경로입니다. 교통 상태는 응답에 포함된 구간에만 표시합니다.",
    steps: (Array.isArray(route.guide) ? route.guide : []).map(item => item.instructions)
      .filter((text): text is string => typeof text === "string" && !!text.trim()).slice(0, 100),
    routeSegments: segments, path
  };
}

export async function GET(request: Request) {
  const scope = requestScope(request);
  try {
    validateRequest(request);
    const params = new URL(request.url).searchParams;
    const mode = (params.get("mode") || "car") as RouteMode;
    if (!["car", "transit", "walk", "bike"].includes(mode)) throw new ApiError(400, "이동 수단을 확인해주세요.");
    const start = { lat: readCoordinate(params, "startLat", 90), lng: readCoordinate(params, "startLng", 180) };
    const goal = { lat: readCoordinate(params, "goalLat", 90), lng: readCoordinate(params, "goalLng", 180) };
    const originQuery = params.get("originQuery")?.trim() || "";
    const destinationQuery = params.get("destinationQuery")?.trim() || "";
    if (originQuery.length > 200 || destinationQuery.length > 200) throw new ApiError(400, "장소명은 200자까지 입력할 수 있습니다.");
    if (start.lat === goal.lat && start.lng === goal.lng) throw new ApiError(400, "출발지와 도착지가 같습니다.");
    if (mode === "car") return NextResponse.json(await driving(start, goal, scope.signal));
    const distance = formatDistance(calculateDistanceMeters(start, goal));
    if (mode === "transit") {
      const transit = await getTransitArrivals({ start, goal, originQuery, destinationQuery, distance, signal: scope.signal });
      return NextResponse.json({
        mode, source: "transit-candidates", checkedAt: new Date().toISOString(),
        distance: `직선 ${distance}`, duration: "미확인", title: "대중교통 이용 후보",
        summary: "주변 정류장·역의 조회 결과입니다. 목적지 연결, 환승, 전체 이동 시간과 요금은 확인되지 않았습니다.",
        steps: ["출발지·도착지 주변 정보를 확인하세요.", "해당 노선의 목적지 운행 여부를 별도로 확인하세요."],
        transitArrivals: transit.arrivals, transitPlans: transit.plans, transitLegs: transit.legs,
        busArrivalNotice: transit.notice || undefined, path: []
      } satisfies RouteInfo);
    }
    const label = mode === "walk" ? "도보" : "자전거";
    const path = [start, goal];
    return NextResponse.json({
      mode, source: "reference", checkedAt: new Date().toISOString(),
      distance: `직선 ${distance}`, duration: "미확인", title: `${label} 이동 참고`,
      summary: "점선은 두 지점을 연결한 참고선이며 실제 이동 경로가 아닙니다. 도로·통행 가능 여부와 이동 시간은 확인되지 않았습니다.",
      steps: ["표시된 거리는 출발지와 도착지의 직선 거리입니다.", "실제 이동 전 통행 가능한 경로를 확인하세요."],
      routeSegments: [{ kind: mode, color: mode === "walk" ? "#64748B" : "#2563EB", label: "직선 참고선", path }],
      path
    } satisfies RouteInfo);
  } catch (error) {
    const failure = publicError(error);
    return NextResponse.json({ message: failure.message }, { status: failure.status });
  } finally { scope.dispose(); }
}

