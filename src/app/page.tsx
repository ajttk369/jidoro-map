"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import DirectionsPanel from "@/components/DirectionsPanel";
import Header from "@/components/Header";
import NaverMap from "@/components/NaverMap";
import PlaceDetailPanel from "@/components/PlaceDetailPanel";
import SearchPanel from "@/components/SearchPanel";
import { Home as HomeIcon, Navigation } from "lucide-react";
import {
  calculateDistanceMeters,
  formatDistance,
  getCategoryCounts,
  getPlaceKind,
  getPrimaryAddress,
  hasCoordinates,
  normalizeSavedPlace,
  placeIdentity,
  sortPlaces,
  type PanelMode,
  type PanelTab,
  type ResultFilter,
  type SortMode
} from "@/lib/placeUtils";
import type { Place, PlaceCategory, RouteInfo, RouteMode } from "@/types/place";

const FAVORITES_STORAGE_KEY = "jidoro.favoritePlaces";
const CURRENT_LOCATION_LABEL = "현재 위치";

interface PlacesResponse {
  places: Place[];
  message?: string;
}

type RoutePoint = { lat: number; lng: number };
type MobileSheetPosition = "peek" | "half" | "full";

const mobileSheetHeights: Record<MobileSheetPosition, string> = {
  peek: "sheet-peek",
  half: "sheet-half",
  full: "sheet-full"
};

const mobileSheetOrder: MobileSheetPosition[] = ["peek", "half", "full"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory>("전체");
  const [places, setPlaces] = useState<Place[]>([]);
  const [favoritePlaces, setFavoritePlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("results");
  const [activeTab, setActiveTab] = useState<PanelTab>("results");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [userLocation, setUserLocation] = useState<RoutePoint | null>(null);
  const [mapCenter, setMapCenter] = useState<RoutePoint | null>(null);
  const [searchCenter, setSearchCenter] = useState<RoutePoint | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [copiedText, setCopiedText] = useState("");
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>("transit");
  const [routeMessage, setRouteMessage] = useState("");
  const [routeOriginQuery, setRouteOriginQuery] = useState("");
  const [routeDestinationQuery, setRouteDestinationQuery] = useState("");
  const [routeStart, setRouteStart] = useState<RoutePoint | null>(null);
  const [routeGoal, setRouteGoal] = useState<RoutePoint | null>(null);
  const [roadviewOpen, setRoadviewOpen] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const [mobileSheetPosition, setMobileSheetPosition] = useState<MobileSheetPosition>("half");
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mobileOverlayHeight, setMobileOverlayHeight] = useState(0);
  const storageWritableRef = useRef(true);
  const routeRequestRef = useRef<AbortController | null>(null);
  const routeRevisionRef = useRef(0);
  const locationPendingRef = useRef(false);
  const aliveRef = useRef(true);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const panelModeRef = useRef<PanelMode>("results");
  const sheetDragStartYRef = useRef<number | null>(null);
  const cancelRoute = useCallback(() => {
    routeRevisionRef.current++;
    routeRequestRef.current?.abort();
    routeRequestRef.current = null;
    setRouteInfo(null);
    setRouteMessage("");
    setIsRouteLoading(false);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      routeRequestRef.current?.abort();
      routeRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    const update = () => {
      const viewport = window.visualViewport;
      document.documentElement.style.setProperty("--visible-height", `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty("--keyboard-bottom", `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
      setMobileOverlayHeight(window.innerWidth < 1024 ? sheetRef.current?.getBoundingClientRect().height ?? 0 : 0);
    };
    const observer = new ResizeObserver(update);
    if (sheetRef.current) observer.observe(sheetRef.current);
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--visible-height");
      document.documentElement.style.removeProperty("--keyboard-bottom");
    };
  }, []);

  useEffect(() => {
    panelModeRef.current = panelMode;
  }, [panelMode]);

  useEffect(() => {
    try {
      const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (storedFavorites) {
        const parsed: unknown = JSON.parse(storedFavorites);
        if (!Array.isArray(parsed)) throw new Error("Invalid favorites");
        const valid = parsed.map(normalizeSavedPlace).filter((place): place is Place => !!place);
        if (valid.length !== parsed.length) {
          storageWritableRef.current = false;
          setStorageMessage("일부 저장 정보를 읽지 못했습니다. 원본 즐겨찾기는 덮어쓰지 않습니다.");
        }
        setFavoritePlaces(Array.from(new Map(valid.map(place => [placeIdentity(place), place])).values()));
      }
    } catch {
      storageWritableRef.current = false;
      setStorageMessage("즐겨찾기를 읽지 못했습니다. 기존 저장 데이터는 보존되며 변경은 이번 화면에만 적용됩니다.");
    } finally {
      setFavoritesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!favoritesReady || !storageWritableRef.current) return;
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoritePlaces));
    } catch {
      setStorageMessage("즐겨찾기를 저장하지 못했습니다. 저장 공간 또는 브라우저 설정을 확인해주세요.");
    }
  }, [favoritePlaces, favoritesReady]);

  useEffect(() => {
    if (activeTab === "favorites") {
      setIsLoading(false);
      return;
    }
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setPlaces([]);
      if (panelModeRef.current !== "directions") {
        setSelectedPlace(null);
        setPanelMode("results");
      }
      setIsLoading(false);
      setErrorMessage("");
      setHasSearched(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage("");
      setHasSearched(true);
      setPlaces([]);
      setRoadviewOpen(false);

      try {
        const params = new URLSearchParams({
          query: normalizedQuery,
          category: selectedCategory,
          mode: "auto",
          display: "5"
        });

        if (searchCenter) {
          params.set("centerLat", String(searchCenter.lat));
          params.set("centerLng", String(searchCenter.lng));
        }

        const response = await fetch(`/api/places?${params.toString()}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as PlacesResponse;
        if (controller.signal.aborted) return;

        if (!response.ok) {
          throw new Error(data.message || "장소 검색 중 문제가 발생했습니다.");
        }

        if (!Array.isArray(data.places)) throw new Error("검색 결과 형식을 확인하지 못했습니다.");
        const nextPlaces = data.places.map(normalizeSavedPlace).filter((place): place is Place => !!place);
        setPlaces(nextPlaces);
        if (panelModeRef.current === "results" || panelModeRef.current === "place") {
          setSelectedPlace(nextPlaces[0] ?? null);
          setPanelMode(nextPlaces[0] ? "place" : "results");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPlaces([]);
        if (panelModeRef.current === "results" || panelModeRef.current === "place") {
          setSelectedPlace(null);
          setPanelMode("results");
        }
        setErrorMessage(error instanceof Error ? error.message : "장소 검색 중 문제가 발생했습니다.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeTab, query, searchCenter, searchNonce, selectedCategory]);

  const favoriteIds = useMemo(() => {
    const identities = new Set(favoritePlaces.map(placeIdentity));
    return [...places, ...favoritePlaces].filter(place => identities.has(placeIdentity(place))).map(place => place.id);
  }, [places, favoritePlaces]);
  const sourcePlaces = activeTab === "favorites" ? favoritePlaces : places;

  const placesWithDistance = useMemo(() => {
    return sourcePlaces.map((place) => {
      const distance = calculateDistanceMeters(userLocation, place);
      return {
        ...place,
        distance: userLocation ? formatDistance(distance) : place.distance
      };
    });
  }, [sourcePlaces, userLocation]);

  const filteredPlaces = useMemo(() => {
    return placesWithDistance.filter((place) => {
      const matchesCategory = selectedCategory === "전체" || place.category === selectedCategory;
      const matchesResultKind = resultFilter === "all" || getPlaceKind(place) === resultFilter;

      return matchesCategory && matchesResultKind;
    });
  }, [placesWithDistance, resultFilter, selectedCategory]);

  const visiblePlaces = useMemo(
    () => sortPlaces(filteredPlaces, sortMode, userLocation),
    [filteredPlaces, sortMode, userLocation]
  );

  const categoryCounts = useMemo(() => getCategoryCounts(sourcePlaces), [sourcePlaces]);

  useEffect(() => {
    if (panelMode === "directions") return;
    if (visiblePlaces.length === 0) {
      setSelectedPlace(null);
      setRoadviewOpen(false);
      if (panelMode === "place") setPanelMode(activeTab === "favorites" ? "favorites" : "results");
      return;
    }

    if (!selectedPlace || !visiblePlaces.some((place) => place.id === selectedPlace.id)) {
      setSelectedPlace(visiblePlaces[0]);
    } else {
      const current = visiblePlaces.find(place => place.id === selectedPlace.id);
      if (current && current !== selectedPlace) setSelectedPlace(current);
    }
  }, [activeTab, panelMode, selectedPlace, visiblePlaces]);

  useEffect(() => {
    if (!copiedText) {
      return;
    }

    const timer = window.setTimeout(() => setCopiedText(""), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedText]);

  const handleToggleFavorite = useCallback((place: Place) => {
    setFavoritePlaces((current) => {
      if (current.some((item) => placeIdentity(item) === placeIdentity(place))) {
        return current.filter((item) => placeIdentity(item) !== placeIdentity(place));
      }

      return [place, ...current];
    });
  }, []);

  const handleCurrentLocation = useCallback(() => {
    if (locationPendingRef.current) return;
    if (!navigator.geolocation) {
      setLocationMessage("현재 위치를 가져올 수 없습니다. 브라우저 위치 권한을 확인해주세요.");
      return;
    }

    setLocationMessage("현재 위치를 확인하는 중입니다.");
    const routeRevision = routeRevisionRef.current;
    locationPendingRef.current = true;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        locationPendingRef.current = false;
        if (!aliveRef.current) return;
        setIsLocating(false);
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(nextLocation);
        if (routeRevision === routeRevisionRef.current) {
          cancelRoute();
          setRouteStart(nextLocation);
          setRouteOriginQuery(CURRENT_LOCATION_LABEL);
        }
        setMapCenter(nextLocation);
        setSearchCenter(nextLocation);
        setLocationMessage("현재 위치 기준으로 거리를 계산했습니다.");
      },
      (error) => {
        locationPendingRef.current = false;
        if (!aliveRef.current) return;
        setIsLocating(false);
        setLocationMessage(error.code === 1 ? "위치 권한이 차단되어 있습니다. 브라우저 설정을 확인해주세요." :
          error.code === 3 ? "위치 확인 시간이 초과되었습니다. 다시 시도해주세요." : "현재 위치를 확인하지 못했습니다.");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000
      }
    );
  }, [cancelRoute]);

  const handleUseCurrentLocationAsOrigin = useCallback(() => {
    cancelRoute();
    if (userLocation) {
      setRouteStart(userLocation);
      setRouteOriginQuery(CURRENT_LOCATION_LABEL);
      setRouteMessage("현재 위치를 출발지로 설정했습니다.");
      return;
    }

    handleCurrentLocation();
  }, [cancelRoute, handleCurrentLocation, userLocation]);

  const handleCopyText = useCallback(async (value: string, label: string) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedText(label);
    } catch {
      setCopiedText("복사 실패");
    }
  }, []);

  const handleSearchHere = useCallback(() => {
    if (!query.trim()) {
      setLocationMessage("검색어를 먼저 입력해주세요.");
      return;
    }

    const nextCenter = mapCenter || userLocation;

    if (!nextCenter) {
      setLocationMessage("지도 중심을 확인할 수 없습니다.");
      return;
    }

    setSearchCenter(nextCenter);
    cancelRoute();
    setActiveTab("results");
    setPanelMode("results");
    setSearchNonce((current) => current + 1);
    setLocationMessage("지도 중심 지역명 기준으로 다시 검색합니다.");
  }, [cancelRoute, mapCenter, query, userLocation]);

  const handleSelectPlace = useCallback((place: Place) => {
    cancelRoute();
    setSelectedPlace(place);
    setPanelMode("place");
    setRoadviewOpen(false);
  }, [cancelRoute]);

  const handleSetStart = useCallback((place: Place) => {
    cancelRoute();
    setRoadviewOpen(false);
    setMobileSheetPosition("full");
    setSelectedPlace(place);
    setPanelMode("directions");
    setRouteInfo(null);
    setRouteMessage("");
    setRouteOriginQuery(place.name.slice(0, 200));
    setRouteDestinationQuery("");
    setRouteStart(hasCoordinates(place) ? { lat: place.lat, lng: place.lng } : null);
    setRouteGoal(null);
  }, [cancelRoute]);

  const handleSetDestination = useCallback((place: Place) => {
    cancelRoute();
    setRoadviewOpen(false);
    setMobileSheetPosition("full");
    setSelectedPlace(place);
    setPanelMode("directions");
    setRouteInfo(null);
    setRouteMessage("");
    setRouteDestinationQuery(place.name.slice(0, 200));
    setRouteGoal(hasCoordinates(place) ? { lat: place.lat, lng: place.lng } : null);

    if (!routeOriginQuery && userLocation) {
      setRouteOriginQuery(CURRENT_LOCATION_LABEL);
      setRouteStart(userLocation);
    }
  }, [cancelRoute, routeOriginQuery, userLocation]);

  const handleOpenRoadview = useCallback((place: Place) => {
    if (!hasCoordinates(place)) return;
    setSelectedPlace(place);
    setRoadviewOpen(true);
    setMobileSheetPosition("peek");
  }, []);

  const resolveRoutePoint = useCallback(
    async (queryText: string, knownPoint: RoutePoint | null, currentLocationAllowed: boolean, signal: AbortSignal) => {
      const normalized = queryText.trim();

      if (knownPoint && normalized) {
        return knownPoint;
      }

      if (currentLocationAllowed && normalized === CURRENT_LOCATION_LABEL) {
        return userLocation;
      }

      if (!normalized) {
        return null;
      }

      const params = new URLSearchParams({
        query: normalized,
        mode: "auto",
        category: "전체",
        display: "1"
      });
      const response = await fetch(`/api/places?${params.toString()}`, { signal });
      const data = (await response.json()) as PlacesResponse;
      const firstPlace = data.places?.[0];

      if (!response.ok || !hasCoordinates(firstPlace)) {
        throw new Error(data.message || `${normalized} 위치를 찾지 못했습니다.`);
      }

      return { lat: firstPlace.lat, lng: firstPlace.lng };
    },
    [userLocation]
  );

  const handleSubmitRoute = useCallback(async () => {
    if (routeRequestRef.current && !routeRequestRef.current.signal.aborted) return;
    routeRevisionRef.current++;
    const controller = new AbortController();
    routeRequestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    setIsRouteLoading(true);
    setRouteInfo(null);
    setRouteMessage("경로를 불러오는 중입니다.");

    try {
      const [start, goal] = await Promise.all([
        resolveRoutePoint(routeOriginQuery, routeStart, true, controller.signal),
        resolveRoutePoint(routeDestinationQuery, routeGoal, false, controller.signal)
      ]);
      if (controller.signal.aborted || routeRequestRef.current !== controller) return;

      if (!start || !goal) {
        setRouteInfo(null);
        setRouteMessage("출발지와 도착지를 모두 입력해주세요.");
        return;
      }

      setRouteStart(start);
      setRouteGoal(goal);

      const params = new URLSearchParams({
        startLat: String(start.lat),
        startLng: String(start.lng),
        goalLat: String(goal.lat),
        goalLng: String(goal.lng),
        mode: routeMode,
        originQuery: routeOriginQuery,
        destinationQuery: routeDestinationQuery
      });
      const response = await fetch(`/api/directions?${params.toString()}`, { signal: controller.signal });
      const data = (await response.json()) as RouteInfo & { message?: string };
      if (controller.signal.aborted || routeRequestRef.current !== controller) return;

      if (!response.ok) {
        throw new Error(data.message || "길찾기 경로를 불러오지 못했습니다.");
      }

      setRouteInfo(data);
      if (window.innerWidth < 1024) setMobileSheetPosition("half");
      setRouteMessage(data.source === "road" ? `경로 ${data.distance} · 예상 ${data.duration}` : data.summary);
      setRoadviewOpen(false);
    } catch (error) {
      if (routeRequestRef.current !== controller) return;
      setRouteInfo(null);
      setRouteMessage(controller.signal.aborted ? "조회 시간이 초과되었습니다. 다시 시도해주세요." :
        error instanceof Error ? error.message : "길찾기 경로를 불러오지 못했습니다.");
    } finally {
      window.clearTimeout(timeout);
      if (routeRequestRef.current === controller) {
        if (controller.signal.aborted) setRouteMessage("조회 시간이 초과되었습니다. 다시 시도해주세요.");
        routeRequestRef.current = null;
        setIsRouteLoading(false);
      }
    }
  }, [resolveRoutePoint, routeDestinationQuery, routeGoal, routeMode, routeOriginQuery, routeStart]);

  const handleSwapRoute = useCallback(() => {
    cancelRoute();
    setRouteOriginQuery(routeDestinationQuery);
    setRouteDestinationQuery(routeOriginQuery);
    setRouteStart(routeGoal);
    setRouteGoal(routeStart);
    setRouteInfo(null);
    setRouteMessage("");
  }, [cancelRoute, routeDestinationQuery, routeGoal, routeOriginQuery, routeStart]);

  const handleToggleFavoritesView = useCallback(() => {
    cancelRoute();
    setSelectedCategory("전체");
    setResultFilter("all");
    setRoadviewOpen(false);
    if (activeTab === "favorites") {
      setActiveTab("results");
      setPanelMode("results");
      return;
    }

    setActiveTab("favorites");
    setPanelMode("favorites");
  }, [activeTab, cancelRoute]);

  const handlePanelTabChange = useCallback((tab: PanelTab) => {
    cancelRoute();
    setActiveTab(tab);
    setPanelMode(tab === "favorites" ? "favorites" : "results");
    setRoadviewOpen(false);
  }, [cancelRoute]);

  const handleOpenMapHome = useCallback(() => {
    cancelRoute();
    setActiveTab("results");
    setPanelMode("results");
    setRoadviewOpen(false);
  }, [cancelRoute]);

  const handleOpenDirectionsHome = useCallback(() => {
    cancelRoute();
    setActiveTab("results");
    setPanelMode("directions");
    setRouteInfo(null);
    setRouteMessage("");
    setRoadviewOpen(false);
    setMobileSheetPosition("full");
  }, [cancelRoute]);

  const moveMobileSheet = useCallback((direction: "up" | "down") => {
    setMobileSheetPosition((current) => {
      const currentIndex = mobileSheetOrder.indexOf(current);
      const nextIndex =
        direction === "up"
          ? Math.min(mobileSheetOrder.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);

      return mobileSheetOrder[nextIndex];
    });
  }, []);

  const toggleMobileSheet = useCallback(() => {
    setMobileSheetPosition((current) => {
      if (current === "peek") {
        return "half";
      }

      if (current === "half") {
        return "full";
      }

      return "half";
    });
  }, []);

  const handleSheetPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      sheetDragStartYRef.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [mobileSheetPosition]
  );

  const handleSheetPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const startY = sheetDragStartYRef.current;
      sheetDragStartYRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

      if (startY === null) {
        return;
      }

      const deltaY = event.clientY - startY;

      if (Math.abs(deltaY) < 18) {
        toggleMobileSheet();
        return;
      }

      moveMobileSheet(deltaY > 0 ? "down" : "up");
    },
    [moveMobileSheet, toggleMobileSheet]
  );

  const handleSheetPointerCancel = useCallback(() => {
    sheetDragStartYRef.current = null;
  }, []);

  const panel = (() => {
    if (panelMode === "directions") {
      return (
        <DirectionsPanel
          isLoading={isRouteLoading}
          isLocating={isLocating}
          routeMode={routeMode}
          routeInfo={routeInfo}
          routeMessage={routeMessage}
          originQuery={routeOriginQuery}
          destinationQuery={routeDestinationQuery}
          onRouteModeChange={(mode) => { cancelRoute(); setRouteMode(mode); }}
          onOriginChange={(value) => {
            cancelRoute();
            setRouteOriginQuery(value);
            setRouteStart(value === CURRENT_LOCATION_LABEL ? userLocation : null);
            setRouteInfo(null);
          }}
          onDestinationChange={(value) => {
            cancelRoute();
            setRouteDestinationQuery(value);
            setRouteGoal(null);
            setRouteInfo(null);
          }}
          onUseCurrentLocationAsOrigin={handleUseCurrentLocationAsOrigin}
          onSwapRoute={handleSwapRoute}
          onSubmitRoute={handleSubmitRoute}
          onBack={() => { cancelRoute(); setPanelMode(selectedPlace ? "place" : activeTab === "favorites" ? "favorites" : "results"); }}
        />
      );
    }

    if (panelMode === "place" && selectedPlace) {
      return (
        <PlaceDetailPanel
          place={selectedPlace}
          favorite={favoriteIds.includes(selectedPlace.id)}
          copiedText={copiedText}
          onBack={() => { setRoadviewOpen(false); setPanelMode(activeTab === "favorites" ? "favorites" : "results"); }}
          onClose={() => {
            setSelectedPlace(null);
            setPanelMode(activeTab === "favorites" ? "favorites" : "results");
            setRoadviewOpen(false);
          }}
          onToggleFavorite={handleToggleFavorite}
          onSetStart={handleSetStart}
          onSetDestination={handleSetDestination}
          onOpenRoadview={handleOpenRoadview}
          onCopyText={handleCopyText}
        />
      );
    }

    return (
      <SearchPanel
        places={visiblePlaces}
        selectedPlace={selectedPlace}
        selectedCategory={selectedCategory}
        favoriteIds={favoriteIds}
        activeTab={activeTab}
        sortMode={sortMode}
        resultFilter={resultFilter}
        categoryCounts={categoryCounts}
        canSortDistance={!!userLocation}
        isLoading={activeTab === "results" && isLoading}
        errorMessage={activeTab === "results" ? errorMessage : ""}
        hasSearched={hasSearched}
        copiedText={copiedText}
        onSelectPlace={handleSelectPlace}
        onSelectCategory={setSelectedCategory}
        onToggleFavorite={handleToggleFavorite}
        onSetDestination={handleSetDestination}
        onSetActiveTab={handlePanelTabChange}
        onSetSortMode={setSortMode}
        onSetResultFilter={setResultFilter}
      />
    );
  })();

  return (
    <main className="jidoro-viewport overflow-hidden bg-jidoro-surface">
      <Header
        query={query}
        favoritesActive={activeTab === "favorites"}
        isLocating={isLocating}
        onQueryChange={(value) => {
          cancelRoute();
          setActiveTab("results");
          setPanelMode("results");
          setQuery(value);
        }}
        onCurrentLocation={handleCurrentLocation}
        onToggleFavorites={handleToggleFavoritesView}
      />

      <div className="relative h-full min-h-0 lg:flex lg:flex-row lg:pt-[72px]">
        <div
          ref={sheetRef}
          onFocusCapture={(event) => {
            if (event.target instanceof HTMLInputElement && window.innerWidth < 1024) setMobileSheetPosition("full");
          }}
          className={`jidoro-sheet fixed inset-x-0 z-40 flex ${mobileSheetHeights[mobileSheetPosition]} flex-col overflow-hidden rounded-t-[28px] border-t border-jidoro-line bg-white shadow-panel transition-[height] duration-200 ease-out lg:static lg:order-1 lg:h-full lg:min-h-0 lg:flex-none lg:flex-row lg:overflow-visible lg:rounded-none lg:border-t-0 lg:bg-transparent lg:shadow-none lg:transition-none`}
        >
          <div
            role="button"
            tabIndex={0}
            aria-label="하단 패널 크기 조절"
            aria-expanded={mobileSheetPosition !== "peek"}
            onKeyDown={(event) => {
              if (["ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) {
                event.preventDefault();
                if (event.key === "ArrowUp") moveMobileSheet("up");
                else if (event.key === "ArrowDown") moveMobileSheet("down");
                else toggleMobileSheet();
              }
            }}
            className="flex h-7 shrink-0 touch-none cursor-grab items-center justify-center bg-white active:cursor-grabbing lg:hidden"
            onPointerDown={handleSheetPointerDown}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={handleSheetPointerCancel}
          >
            <span className="h-1 w-12 rounded-full bg-slate-300" />
          </div>
          <ModeRail
            activeMode={panelMode === "directions" ? "directions" : "home"}
            onOpenHome={handleOpenMapHome}
            onOpenDirections={handleOpenDirectionsHome}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:overflow-visible">
            {storageMessage ? <p role="status" className="shrink-0 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800 lg:max-w-[430px]">{storageMessage}</p> : null}
            <div className="min-h-0 flex-1">{panel}</div>
          </div>
        </div>

        <div className="absolute inset-0 z-0 lg:static lg:order-2 lg:min-w-0 lg:flex-1">
          <NaverMap
            mobileOverlayHeight={mobileOverlayHeight}
            isLocating={isLocating}
            places={visiblePlaces}
            selectedPlace={selectedPlace}
            routeInfo={routeInfo}
            userLocation={userLocation}
            locationMessage={routeMessage || locationMessage}
            roadviewOpen={roadviewOpen}
            onSelectPlace={handleSelectPlace}
            onCurrentLocation={handleCurrentLocation}
            onSearchHere={handleSearchHere}
            onMapCenterChange={setMapCenter}
            onToggleRoadview={(open) => {
              if (open && !hasCoordinates(selectedPlace)) return;
              setRoadviewOpen(open);
              if (open) setMobileSheetPosition("peek");
            }}
          />
        </div>
      </div>
    </main>
  );
}

function ModeRail({
  activeMode,
  onOpenHome,
  onOpenDirections
}: {
  activeMode: "home" | "directions";
  onOpenHome: () => void;
  onOpenDirections: () => void;
}) {
  return (
    <nav className="flex shrink-0 border-b border-jidoro-line bg-white px-2 py-1.5 lg:w-[76px] lg:flex-col lg:items-center lg:border-b-0 lg:border-r lg:border-slate-200/70 lg:bg-white/95 lg:px-2 lg:py-5">
      <ModeButton
        active={activeMode === "home"}
        icon={<HomeIcon size={19} />}
        label="지도 홈"
        onClick={onOpenHome}
      />
      <ModeButton
        active={activeMode === "directions"}
        icon={<Navigation size={19} />}
        label="길찾기"
        onClick={onOpenDirections}
      />
    </nav>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-10 min-w-[88px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[11px] font-extrabold transition lg:mb-2 lg:h-14 lg:min-w-0 lg:flex-none lg:self-stretch lg:rounded-2xl ${
        active ? "bg-jidoro-blue text-white shadow-sm" : "text-jidoro-muted hover:bg-slate-100 hover:text-jidoro-ink"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
