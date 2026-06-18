import type { TransitArrival, TransitLeg, TransitPlan } from "@/types/place";

type AnyRecord = Record<string, unknown>;

interface NearbyBusStation {
  cityCode: string;
  nodeId: string;
  nodeName: string;
}

const TAGO_BASE = "https://apis.data.go.kr/1613000";

function getServiceKey(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return normalizeServiceKey(value);
    }
  }

  return normalizeServiceKey(process.env.TAGO_SERVICE_KEY || "");
}

function normalizeServiceKey(value: string) {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function getString(record: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeItems(data: unknown) {
  const root = asRecord(data);
  const response = asRecord(root.response);
  const body = asRecord(response.body);
  const items = asRecord(body.items);
  const item = items.item;

  if (Array.isArray(item)) {
    return item.map(asRecord);
  }

  if (item && typeof item === "object") {
    return [asRecord(item)];
  }

  return [];
}

async function fetchTagoJson(path: string, params: Record<string, string>, serviceKey: string) {
  if (!serviceKey) {
    return null;
  }

  const url = new URL(`${TAGO_BASE}/${path}`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("_type", "json");

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatArrivalMinutes(value: string) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { text: "도착 정보 확인", minutes: undefined };
  }

  const minutes = numeric > 120 ? Math.ceil(numeric / 60) : Math.ceil(numeric);
  return { text: `${minutes}분 후`, minutes };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function extractSubwayKeywords(...queries: string[]) {
  const keywords: string[] = [];

  for (const query of queries) {
    const compact = query.replace(/\s+/g, "");
    const stationMatches = compact.match(/[가-힣A-Za-z0-9]+역/g) ?? [];
    keywords.push(...stationMatches.map((match) => match.replace(/역$/, "")));

    if (compact.includes("지하철") || compact.includes("역")) {
      keywords.push(compact.replace(/역/g, "").replace(/지하철/g, ""));
    }
  }

  return unique(keywords).slice(0, 6);
}

function formatRouteType(value: string, routeName: string) {
  const normalized = value.trim();

  if (normalized.includes("마을") || normalized === "3" || normalized === "30") {
    return "마을버스";
  }

  if (normalized.includes("좌석")) {
    return "좌석버스";
  }

  if (normalized.includes("급행") || normalized.includes("광역")) {
    return "광역버스";
  }

  if (/^[0-9]{1,2}$/.test(routeName) || /^[0-9]{2,3}-[0-9]$/.test(routeName)) {
    return "마을버스";
  }

  return normalized || "일반버스";
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

async function getNearbyBusStations(lat: number, lng: number): Promise<NearbyBusStation[]> {
  const serviceKey = getServiceKey("TAGO_BUS_STATION_SERVICE_KEY");
  const data = await fetchTagoJson(
    "BusSttnInfoInqireService/getCrdntPrxmtSttnList",
    {
      gpsLati: String(lat),
      gpsLong: String(lng),
      numOfRows: "10",
      pageNo: "1"
    },
    serviceKey
  );

  return normalizeItems(data)
    .map((item) => ({
      cityCode: getString(item, ["citycode", "cityCode", "ctyCode"]),
      nodeId: getString(item, ["nodeid", "nodeId", "stationId"]),
      nodeName: getString(item, ["nodenm", "nodeNm", "nodeName", "stationName"])
    }))
    .filter((station) => station.cityCode && station.nodeId && station.nodeName);
}

async function getBusArrivalsByStation(station: NearbyBusStation): Promise<TransitArrival[]> {
  const serviceKey = getServiceKey("TAGO_BUS_ARRIVAL_SERVICE_KEY");
  const data = await fetchTagoJson(
    "ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList",
    {
      cityCode: station.cityCode,
      nodeId: station.nodeId,
      numOfRows: "30",
      pageNo: "1"
    },
    serviceKey
  );

  return normalizeItems(data).slice(0, 16).map((item) => {
    const routeName = getString(item, ["routeno", "routeNo", "routename", "routeName", "busRouteNm"]);
    const rawRouteType = getString(item, ["routetp", "routeTp", "routeType", "routeTypeCd", "routeTypeName"]);
    const routeType = formatRouteType(rawRouteType, routeName);
    const arrival = formatArrivalMinutes(getString(item, ["arrtime", "arrTime", "predictTime1", "predictTimeSec1"]));
    const prevCount = getString(item, ["arrprevstationcnt", "arrPrevStationCnt", "locationNo1"]);
    const vehicle = getString(item, ["vehicletp", "vehicleTp", "plateNo1", "vehicleNo"]);
    const detail = [routeType, prevCount ? `${prevCount}정류장 전` : "", vehicle].filter(Boolean).join(" · ");

    return {
      type: "bus",
      title: routeName ? `${routeName}번` : routeType,
      stationName: station.nodeName,
      routeName,
      routeType,
      arrivalText: arrival.text,
      minutes: arrival.minutes,
      detail,
      vehicle
    };
  });
}

function subwayFallback(keyword: string): TransitArrival {
  const stationName = keyword.endsWith("역") ? keyword : `${keyword}역`;

  return {
    type: "subway",
    title: "지하철",
    stationName,
    routeName: "노선 확인",
    arrivalText: "가까운 역",
    minutes: 8,
    detail: "TAGO 지하철 응답이 없어서 검색어 기준 역 후보로 표시합니다."
  };
}

async function getSubwayStations(keyword: string): Promise<TransitArrival[]> {
  const serviceKey = getServiceKey("TAGO_SUBWAY_SERVICE_KEY");
  const normalizedKeyword = keyword.replace(/\s+/g, "").replace(/역$/, "");

  if (!normalizedKeyword) {
    return [];
  }

  const data = await fetchTagoJson(
    "SubwayInfoService/GetKwrdFndSubwaySttnList",
    {
      subwayStationName: normalizedKeyword,
      stationName: normalizedKeyword,
      sttnNm: normalizedKeyword,
      numOfRows: "8",
      pageNo: "1"
    },
    serviceKey
  );

  const items = normalizeItems(data).slice(0, 6).map((item) => {
    const stationName =
      getString(item, [
        "subwaystationname",
        "subwayStationName",
        "subwayStationNm",
        "stationName",
        "sttnNm"
      ]) || `${normalizedKeyword}역`;
    const lineName = getString(item, [
      "subwayrouteName",
      "subwayRouteName",
      "subwayRouteNm",
      "lineName",
      "routeNm"
    ]);

    return {
      type: "subway" as const,
      title: lineName || "지하철",
      stationName,
      routeName: lineName,
      arrivalText: "역 정보 확인",
      minutes: 8,
      detail: "TAGO 지하철역 검색 결과"
    };
  });

  return items.length > 0 ? items : [subwayFallback(normalizedKeyword)];
}

function buildBusLegs(bus: TransitArrival, originQuery: string, destinationQuery: string): TransitLeg[] {
  return [
    {
      type: "walk",
      title: "도보",
      from: originQuery || "출발지",
      to: bus.stationName,
      duration: "3분",
      detail: "가까운 정류장까지 이동",
      color: "#94A3B8"
    },
    {
      type: "bus",
      title: bus.routeName ? `${bus.routeName}번` : bus.title,
      from: bus.stationName,
      to: destinationQuery || "도착지 주변 정류장",
      duration: bus.arrivalText,
      detail: bus.detail || "버스 이동 구간",
      color: bus.routeType === "마을버스" ? "#84CC16" : "#65A30D"
    },
    {
      type: "walk",
      title: "도보",
      from: "하차 정류장",
      to: destinationQuery || "도착지",
      duration: "5분",
      detail: "도착지까지 이동",
      color: "#94A3B8"
    }
  ];
}

function buildSubwayLegs(subway: TransitArrival, originQuery: string, destinationQuery: string): TransitLeg[] {
  return [
    {
      type: "walk",
      title: "도보",
      from: originQuery || "출발지",
      to: subway.stationName,
      duration: "4분",
      detail: "가까운 지하철역까지 이동",
      color: "#94A3B8"
    },
    {
      type: "subway",
      title: subway.routeName || subway.title,
      from: subway.stationName,
      to: destinationQuery || "도착지 주변 역",
      duration: "예상 13분",
      detail: "지하철 이동 구간",
      color: "#10B981"
    },
    {
      type: "walk",
      title: "도보",
      from: "하차역",
      to: destinationQuery || "도착지",
      duration: "3분",
      detail: "도착지까지 이동",
      color: "#94A3B8"
    }
  ];
}

function buildPlan({
  id,
  label,
  title,
  primaryType,
  durationMinutes,
  distance,
  fare,
  summary,
  legs,
  arrivals
}: Omit<TransitPlan, "duration" | "departureTime" | "arrivalTime">): TransitPlan {
  const now = new Date();

  return {
    id,
    label,
    title,
    primaryType,
    duration: `${durationMinutes}분`,
    durationMinutes,
    distance,
    fare,
    departureTime: formatClock(now),
    arrivalTime: formatClock(addMinutes(now, durationMinutes)),
    summary,
    legs,
    arrivals
  };
}

function buildTransitPlans(
  arrivals: TransitArrival[],
  originQuery: string,
  destinationQuery: string,
  distance: string
) {
  const buses = arrivals.filter((arrival) => arrival.type === "bus");
  const subways = arrivals.filter((arrival) => arrival.type === "subway");
  const plans: TransitPlan[] = [];

  const fastestSubway = [...subways].sort((a, b) => (a.minutes ?? 99) - (b.minutes ?? 99))[0];
  const fastestBus = [...buses].sort((a, b) => (a.minutes ?? 99) - (b.minutes ?? 99))[0];

  if (fastestSubway) {
    plans.push(
      buildPlan({
        id: "best-subway",
        label: "최적",
        title: fastestSubway.routeName || fastestSubway.title,
        primaryType: "subway",
        durationMinutes: Math.max(20, (fastestSubway.minutes ?? 8) + 12),
        distance,
        fare: "1,550원",
        summary: `${fastestSubway.stationName} 기준 가장 가까운 지하철 후보입니다.`,
        legs: buildSubwayLegs(fastestSubway, originQuery, destinationQuery),
        arrivals: [fastestSubway]
      })
    );
  }

  if (fastestBus) {
    plans.push(
      buildPlan({
        id: "best-bus",
        label: fastestBus.routeType === "마을버스" ? "마을버스" : "버스",
        title: fastestBus.routeName ? `${fastestBus.routeName}번` : fastestBus.title,
        primaryType: "bus",
        durationMinutes: Math.max(24, (fastestBus.minutes ?? 10) + 16),
        distance,
        fare: fastestBus.routeType === "마을버스" ? "1,200원" : "1,550원",
        summary: `${fastestBus.stationName}에서 ${fastestBus.arrivalText} 도착 예정입니다.`,
        legs: buildBusLegs(fastestBus, originQuery, destinationQuery),
        arrivals: [fastestBus]
      })
    );
  }

  if (fastestBus && fastestSubway) {
    plans.push(
      buildPlan({
        id: "mixed",
        label: "버스+지하철",
        title: `${fastestBus.routeName || "버스"} → ${fastestSubway.routeName || "지하철"}`,
        primaryType: "mixed",
        durationMinutes: Math.max(28, (fastestBus.minutes ?? 8) + (fastestSubway.minutes ?? 8) + 14),
        distance,
        fare: "1,650원",
        summary: "버스와 지하철을 함께 이용하는 대중교통 후보입니다.",
        legs: [
          ...buildBusLegs(fastestBus, originQuery, "환승역").slice(0, 2),
          ...buildSubwayLegs(fastestSubway, "환승역", destinationQuery).slice(1)
        ],
        arrivals: [fastestBus, fastestSubway]
      })
    );
  }

  return plans.sort((a, b) => a.durationMinutes - b.durationMinutes);
}

export async function getTransitArrivals({
  start,
  goal,
  originQuery,
  destinationQuery,
  distance
}: {
  start: { lat: number; lng: number };
  goal: { lat: number; lng: number };
  originQuery: string;
  destinationQuery: string;
  distance: string;
}) {
  const arrivals: TransitArrival[] = [];
  const notices: string[] = [];

  try {
    const startStations = await getNearbyBusStations(start.lat, start.lng);
    const goalStations = await getNearbyBusStations(goal.lat, goal.lng);
    const targetStations = [...startStations.slice(0, 2), ...goalStations.slice(0, 2)];
    const busArrivals = (
      await Promise.all(targetStations.map((station) => getBusArrivalsByStation(station)))
    ).flat();

    arrivals.push(...busArrivals);

    if (targetStations.length === 0) {
      notices.push("주변 버스 정류장을 찾지 못했습니다.");
    } else if (busArrivals.length === 0) {
      notices.push("가까운 정류장은 찾았지만 도착 예정 버스가 없습니다.");
    }
  } catch {
    notices.push("버스 도착 정보를 불러오지 못했습니다.");
  }

  try {
    const subwayKeywords = extractSubwayKeywords(originQuery, destinationQuery);
    const subwayArrivals = (
      await Promise.all(subwayKeywords.map((keyword) => getSubwayStations(keyword)))
    ).flat();
    arrivals.push(...subwayArrivals);
  } catch {
    notices.push("지하철 정보를 불러오지 못했습니다.");
  }

  const slicedArrivals = arrivals.slice(0, 14);
  const plans = buildTransitPlans(slicedArrivals, originQuery, destinationQuery, distance);

  return {
    arrivals: slicedArrivals,
    legs: plans[0]?.legs ?? [],
    plans,
    notice: notices.join(" ")
  };
}
