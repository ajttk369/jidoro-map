import { NextResponse } from "next/server";
import { geocodeAddressToPlace, type NaverGeocodeResponse } from "@/lib/naverGeocode";
import { toPlace, type NaverLocalResponse } from "@/lib/naverLocal";
import { inferSearchMode, type SearchMode } from "@/lib/placeUtils";
import type { Place } from "@/types/place";

export const dynamic = "force-dynamic";

interface NaverErrorResponse {
  errorMessage?: string;
  errorCode?: string;
  message?: string;
}

interface ReverseGeocodeResponse {
  results?: Array<{
    region?: {
      area1?: { name?: string };
      area2?: { name?: string };
      area3?: { name?: string };
    };
  }>;
}

function parseError(errorData: NaverErrorResponse) {
  return errorData.errorMessage || errorData.message || errorData.errorCode || "";
}

function getCloudKeys() {
  return {
    clientId:
      process.env.NAVER_CLOUD_MAP_CLIENT_ID ||
      process.env.NAVER_MAPS_CLIENT_ID ||
      process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID,
    clientSecret: process.env.NAVER_CLOUD_MAP_CLIENT_SECRET || process.env.NAVER_MAPS_CLIENT_SECRET
  };
}

async function getCenterLabel(lat: string | null, lng: string | null) {
  const { clientId, clientSecret } = getCloudKeys();

  if (!clientId || !clientSecret || !lat || !lng) {
    return "";
  }

  const apiUrl = new URL("https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc");
  apiUrl.searchParams.set("coords", `${lng},${lat}`);
  apiUrl.searchParams.set("orders", "addr,roadaddr");
  apiUrl.searchParams.set("output", "json");

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "x-ncp-apigw-api-key-id": clientId,
        "x-ncp-apigw-api-key": clientSecret
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return "";
    }

    const data = (await response.json()) as ReverseGeocodeResponse;
    const region = data.results?.[0]?.region;

    return [region?.area1?.name, region?.area2?.name, region?.area3?.name]
      .filter(Boolean)
      .join(" ");
  } catch {
    return "";
  }
}

async function searchLocalPlaces(query: string, category: string, display: number, centerLabel: string) {
  const clientId = process.env.NAVER_MAP_CLIENT_ID || process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { places: [] as Place[], error: "" };
  }

  const categoryKeyword = category && category !== "전체" && category !== "주소" ? category : "";
  const searchQuery = [centerLabel, query, categoryKeyword].filter(Boolean).join(" ");
  const apiUrl = new URL("https://openapi.naver.com/v1/search/local.json");
  apiUrl.searchParams.set("query", searchQuery);
  apiUrl.searchParams.set("display", String(display));
  apiUrl.searchParams.set("start", "1");
  apiUrl.searchParams.set("sort", "random");

  const response = await fetch(apiUrl, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let message = "";

    try {
      message = parseError((await response.json()) as NaverErrorResponse);
    } catch {
      message = await response.text().catch(() => "");
    }

    return {
      places: [] as Place[],
      error: `네이버 지역 검색을 불러오지 못했습니다. (${response.status})${message ? ` ${message}` : ""}`
    };
  }

  const data = (await response.json()) as NaverLocalResponse;
  return { places: data.items.map(toPlace), error: "" };
}

async function geocodeAddress(query: string) {
  const { clientId, clientSecret } = getCloudKeys();

  if (!clientId || !clientSecret) {
    return { places: [] as Place[], error: "" };
  }

  const apiUrl = new URL("https://maps.apigw.ntruss.com/map-geocode/v2/geocode");
  apiUrl.searchParams.set("query", query);

  const response = await fetch(apiUrl, {
    headers: {
      "x-ncp-apigw-api-key-id": clientId,
      "x-ncp-apigw-api-key": clientSecret
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let message = "";

    try {
      message = parseError((await response.json()) as NaverErrorResponse);
    } catch {
      message = await response.text().catch(() => "");
    }

    return {
      places: [] as Place[],
      error: `네이버 주소 검색을 불러오지 못했습니다. (${response.status})${message ? ` ${message}` : ""}`
    };
  }

  const data = (await response.json()) as NaverGeocodeResponse;
  return {
    places: data.addresses.map((address, index) => geocodeAddressToPlace(address, index, query)),
    error: data.errorMessage || ""
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";
  const mode = (searchParams.get("mode") as SearchMode | null) ?? "auto";
  const centerLat = searchParams.get("centerLat");
  const centerLng = searchParams.get("centerLng");
  const requestedDisplay = Number(searchParams.get("display") ?? 5);
  const display = Math.min(Math.max(Number.isFinite(requestedDisplay) ? requestedDisplay : 5, 1), 5);

  if (!query) {
    return NextResponse.json({ places: [] });
  }

  try {
    const resolvedMode = mode === "auto" ? inferSearchMode(query) : mode;
    const centerLabel = resolvedMode === "place" ? await getCenterLabel(centerLat, centerLng) : "";

    if (resolvedMode === "address" || category === "주소") {
      const addressResult = await geocodeAddress(query);

      if (addressResult.places.length > 0) {
        return NextResponse.json({
          places: addressResult.places,
          total: addressResult.places.length,
          mode: "address"
        });
      }
    }

    const localResult = await searchLocalPlaces(query, category, display, centerLabel);

    if (localResult.places.length > 0) {
      return NextResponse.json({
        places: localResult.places,
        total: localResult.places.length,
        mode: "place",
        centerLabel
      });
    }

    const fallbackAddressResult = await geocodeAddress(query);

    if (fallbackAddressResult.places.length > 0) {
      return NextResponse.json({
        places: fallbackAddressResult.places,
        total: fallbackAddressResult.places.length,
        mode: "address"
      });
    }

    const error = fallbackAddressResult.error || localResult.error;

    if (error) {
      return NextResponse.json({ message: error, places: [] }, { status: 502 });
    }

    return NextResponse.json({ places: [], total: 0, mode: resolvedMode });
  } catch {
    return NextResponse.json(
      {
        message: "검색 서버에 연결하지 못했습니다. 네트워크 또는 API 설정을 확인해주세요.",
        places: []
      },
      { status: 502 }
    );
  }
}
