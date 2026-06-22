"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Minus, Plus, RefreshCcw, ScanSearch, X } from "lucide-react";
import type { Place, RouteInfo, RouteSegment } from "@/types/place";

interface NaverMapProps {
  places: Place[];
  selectedPlace: Place | null;
  routeInfo: RouteInfo | null;
  userLocation: { lat: number; lng: number } | null;
  locationMessage: string;
  roadviewOpen: boolean;
  onSelectPlace: (place: Place) => void;
  onCurrentLocation: () => void;
  onSearchHere: () => void;
  onMapCenterChange: (center: { lat: number; lng: number }) => void;
  onToggleRoadview: (open: boolean) => void;
}

type MapStatus = "idle" | "ready" | "missing-key" | "error";

const DEFAULT_CENTER = { lat: 37.4979, lng: 127.0276 };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markerContent(label: number, place: Place, selected: boolean) {
  const color = selected ? "#2563EB" : "#10B981";
  const safeName = escapeHtml(place.name);

  return `
    <button type="button" aria-label="${safeName}" style="
      width:${selected ? 42 : 34}px;height:${selected ? 42 : 34}px;border:3px solid white;
      border-radius:999px 999px 999px 5px;background:${color};box-shadow:0 10px 24px rgba(15,23,42,.22);
      color:white;font-weight:800;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);font-size:13px;">${label}</span>
    </button>
  `;
}

function getPlaceLatLng(place: Place, maps: typeof naver.maps) {
  if (typeof place.lat === "number" && typeof place.lng === "number") {
    return new maps.LatLng(place.lat, place.lng);
  }

  return null;
}

function getFallbackSegments(routeInfo: RouteInfo): RouteSegment[] {
  return [
    {
      kind: routeInfo.mode === "transit" ? "bus" : routeInfo.mode,
      color: routeInfo.mode === "transit" ? "#10B981" : "#2563EB",
      label: routeInfo.title,
      path: routeInfo.path
    }
  ];
}

export default function NaverMap({
  places,
  selectedPlace,
  routeInfo,
  userLocation,
  locationMessage,
  roadviewOpen,
  onSelectPlace,
  onCurrentLocation,
  onSearchHere,
  onMapCenterChange,
  onToggleRoadview
}: NaverMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const markerRefs = useRef<naver.maps.Marker[]>([]);
  const userMarkerRef = useRef<naver.maps.Marker | null>(null);
  const routeLineRefs = useRef<naver.maps.Polyline[]>([]);
  const panoramaElementRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<naver.maps.Panorama | null>(null);
  const [status, setStatus] = useState<MapStatus>("idle");
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      setStatus("missing-key");
      return;
    }

    if (window.naver?.maps) {
      setStatus("ready");
      return;
    }

    const existingScript = document.getElementById("naver-map-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => setStatus("ready"), { once: true });
      existingScript.addEventListener("error", () => setStatus("error"), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "naver-map-script";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=panorama`;
    script.async = true;
    script.onload = () => setStatus("ready");
    script.onerror = () => setStatus("error");
    document.head.appendChild(script);
  }, [clientId]);

  useEffect(() => {
    if (status !== "ready" || !mapElementRef.current || !window.naver?.maps) {
      return;
    }

    const maps = window.naver.maps;

    if (!mapRef.current) {
      mapRef.current = new maps.Map(mapElementRef.current, {
        center: new maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
        zoom: 15,
        minZoom: 8,
        zoomControl: false
      });

      maps.Event.addListener(mapRef.current, "idle", () => {
        const center = mapRef.current?.getCenter() as naver.maps.LatLng | undefined;
        if (center) {
          onMapCenterChange({ lat: center.lat(), lng: center.lng() });
        }
      });
    }
  }, [onMapCenterChange, status]);

  useEffect(() => {
    if (status !== "ready" || !mapElementRef.current || !mapRef.current || !window.naver?.maps) {
      return;
    }

    const element = mapElementRef.current;
    const map = mapRef.current;
    const maps = window.naver.maps;

    const resizeMap = () => {
      const center = map.getCenter() as naver.maps.LatLng | undefined;
      const width = element.clientWidth;
      const height = element.clientHeight;

      if (width > 0 && height > 0) {
        map.setSize(new maps.Size(width, height));
      }

      maps.Event.trigger(map, "resize");
      if (center) {
        map.setCenter(center);
      }
    };

    resizeMap();
    const frame = window.requestAnimationFrame(resizeMap);
    const timer = window.setTimeout(resizeMap, 250);
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(resizeMap);
    });

    observer.observe(element);
    window.addEventListener("resize", resizeMap);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", resizeMap);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.naver?.maps) {
      return;
    }

    const map = mapRef.current;
    const maps = window.naver.maps;

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = places.flatMap((place, index) => {
      const position = getPlaceLatLng(place, maps);

      if (!position) {
        return [];
      }

      const marker = new maps.Marker({
        position,
        map,
        zIndex: selectedPlace?.id === place.id ? 20 : 10,
        icon: {
          content: markerContent(index + 1, place, selectedPlace?.id === place.id),
          size: new maps.Size(42, 42),
          anchor: new maps.Point(21, 42)
        }
      });

      maps.Event.addListener(marker, "click", () => onSelectPlace(place));
      return [marker];
    });

    const selectedPosition = selectedPlace ? getPlaceLatLng(selectedPlace, maps) : null;
    const firstPosition = places[0] ? getPlaceLatLng(places[0], maps) : null;
    const nextCenter = selectedPosition ?? firstPosition;

    if (nextCenter) {
      map.panTo(nextCenter);
    }
  }, [onSelectPlace, places, selectedPlace, status]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.naver?.maps) {
      return;
    }

    const map = mapRef.current;
    const maps = window.naver.maps;

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }

    if (!userLocation) {
      return;
    }

    const position = new maps.LatLng(userLocation.lat, userLocation.lng);
    userMarkerRef.current = new maps.Marker({
      position,
      map,
      zIndex: 30,
      icon: {
        content:
          '<div style="width:18px;height:18px;border:4px solid white;border-radius:999px;background:#2563EB;box-shadow:0 0 0 7px rgba(37,99,235,.18);"></div>',
        size: new maps.Size(24, 24),
        anchor: new maps.Point(12, 12)
      }
    });
    map.panTo(position);
  }, [status, userLocation]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.naver?.maps) {
      return;
    }

    const maps = window.naver.maps;

    routeLineRefs.current.forEach((line) => line.setMap(null));
    routeLineRefs.current = [];

    if (!routeInfo?.path.length) {
      return;
    }

    const map = mapRef.current;
    const segments = routeInfo.routeSegments?.length ? routeInfo.routeSegments : getFallbackSegments(routeInfo);

    routeLineRefs.current = segments.flatMap((segment) => {
      if (segment.path.length < 2) {
        return [];
      }

      const path = segment.path.map((point) => new maps.LatLng(point.lat, point.lng));
      const line = new maps.Polyline({
        map,
        path,
        strokeColor: segment.color,
        strokeOpacity: segment.traffic === "jam" ? 0.96 : 0.88,
        strokeWeight: segment.traffic === "jam" ? 8 : 7,
        strokeLineCap: "round",
        strokeLineJoin: "round"
      });

      return [line];
    });

    const boundsPath = routeInfo.path.map((point) => new maps.LatLng(point.lat, point.lng));
    const bounds = new maps.LatLngBounds(boundsPath[0], boundsPath[0]);
    boundsPath.forEach((position) => bounds.extend(position));
    map.fitBounds(bounds);
  }, [routeInfo, status]);

  useEffect(() => {
    if (
      status !== "ready" ||
      !roadviewOpen ||
      !panoramaElementRef.current ||
      !window.naver?.maps ||
      !selectedPlace
    ) {
      return;
    }

    const maps = window.naver.maps;
    const position = getPlaceLatLng(selectedPlace, maps);

    if (!position) {
      return;
    }

    if (!panoramaRef.current) {
      panoramaRef.current = new maps.Panorama(panoramaElementRef.current, {
        position,
        pov: {
          pan: 0,
          tilt: 0,
          fov: 100
        }
      });
    } else {
      panoramaRef.current.setPosition(position);
    }
  }, [roadviewOpen, selectedPlace, status]);

  const zoomIn = () => {
    const map = mapRef.current;
    if (map) {
      map.setZoom(map.getZoom() + 1);
    }
  };

  const zoomOut = () => {
    const map = mapRef.current;
    if (map) {
      map.setZoom(map.getZoom() - 1);
    }
  };

  if (status === "ready") {
    return (
      <section className="relative h-full min-h-[240px] overflow-hidden bg-slate-200 lg:min-h-[360px]">
        <div ref={mapElementRef} className="h-full w-full" />
        <MapControls
          locationMessage={locationMessage}
          routeInfo={routeInfo}
          roadviewOpen={roadviewOpen}
          onCurrentLocation={onCurrentLocation}
          onSearchHere={onSearchHere}
          onToggleRoadview={() => onToggleRoadview(!roadviewOpen)}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
        />
        {roadviewOpen ? (
          <div className="absolute inset-x-4 bottom-4 top-16 z-20 overflow-hidden rounded-xl border border-jidoro-line bg-white shadow-panel md:inset-x-auto md:left-4 md:w-[440px]">
            <div className="flex h-11 items-center justify-between border-b border-jidoro-line bg-white px-3">
              <div>
                <p className="text-sm font-extrabold text-jidoro-ink">거리뷰</p>
                <p className="text-xs text-jidoro-muted">{selectedPlace?.name || "선택한 장소"}</p>
              </div>
              <button
                type="button"
                onClick={() => onToggleRoadview(false)}
                className="flex size-8 items-center justify-center rounded-md text-jidoro-muted hover:bg-jidoro-surface"
                title="거리뷰 닫기"
              >
                <X size={17} />
              </button>
            </div>
            <div ref={panoramaElementRef} className="h-[calc(100%-44px)] w-full" />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="map-grid relative flex h-full min-h-[240px] items-center justify-center overflow-hidden lg:min-h-[360px]">
      <div className="relative mx-4 max-w-md rounded-xl border border-jidoro-line bg-white p-5 text-center shadow-panel">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-blue-50 text-jidoro-blue">
          <MapPin size={24} aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-jidoro-ink">
          {status === "error"
            ? "지도를 불러오지 못했습니다."
            : "네이버 지도 API 키를 설정하면 이 영역에 지도가 표시됩니다."}
        </h2>
        <p className="mt-2 text-sm leading-6 text-jidoro-muted">
          `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`를 설정하면 검색 결과와 마커를 표시합니다.
        </p>
      </div>
    </section>
  );
}

function MapControls({
  locationMessage,
  routeInfo,
  roadviewOpen,
  onCurrentLocation,
  onSearchHere,
  onToggleRoadview,
  onZoomIn,
  onZoomOut
}: {
  locationMessage: string;
  routeInfo: RouteInfo | null;
  roadviewOpen: boolean;
  onCurrentLocation: () => void;
  onSearchHere: () => void;
  onToggleRoadview: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <>
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 lg:top-4">
        <button
          type="button"
          onClick={onSearchHere}
          className="inline-flex h-9 whitespace-nowrap items-center gap-1.5 rounded-full border border-jidoro-line bg-white px-3 text-xs font-extrabold text-jidoro-blue shadow-panel transition hover:border-jidoro-blue lg:h-10 lg:gap-2 lg:px-4 lg:text-sm"
        >
          <RefreshCcw size={16} aria-hidden="true" />
          이 지역에서 다시 검색
        </button>
      </div>
      <div className="absolute bottom-3 right-3 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 lg:bottom-4 lg:right-4">
        {routeInfo ? (
          <p className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-jidoro-blue shadow-sm">
            경로 {routeInfo.distance} · 예상 {routeInfo.duration}
          </p>
        ) : null}
        {locationMessage ? (
          <p className="rounded-lg border border-jidoro-line bg-white px-3 py-2 text-xs font-semibold text-jidoro-muted shadow-sm">
            {locationMessage}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-jidoro-line bg-white shadow-panel">
          <button
            type="button"
            onClick={onToggleRoadview}
            className={`flex size-9 items-center justify-center lg:size-10 ${
              roadviewOpen ? "bg-blue-50 text-jidoro-blue" : "text-jidoro-ink hover:bg-jidoro-surface"
            }`}
            title="거리뷰"
          >
            <ScanSearch size={18} aria-hidden="true" />
          </button>
          <div className="h-px bg-jidoro-line" />
          <button
            type="button"
            onClick={onZoomIn}
            className="flex size-9 items-center justify-center text-jidoro-ink hover:bg-jidoro-surface lg:size-10"
            title="확대"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          <div className="h-px bg-jidoro-line" />
          <button
            type="button"
            onClick={onZoomOut}
            className="flex size-9 items-center justify-center text-jidoro-ink hover:bg-jidoro-surface lg:size-10"
            title="축소"
          >
            <Minus size={18} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={onCurrentLocation}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-jidoro-line bg-white text-jidoro-blue shadow-panel transition hover:border-jidoro-blue lg:size-11"
          title="현재 위치로 이동"
        >
          <LocateFixed size={20} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
