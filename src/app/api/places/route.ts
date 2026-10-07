import { NextResponse } from "next/server";
import { geocodeAddressToPlace, type NaverGeocodeResponse } from "@/lib/naverGeocode";
import { toPlace, type NaverLocalResponse } from "@/lib/naverLocal";
import { inferSearchMode, normalizeSavedPlace, placeIdentity } from "@/lib/placeUtils";
import { ApiError, fetchApiJson, publicError, readCoordinate, requestScope, validateRequest } from "@/lib/serverRequest";
import type { Place } from "@/types/place";

export const dynamic = "force-dynamic";

function cloudHeaders() {
  const id = process.env.NAVER_CLOUD_MAP_CLIENT_ID || process.env.NAVER_MAPS_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const secret = process.env.NAVER_CLOUD_MAP_CLIENT_SECRET || process.env.NAVER_MAPS_CLIENT_SECRET;
  if (!id || !secret) throw new ApiError(503, "주소·지도 중심 검색 API 설정이 필요합니다.");
  return { "x-ncp-apigw-api-key-id": id, "x-ncp-apigw-api-key": secret };
}

async function geocode(query: string, signal: AbortSignal) {
  const url = new URL("https://maps.apigw.ntruss.com/map-geocode/v2/geocode");
  url.searchParams.set("query", query);
  const data = await fetchApiJson<NaverGeocodeResponse>(url, { headers: cloudHeaders() }, signal);
  if (data.status !== "OK" || !Array.isArray(data.addresses)) throw new ApiError(502, "주소 검색 응답을 처리하지 못했습니다.");
  return data.addresses.slice(0, 5).filter(item => item && typeof item === "object")
    .map((item, index) => geocodeAddressToPlace(item, index, query));
}

async function centerLabel(params: URLSearchParams, signal: AbortSignal) {
  if (!params.has("centerLat") && !params.has("centerLng")) return "";
  const lat = readCoordinate(params, "centerLat", 90);
  const lng = readCoordinate(params, "centerLng", 180);
  const url = new URL("https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc");
  url.searchParams.set("coords", `${lng},${lat}`);
  url.searchParams.set("orders", "addr,roadaddr");
  url.searchParams.set("output", "json");
  const data = await fetchApiJson<{ status?: { code?: number }; results?: Array<{ region?: Record<string, { name?: string }> }> }>(
    url, { headers: cloudHeaders() }, signal);
  const region = data.results?.[0]?.region;
  const label = [region?.area1?.name, region?.area2?.name, region?.area3?.name].filter(Boolean).join(" ");
  if (!label || (data.status?.code !== undefined && data.status.code !== 0)) {
    throw new ApiError(502, "지도 중심의 지역 정보를 찾지 못했습니다. 중심을 바꾸거나 일반 검색을 이용해주세요.");
  }
  return label;
}

async function localSearch(query: string, category: string, display: number, label: string, signal: AbortSignal) {
  const id = process.env.NAVER_MAP_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_MAP_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) throw new ApiError(503, "장소 검색 API 설정이 필요합니다.");
  const url = new URL("https://openapi.naver.com/v1/search/local.json");
  const keyword = category !== "전체" && category !== "주소" ? category : "";
  url.searchParams.set("query", [label, query, keyword].filter(Boolean).join(" "));
  url.searchParams.set("display", String(display));
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "random");
  const data = await fetchApiJson<NaverLocalResponse>(url, {
    headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret }
  }, signal);
  if (!Array.isArray(data.items)) throw new ApiError(502, "장소 검색 응답을 처리하지 못했습니다.");
  return data.items.slice(0, display).filter(item => item && typeof item.title === "string").map(toPlace);
}

export async function GET(request: Request) {
  const scope = requestScope(request);
  try {
    validateRequest(request);
    const params = new URL(request.url).searchParams;
    const query = params.get("query")?.trim() || "";
    const mode = params.get("mode") || "auto";
    const category = params.get("category") || "전체";
    const display = Number(params.get("display") ?? 5);
    if (query.length > 200 || !["auto", "place", "address"].includes(mode) ||
        !["전체", "카페", "음식점", "편의점", "병원", "지하철역", "주차장", "공원", "주소", "기타"].includes(category) ||
        !Number.isInteger(display) || display < 1 || display > 5) {
      throw new ApiError(400, "검색 조건을 확인해주세요. 검색어는 200자까지 입력할 수 있습니다.");
    }
    if (params.has("centerLat") || params.has("centerLng")) {
      readCoordinate(params, "centerLat", 90);
      readCoordinate(params, "centerLng", 180);
    }
    if (!query) return NextResponse.json({ places: [], total: 0 });
    const resolvedMode = category === "주소" ? "address" : mode === "auto" ? inferSearchMode(query) : mode;
    let places: Place[] = [];
    let label = "";
    let resultMode = resolvedMode;
    if (resolvedMode === "address") {
      places = await geocode(query, scope.signal);
      if (!places.length && mode === "auto" && category !== "주소") {
        label = await centerLabel(params, scope.signal);
        places = await localSearch(query, category, display, label, scope.signal);
        resultMode = "place";
      }
    } else {
      label = await centerLabel(params, scope.signal);
      places = await localSearch(query, category, display, label, scope.signal);
      if (!places.length && mode === "auto" &&
          (process.env.NAVER_CLOUD_MAP_CLIENT_SECRET || process.env.NAVER_MAPS_CLIENT_SECRET)) {
        places = await geocode(query, scope.signal);
        if (places.length) resultMode = "address";
      }
    }
    const validPlaces = places.map(normalizeSavedPlace).filter((place): place is Place => !!place);
    if (places.length && !validPlaces.length) throw new ApiError(502, "검색 결과에 유효한 장소 정보가 없습니다.");
    const unique = Array.from(new Map(validPlaces.map(place => [placeIdentity(place), place])).values()).slice(0, display);
    return NextResponse.json({ places: unique, total: unique.length, mode: resultMode, centerLabel: label });
  } catch (error) {
    const failure = publicError(error);
    return NextResponse.json({ message: failure.message, places: [] }, { status: failure.status });
  } finally {
    scope.dispose();
  }
}

