import type { TransitArrival, TransitLeg, TransitPlan } from "@/types/place";
import { ApiError, fetchApiJson, publicError } from "@/lib/serverRequest";

type RecordValue = Record<string, unknown>;
type Station = { cityCode: string; nodeId: string; nodeName: string; area: string };
const record = (value: unknown): RecordValue => value && typeof value === "object" ? value as RecordValue : {};
function text(item: RecordValue, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) return String(value).trim().slice(0, 300);
  }
  return "";
}

function serviceKey(name: string) {
  const key = (process.env[name] || process.env.TAGO_SERVICE_KEY || "").trim();
  if (!key) throw new ApiError(503, "TAGO 교통 정보 API 설정이 필요합니다.");
  try { return decodeURIComponent(key); } catch { return key; }
}

async function tago(path: string, params: Record<string, string>, keyName: string, signal: AbortSignal) {
  const url = new URL(`https://apis.data.go.kr/1613000/${path}`);
  url.searchParams.set("serviceKey", serviceKey(keyName));
  url.searchParams.set("_type", "json");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "10");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const root = record(await fetchApiJson<unknown>(url, {}, signal));
  const response = record(root.response);
  if (!["00", "0"].includes(text(record(response.header), "resultCode"))) {
    throw new ApiError(502, "TAGO 조회에 실패했습니다. 서비스 권한과 사용량을 확인해주세요.");
  }
  const body = record(response.body);
  if (!Object.keys(body).length) throw new ApiError(502, "TAGO 응답 형식을 확인하지 못했습니다.");
  const item = record(body.items).item;
  if (Number(body.totalCount) > 0 && !Array.isArray(item) && (!item || typeof item !== "object")) {
    throw new ApiError(502, "TAGO 조회 결과를 처리하지 못했습니다.");
  }
  return Array.isArray(item) ? item.slice(0, 30).map(record) : item && typeof item === "object" ? [record(item)] : [];
}

async function stations(point: { lat: number; lng: number }, area: string, signal: AbortSignal): Promise<Station[]> {
  const items = await tago("BusSttnInfoInqireService/getCrdntPrxmtSttnList", {
    gpsLati: String(point.lat), gpsLong: String(point.lng)
  }, "TAGO_BUS_STATION_SERVICE_KEY", signal);
  return items.map(item => ({
    cityCode: text(item, "citycode", "cityCode"), nodeId: text(item, "nodeid", "nodeId"),
    nodeName: text(item, "nodenm", "nodeNm"), area
  })).filter(item => item.cityCode && item.nodeId && item.nodeName).slice(0, 2);
}

async function busArrivals(station: Station, signal: AbortSignal): Promise<TransitArrival[]> {
  const items = await tago("ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList", {
    cityCode: station.cityCode, nodeId: station.nodeId
  }, "TAGO_BUS_ARRIVAL_SERVICE_KEY", signal);
  return items.filter(item => text(item, "routeno", "routeNo")).map(item => {
    const raw = text(item, "arrtime", "arrTime");
    const seconds = raw ? Number(raw) : NaN;
    const minutes = Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds / 60) : undefined;
    const routeName = text(item, "routeno", "routeNo");
    const routeType = text(item, "routetp", "routeTp");
    const prevCount = text(item, "arrprevstationcnt", "arrPrevStationCnt");
    const vehicle = text(item, "vehicletp", "vehicleTp");
    return {
      type: "bus", title: `${routeName}번`, stationName: station.nodeName, routeName, routeType,
      arrivalText: minutes === undefined ? "도착 정보 없음" : minutes === 0 ? "곧 도착" : `${minutes}분 후`,
      minutes, vehicle,
      detail: [station.area, routeType, prevCount ? `${prevCount}정류장 전` : "", vehicle].filter(Boolean).join(" · ")
    };
  });
}

async function subwayStations(keyword: string, area: string, signal: AbortSignal): Promise<TransitArrival[]> {
  const items = await tago("SubwayInfoService/GetKwrdFndSubwaySttnList", {
    subwayStationName: keyword
  }, "TAGO_SUBWAY_SERVICE_KEY", signal);
  return items.filter(item => text(item, "subwaystationname", "subwayStationName", "subwayStationNm", "stationName", "sttnNm"))
    .slice(0, 4).map(item => {
      const stationName = text(item, "subwaystationname", "subwayStationName", "subwayStationNm", "stationName", "sttnNm");
      const routeName = text(item, "subwayroutename", "subwayrouteName", "subwayRouteName", "lineName", "routeNm");
      return { type: "subway", title: routeName || "지하철", stationName, routeName,
        arrivalText: "역 검색 결과", detail: `${area} 검색어 기준 · 열차 도착 시간 미제공` };
    });
}

function candidatePlans(arrivals: TransitArrival[], distance: string): TransitPlan[] {
  const unique = Array.from(new Map(arrivals.map(item => [`${item.type}|${item.stationName}|${item.routeName}`, item])).values());
  return unique.slice(0, 4).map((arrival, index) => {
    const leg: TransitLeg = {
      type: arrival.type, title: arrival.title, from: arrival.stationName, to: "목적지 연결 미확인",
      duration: "이동 시간 미확인", detail: "정류장·역 조회 결과이며 목적지까지 운행 여부는 확인되지 않았습니다.",
      color: arrival.type === "bus" ? "#65A30D" : "#10B981"
    };
    return {
      id: `candidate-${index}`, label: arrival.type === "bus" ? "버스 후보" : "역 후보",
      title: arrival.title, primaryType: arrival.type, duration: "미확인", durationMinutes: null,
      distance: `직선 ${distance}`, fare: "미확인", departureTime: "미확인", arrivalTime: "미확인",
      summary: `${arrival.stationName} · 목적지 연결 미확인`, legs: [leg], arrivals: [arrival]
    };
  });
}

export async function getTransitArrivals({ start, goal, originQuery, destinationQuery, distance, signal }: {
  start: { lat: number; lng: number }; goal: { lat: number; lng: number };
  originQuery: string; destinationQuery: string; distance: string; signal: AbortSignal;
}) {
  const arrivals: TransitArrival[] = [];
  const notices: string[] = [];
  let successfulLookups = 0;
  const tasks: Array<Promise<TransitArrival[]>> = [start, goal].map((point, index) =>
    stations(point, index === 0 ? "출발지 주변" : "도착지 주변", signal).then(async nearby => {
      if (!nearby.length) { successfulLookups++; return []; }
      const results = await Promise.allSettled(nearby.map(station => busArrivals(station, signal)));
      const valid: TransitArrival[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") { successfulLookups++; valid.push(...result.value); }
        else notices.push(publicError(result.reason).message);
      }
      return valid;
    }));
  [originQuery, destinationQuery].forEach((query, index) => {
    const keywords = [...new Set((query.match(/[가-힣A-Za-z0-9]+역/g) || []).map(value => value.replace(/역$/, "")))].slice(0, 2);
    keywords.forEach(keyword => tasks.push(subwayStations(keyword, index === 0 ? "출발지" : "도착지", signal).then(items => {
      successfulLookups++;
      return items;
    })));
  });
  const results = await Promise.allSettled(tasks);
  results.forEach(result => {
    if (result.status === "fulfilled") arrivals.push(...result.value);
    else notices.push(publicError(result.reason).message);
  });
  if (signal.aborted) throw new ApiError(504, "교통 정보 조회 시간이 초과되었습니다.");
  if (!successfulLookups) throw new ApiError(503, Array.from(new Set(notices)).join(" ") || "교통 정보를 조회하지 못했습니다.");
  const unique = Array.from(new Map(arrivals.map(item => [`${item.type}|${item.stationName}|${item.routeName}|${item.arrivalText}|${item.detail}`, item])).values()).slice(0, 14);
  const plans = candidatePlans(unique, distance);
  if (!unique.length) notices.push("조회된 주변 정류장·역의 교통 정보가 없습니다.");
  return { arrivals: unique, legs: plans[0]?.legs || [], plans,
    notice: Array.from(new Set(notices)).join(" ") };
}

