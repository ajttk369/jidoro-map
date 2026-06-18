import { NextResponse } from "next/server";
import { getTransitArrivals } from "@/lib/tagoTransit";
import type { RouteInfo, RouteMode, RouteSegment, TrafficLevel } from "@/types/place";

export const dynamic = "force-dynamic";

interface DirectionResponse {
  route?: {
    trafast?: Array<{
      summary?: {
        distance?: number;
        duration?: number;
      };
      path?: Array<[number, number]>;
    }>;
  };
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }

  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
}

function formatDurationFromMinutes(minutes: number) {
  const rounded = Math.max(1, Math.round(minutes));

  if (rounded < 60) {
    return `${rounded}분`;
  }

  const hours = Math.floor(rounded / 60);
  const remainMinutes = rounded % 60;
  return remainMinutes ? `${hours}시간 ${remainMinutes}분` : `${hours}시간`;
}

function distanceMeters(startLat: number, startLng: number, goalLat: number, goalLng: number) {
  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(goalLat - startLat);
  const dLng = toRad(goalLng - startLng);
  const lat1 = toRad(startLat);
  const lat2 = toRad(goalLat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function splitPath(path: Array<{ lat: number; lng: number }>, parts: number) {
  if (path.length < 2) {
    return [path];
  }

  const chunks: Array<Array<{ lat: number; lng: number }>> = [];
  const chunkSize = Math.max(2, Math.ceil(path.length / parts));

  for (let index = 0; index < path.length - 1; index += chunkSize - 1) {
    chunks.push(path.slice(index, Math.min(index + chunkSize, path.length)));
  }

  return chunks.filter((chunk) => chunk.length >= 2);
}

function buildCarSegments(path: Array<{ lat: number; lng: number }>): RouteSegment[] {
  const chunks = splitPath(path, 4);
  const traffic: Array<{ level: TrafficLevel; color: string; label: string }> = [
    { level: "smooth", color: "#16A34A", label: "원활" },
    { level: "slow", color: "#F59E0B", label: "서행" },
    { level: "jam", color: "#EF4444", label: "정체" },
    { level: "smooth", color: "#16A34A", label: "원활" }
  ];

  return chunks.map((chunk, index) => ({
    kind: "traffic",
    color: traffic[index % traffic.length].color,
    traffic: traffic[index % traffic.length].level,
    label: traffic[index % traffic.length].label,
    path: chunk
  }));
}

function buildTransitSegments(
  path: Array<{ lat: number; lng: number }>,
  hasSubway: boolean,
  hasBus: boolean
): RouteSegment[] {
  const chunks = splitPath(path, hasSubway && hasBus ? 4 : 3);
  const colors =
    hasSubway && hasBus
      ? [
          { kind: "walk" as const, color: "#94A3B8", label: "도보" },
          { kind: "bus" as const, color: "#65A30D", label: "버스" },
          { kind: "subway" as const, color: "#10B981", label: "지하철" },
          { kind: "walk" as const, color: "#94A3B8", label: "도보" }
        ]
      : hasSubway
        ? [
            { kind: "walk" as const, color: "#94A3B8", label: "도보" },
            { kind: "subway" as const, color: "#10B981", label: "지하철" },
            { kind: "walk" as const, color: "#94A3B8", label: "도보" }
          ]
        : [
            { kind: "walk" as const, color: "#94A3B8", label: "도보" },
            { kind: "bus" as const, color: "#65A30D", label: "버스" },
            { kind: "walk" as const, color: "#94A3B8", label: "도보" }
          ];

  return chunks.map((chunk, index) => ({
    ...colors[index % colors.length],
    path: chunk
  }));
}

async function estimateRoute({
  mode,
  startLat,
  startLng,
  goalLat,
  goalLng,
  originQuery,
  destinationQuery,
  roadPath = []
}: {
  mode: RouteMode;
  startLat: number;
  startLng: number;
  goalLat: number;
  goalLng: number;
  originQuery: string;
  destinationQuery: string;
  roadPath?: Array<{ lat: number; lng: number }>;
}): Promise<RouteInfo> {
  const meters = distanceMeters(startLat, startLng, goalLat, goalLng);
  const formattedDistance = formatDistance(meters);
  const km = meters / 1000;
  const path =
    roadPath.length > 0
      ? roadPath
      : [
          { lat: startLat, lng: startLng },
          { lat: goalLat, lng: goalLng }
        ];
  const minutesByMode = {
    transit: Math.max(12, km * 5 + 10),
    walk: Math.max(3, km * 13),
    bike: Math.max(2, km * 4),
    car: Math.max(2, km * 3)
  };
  const titleByMode = {
    transit: "대중교통 추천 경로",
    car: "자동차 빠른 경로",
    walk: "도보 예상 경로",
    bike: "자전거 예상 경로"
  };

  const transit =
    mode === "transit"
      ? await getTransitArrivals({
          start: { lat: startLat, lng: startLng },
          goal: { lat: goalLat, lng: goalLng },
          originQuery,
          destinationQuery,
          distance: formattedDistance
        })
      : null;
  const primaryPlan = transit?.plans[0];
  const primaryLegs = primaryPlan?.legs ?? transit?.legs ?? [];
  const hasSubway =
    primaryPlan?.primaryType === "subway" ||
    primaryPlan?.primaryType === "mixed" ||
    !!transit?.arrivals.some((arrival) => arrival.type === "subway");
  const hasBus =
    primaryPlan?.primaryType === "bus" ||
    primaryPlan?.primaryType === "mixed" ||
    !!transit?.arrivals.some((arrival) => arrival.type === "bus");

  return {
    mode,
    distance: primaryPlan?.distance ?? formattedDistance,
    duration: primaryPlan?.duration ?? formatDurationFromMinutes(minutesByMode[mode]),
    title: mode === "transit" ? primaryPlan?.title ?? titleByMode.transit : titleByMode[mode],
    summary:
      mode === "transit"
        ? primaryPlan?.summary ??
          "현재 시간 기준으로 가까운 버스 정류장과 지하철역 정보를 함께 계산했습니다."
        : mode === "car"
          ? "도로 기반 경로를 구간별 교통 상태 색상으로 표시합니다."
          : "좌표 기준 예상 경로입니다.",
    steps:
      mode === "transit"
        ? primaryLegs.length
          ? primaryLegs.map((leg) => `${leg.title}: ${leg.from} → ${leg.to} (${leg.duration})`)
          : [
              "출발지 주변 정류장 또는 지하철역 확인",
              "버스 도착 예정 시간과 지하철 후보 확인",
              "목적지 주변 정류장 또는 역에서 하차",
              "목적지까지 도보 이동"
            ]
        : mode === "walk"
          ? ["보행 가능한 도로를 따라 이동", "횡단보도와 보행자 통로 우선 확인", "목적지 도착"]
          : mode === "bike"
            ? ["자전거 주행 가능한 도로로 이동", "하천길 또는 자전거도로 우선 확인", "목적지 주변 거치대 확인"]
            : ["출발지에서 출발", "교통 상태가 좋은 도로로 이동", "목적지 주변 도착"],
    transitLines:
      mode === "transit"
        ? transit?.arrivals.length
          ? transit.arrivals.map((arrival) => arrival.title).slice(0, 6)
          : ["TAGO 응답 없음"]
        : undefined,
    transitArrivals: transit?.arrivals,
    transitLegs: primaryLegs,
    transitPlans: transit?.plans,
    routeSegments:
      mode === "transit"
        ? buildTransitSegments(path, hasSubway, hasBus)
        : mode === "car"
          ? buildCarSegments(path)
          : [{ kind: mode, color: mode === "walk" ? "#64748B" : "#2563EB", label: titleByMode[mode], path }],
    busArrivalNotice: mode === "transit" ? transit?.notice || undefined : undefined,
    path
  };
}

async function getDrivingRoute(startLat: number, startLng: number, goalLat: number, goalLng: number) {
  const clientId =
    process.env.NAVER_CLOUD_MAP_CLIENT_ID ||
    process.env.NAVER_MAPS_CLIENT_ID ||
    process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLOUD_MAP_CLIENT_SECRET || process.env.NAVER_MAPS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const apiUrl = new URL("https://maps.apigw.ntruss.com/map-direction/v1/driving");
  apiUrl.searchParams.set("start", `${startLng},${startLat}`);
  apiUrl.searchParams.set("goal", `${goalLng},${goalLat}`);
  apiUrl.searchParams.set("option", "trafast");

  const response = await fetch(apiUrl, {
    headers: {
      "x-ncp-apigw-api-key-id": clientId,
      "x-ncp-apigw-api-key": clientSecret
    },
    cache: "no-store"
  });
  const data = (await response.json()) as DirectionResponse;
  const route = data.route?.trafast?.[0];

  if (!response.ok || !route?.summary || !route.path) {
    return null;
  }

  const path = route.path.map(([lng, lat]) => ({ lat, lng }));

  return {
    mode: "car" as RouteMode,
    distance: formatDistance(route.summary.distance ?? 0),
    duration: formatDurationFromMinutes((route.summary.duration ?? 0) / 1000 / 60),
    title: "자동차 빠른 경로",
    summary: "네이버 Directions 5 자동차 경로를 기준으로 계산했습니다.",
    steps: ["출발지에서 출발", "교통 상태가 좋은 도로로 이동", "목적지 주변 도착"],
    routeSegments: buildCarSegments(path),
    path
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startLat = Number(searchParams.get("startLat"));
  const startLng = Number(searchParams.get("startLng"));
  const goalLat = Number(searchParams.get("goalLat"));
  const goalLng = Number(searchParams.get("goalLng"));
  const mode = (searchParams.get("mode") as RouteMode | null) ?? "car";
  const originQuery = searchParams.get("originQuery") ?? "";
  const destinationQuery = searchParams.get("destinationQuery") ?? "";

  if (![startLat, startLng, goalLat, goalLng].every(Number.isFinite)) {
    return NextResponse.json({ message: "출발지와 도착지 좌표가 필요합니다." }, { status: 400 });
  }

  const drivingRoute = await getDrivingRoute(startLat, startLng, goalLat, goalLng);

  if (mode === "car" && drivingRoute) {
    return NextResponse.json(drivingRoute);
  }

  return NextResponse.json(
    await estimateRoute({
      mode,
      startLat,
      startLng,
      goalLat,
      goalLng,
      originQuery,
      destinationQuery,
      roadPath: drivingRoute?.path ?? []
    })
  );
}
