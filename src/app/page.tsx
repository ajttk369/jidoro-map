"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  const panelModeRef = useRef<PanelMode>("results");

  useEffect(() => {
    panelModeRef.current = panelMode;
  }, [panelMode]);

  useEffect(() => {
    const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);

    if (!storedFavorites) {
      return;
    }

    try {
      const parsedFavorites = JSON.parse(storedFavorites);
      if (Array.isArray(parsedFavorites)) {
        setFavoritePlaces(parsedFavorites.filter((item) => item && typeof item.id === "string"));
      }
    } catch {
      setFavoritePlaces([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoritePlaces));
  }, [favoritePlaces]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setPlaces([]);
      setSelectedPlace(null);
      setPanelMode("results");
      setIsLoading(false);
      setErrorMessage("");
      setHasSearched(false);
      setRouteInfo(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage("");
      setHasSearched(true);
      setActiveTab("results");
      setRouteInfo(null);
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

        if (!response.ok) {
          throw new Error(data.message || "장소 검색 중 문제가 발생했습니다.");
        }

        setPlaces(data.places);
        if (panelModeRef.current === "results" || panelModeRef.current === "place") {
          setSelectedPlace(data.places[0] ?? null);
          setPanelMode(data.places[0] ? "place" : "results");
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
  }, [query, searchCenter, searchNonce, selectedCategory]);

  const favoriteIds = useMemo(() => favoritePlaces.map((place) => place.id), [favoritePlaces]);
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
    if (visiblePlaces.length === 0) {
      if (activeTab === "favorites" || panelMode === "results") {
        setSelectedPlace(null);
      }
      return;
    }

    if (!selectedPlace || !visiblePlaces.some((place) => place.id === selectedPlace.id)) {
      setSelectedPlace(visiblePlaces[0]);
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
      if (current.some((item) => item.id === place.id)) {
        return current.filter((item) => item.id !== place.id);
      }

      return [place, ...current];
    });
  }, []);

  const handleCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationMessage("현재 위치를 가져올 수 없습니다. 브라우저 위치 권한을 확인해주세요.");
      return;
    }

    setLocationMessage("현재 위치를 확인하는 중입니다.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(nextLocation);
        setRouteStart(nextLocation);
        setRouteOriginQuery(CURRENT_LOCATION_LABEL);
        setMapCenter(nextLocation);
        setSearchCenter(nextLocation);
        setLocationMessage("현재 위치 기준으로 거리를 계산했습니다.");
      },
      () => {
        setLocationMessage("현재 위치를 가져올 수 없습니다. 브라우저 위치 권한을 확인해주세요.");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000
      }
    );
  }, []);

  const handleUseCurrentLocationAsOrigin = useCallback(() => {
    if (userLocation) {
      setRouteStart(userLocation);
      setRouteOriginQuery(CURRENT_LOCATION_LABEL);
      setRouteMessage("현재 위치를 출발지로 설정했습니다.");
      return;
    }

    handleCurrentLocation();
  }, [handleCurrentLocation, userLocation]);

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
    setSearchNonce((current) => current + 1);
    setLocationMessage("현재 지도 영역 기준으로 다시 검색합니다.");
  }, [mapCenter, query, userLocation]);

  const handleSelectPlace = useCallback((place: Place) => {
    setSelectedPlace(place);
    setPanelMode("place");
    setRoadviewOpen(false);
  }, []);

  const handleSetStart = useCallback((place: Place) => {
    setSelectedPlace(place);
    setPanelMode("directions");
    setRouteInfo(null);
    setRouteMessage("");
    setRouteOriginQuery(place.name);
    setRouteDestinationQuery("");
    setRouteStart(hasCoordinates(place) ? { lat: place.lat, lng: place.lng } : null);
    setRouteGoal(null);
  }, []);

  const handleSetDestination = useCallback((place: Place) => {
    setSelectedPlace(place);
    setPanelMode("directions");
    setRouteInfo(null);
    setRouteMessage("");
    setRouteDestinationQuery(place.name);
    setRouteGoal(hasCoordinates(place) ? { lat: place.lat, lng: place.lng } : null);

    if (!routeOriginQuery && userLocation) {
      setRouteOriginQuery(CURRENT_LOCATION_LABEL);
      setRouteStart(userLocation);
    }
  }, [routeOriginQuery, userLocation]);

  const handleOpenRoadview = useCallback((place: Place) => {
    setSelectedPlace(place);
    setRoadviewOpen(true);
  }, []);

  const resolveRoutePoint = useCallback(
    async (queryText: string, knownPoint: RoutePoint | null, currentLocationAllowed: boolean) => {
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
      const response = await fetch(`/api/places?${params.toString()}`);
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
    setRouteMessage("경로를 불러오는 중입니다.");

    try {
      const start = await resolveRoutePoint(routeOriginQuery, routeStart, true);
      const goal = await resolveRoutePoint(routeDestinationQuery, routeGoal, false);

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
      const response = await fetch(`/api/directions?${params.toString()}`);
      const data = (await response.json()) as RouteInfo & { message?: string };

      if (!response.ok) {
        throw new Error(data.message || "길찾기 경로를 불러오지 못했습니다.");
      }

      setRouteInfo(data);
      setRouteMessage(`경로 ${data.distance}, 예상 ${data.duration}`);
      setRoadviewOpen(false);
    } catch (error) {
      setRouteInfo(null);
      setRouteMessage(error instanceof Error ? error.message : "길찾기 경로를 불러오지 못했습니다.");
    }
  }, [resolveRoutePoint, routeDestinationQuery, routeGoal, routeMode, routeOriginQuery, routeStart]);

  const handleSwapRoute = useCallback(() => {
    setRouteOriginQuery(routeDestinationQuery);
    setRouteDestinationQuery(routeOriginQuery);
    setRouteStart(routeGoal);
    setRouteGoal(routeStart);
    setRouteInfo(null);
    setRouteMessage("");
  }, [routeDestinationQuery, routeGoal, routeOriginQuery, routeStart]);

  const handleToggleFavoritesView = useCallback(() => {
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
  }, [activeTab]);

  const handlePanelTabChange = useCallback((tab: PanelTab) => {
    setActiveTab(tab);
    setPanelMode(tab === "favorites" ? "favorites" : "results");
    setRoadviewOpen(false);
  }, []);

  const handleOpenMapHome = useCallback(() => {
    setActiveTab("results");
    setPanelMode("results");
    setRoadviewOpen(false);
  }, []);

  const handleOpenDirectionsHome = useCallback(() => {
    setActiveTab("results");
    setPanelMode("directions");
    setRouteInfo(null);
    setRouteMessage("");
    setRoadviewOpen(false);
  }, []);

  const panel = (() => {
    if (panelMode === "directions") {
      return (
        <DirectionsPanel
          routeMode={routeMode}
          routeInfo={routeInfo}
          routeMessage={routeMessage}
          originQuery={routeOriginQuery}
          destinationQuery={routeDestinationQuery}
          onRouteModeChange={setRouteMode}
          onOriginChange={(value) => {
            setRouteOriginQuery(value);
            setRouteStart(value === CURRENT_LOCATION_LABEL ? userLocation : null);
            setRouteInfo(null);
          }}
          onDestinationChange={(value) => {
            setRouteDestinationQuery(value);
            setRouteGoal(null);
            setRouteInfo(null);
          }}
          onUseCurrentLocationAsOrigin={handleUseCurrentLocationAsOrigin}
          onSwapRoute={handleSwapRoute}
          onSubmitRoute={handleSubmitRoute}
          onBack={() => setPanelMode(selectedPlace ? "place" : "results")}
        />
      );
    }

    if (panelMode === "place" && selectedPlace) {
      return (
        <PlaceDetailPanel
          place={selectedPlace}
          favorite={favoriteIds.includes(selectedPlace.id)}
          copiedText={copiedText}
          onBack={() => setPanelMode(activeTab === "favorites" ? "favorites" : "results")}
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
        isLoading={isLoading}
        errorMessage={errorMessage}
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
    <main className="min-h-dvh bg-jidoro-surface">
      <Header
        query={query}
        favoritesActive={activeTab === "favorites"}
        onQueryChange={setQuery}
        onCurrentLocation={handleCurrentLocation}
        onToggleFavorites={handleToggleFavoritesView}
      />

      <div className="flex min-h-dvh flex-col pt-[72px] max-lg:pt-[142px] lg:h-dvh lg:min-h-0 lg:flex-row">
        <div className="h-[calc(100dvh-142px)] min-h-[520px] lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1">
          <NaverMap
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
            onToggleRoadview={setRoadviewOpen}
          />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 flex h-[56dvh] min-h-[360px] flex-col overflow-hidden rounded-t-2xl border-t border-jidoro-line bg-white shadow-panel lg:static lg:order-1 lg:h-full lg:min-h-0 lg:flex-row lg:overflow-visible lg:rounded-none lg:border-t-0 lg:bg-transparent lg:shadow-none">
          <div className="flex h-5 items-center justify-center bg-white lg:hidden">
            <span className="h-1 w-12 rounded-full bg-slate-300" />
          </div>
          <ModeRail
            activeMode={panelMode === "directions" ? "directions" : "home"}
            onOpenHome={handleOpenMapHome}
            onOpenDirections={handleOpenDirectionsHome}
          />
          <div className="min-h-0 flex-1 overflow-hidden lg:overflow-visible">{panel}</div>
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
    <nav className="flex shrink-0 border-b border-jidoro-line bg-white px-2 py-2 lg:w-[72px] lg:flex-col lg:items-center lg:border-b-0 lg:border-r lg:px-0 lg:py-4">
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
      className={`flex h-12 min-w-[88px] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-extrabold transition lg:mb-2 lg:min-w-0 lg:flex-none lg:self-stretch ${
        active ? "bg-jidoro-blue text-white" : "text-jidoro-muted hover:bg-jidoro-surface hover:text-jidoro-ink"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
