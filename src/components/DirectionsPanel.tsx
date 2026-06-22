"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Bus,
  Car,
  ChevronDown,
  Clock3,
  Footprints,
  LocateFixed,
  RefreshCcw,
  RotateCcw,
  Route,
  Train,
  X
} from "lucide-react";
import type { RouteInfo, RouteMode, TransitArrival, TransitLeg, TransitPlan } from "@/types/place";

interface DirectionsPanelProps {
  routeMode: RouteMode;
  routeInfo: RouteInfo | null;
  routeMessage: string;
  originQuery: string;
  destinationQuery: string;
  onRouteModeChange: (mode: RouteMode) => void;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onUseCurrentLocationAsOrigin: () => void;
  onSwapRoute: () => void;
  onSubmitRoute: () => void;
  onBack: () => void;
}

const routeModes: Array<{ value: RouteMode; label: string; icon: typeof Bus }> = [
  { value: "transit", label: "대중교통", icon: Bus },
  { value: "car", label: "자동차", icon: Car },
  { value: "walk", label: "도보", icon: Footprints },
  { value: "bike", label: "자전거", icon: Bike }
];

export default function DirectionsPanel({
  routeMode,
  routeInfo,
  routeMessage,
  originQuery,
  destinationQuery,
  onRouteModeChange,
  onOriginChange,
  onDestinationChange,
  onUseCurrentLocationAsOrigin,
  onSwapRoute,
  onSubmitRoute,
  onBack
}: DirectionsPanelProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TransitPlan | null>(null);

  const openDetail = (plan?: TransitPlan) => {
    setSelectedPlan(plan ?? routeInfo?.transitPlans?.[0] ?? null);
    setDetailOpen(true);
  };

  return (
    <aside className="relative flex h-full flex-col border-r border-slate-200 bg-slate-50/95 shadow-[8px_0_30px_rgba(15,23,42,0.06)] lg:w-[430px] lg:shrink-0">
      <div className="border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex size-9 items-center justify-center rounded-xl text-jidoro-ink transition hover:bg-slate-100"
            title="뒤로"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="text-lg font-extrabold text-jidoro-ink">길찾기</p>
            <p className="text-xs font-semibold text-jidoro-muted">출발지와 도착지를 입력하세요</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1">
          {routeModes.map((mode) => {
            const Icon = mode.icon;
            const selected = routeMode === mode.value;

            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => onRouteModeChange(mode.value)}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition ${
                  selected ? "bg-jidoro-blue text-white shadow-md shadow-blue-500/20" : "text-jidoro-ink hover:bg-white"
                }`}
              >
                <Icon size={15} />
                {mode.label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={onSwapRoute}
            className="absolute right-3 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-jidoro-muted shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-jidoro-blue"
            title="출발/도착 바꾸기"
          >
            <RefreshCcw size={15} />
          </button>

          <label className="grid grid-cols-[12px_minmax(0,1fr)_36px] items-center gap-2 border-b border-jidoro-line pb-2">
            <span className="size-2 rounded-full bg-jidoro-green" />
            <input
              value={originQuery}
              onChange={(event) => onOriginChange(event.target.value)}
              placeholder="출발지 입력"
              className="h-10 min-w-0 bg-transparent text-sm font-semibold text-jidoro-ink outline-none placeholder:text-jidoro-muted"
            />
            <button
              type="button"
              onClick={onUseCurrentLocationAsOrigin}
              className="flex size-9 items-center justify-center rounded-lg text-jidoro-blue hover:bg-blue-50"
              title="현재 위치를 출발지로 사용"
            >
              <LocateFixed size={17} />
            </button>
          </label>

          <label className="mt-2 grid grid-cols-[12px_minmax(0,1fr)_36px] items-center gap-2">
            <span className="size-2 rounded-full bg-rose-500" />
            <input
              value={destinationQuery}
              onChange={(event) => onDestinationChange(event.target.value)}
              placeholder="도착지 입력"
              className="h-10 min-w-0 bg-transparent pr-8 text-sm font-semibold text-jidoro-ink outline-none placeholder:text-jidoro-muted"
            />
            <span />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-[92px_minmax(0,1fr)] gap-2">
          <button
            type="button"
            onClick={() => {
              onOriginChange("");
              onDestinationChange("");
            }}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-jidoro-muted shadow-sm transition hover:border-blue-200 hover:text-jidoro-ink"
          >
            <RotateCcw size={15} />
            다시입력
          </button>
          <button
            type="button"
            onClick={onSubmitRoute}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-jidoro-blue text-sm font-extrabold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700"
          >
            <Route size={16} />
            길찾기
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
        {routeMessage ? (
          <p className="mb-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-jidoro-muted shadow-sm">
            {routeMessage}
          </p>
        ) : null}

        {routeInfo ? (
          <div className="space-y-3">
            {routeInfo.mode === "transit" && routeInfo.transitPlans?.length ? (
              <TransitPlansSection routeInfo={routeInfo} onDetail={openDetail} />
            ) : (
              <RouteSummaryCard routeInfo={routeInfo} onDetail={() => openDetail()} />
            )}
            {routeInfo.mode === "transit" ? <TransitSection routeInfo={routeInfo} /> : null}
            {routeInfo.mode === "car" ? <TrafficLegend routeInfo={routeInfo} /> : null}
            <StepsSection routeInfo={routeInfo} />
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {detailOpen && routeInfo ? (
        <RouteDetailDrawer routeInfo={routeInfo} plan={selectedPlan} onClose={() => setDetailOpen(false)} />
      ) : null}
    </aside>
  );
}

function RouteSummaryCard({ routeInfo, onDetail }: { routeInfo: RouteInfo; onDetail: () => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-jidoro-blue">{routeInfo.title}</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-3xl font-black text-jidoro-ink">{routeInfo.duration}</p>
              <p className="pb-1 text-sm font-semibold text-jidoro-muted">{routeInfo.distance}</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-jidoro-blue">
            추천
          </span>
        </div>
        <RouteBar routeInfo={routeInfo} />
        <p className="mt-3 rounded-lg bg-jidoro-surface p-3 text-sm leading-6 text-jidoro-ink">
          {routeInfo.summary}
        </p>
      </div>
      <button
        type="button"
        onClick={onDetail}
        className="flex h-11 w-full items-center justify-center gap-1 border-t border-jidoro-line text-sm font-extrabold text-jidoro-blue hover:bg-blue-50"
      >
        상세보기
        <ChevronDown size={16} />
      </button>
    </section>
  );
}

function TransitPlansSection({
  routeInfo,
  onDetail
}: {
  routeInfo: RouteInfo;
  onDetail: (plan: TransitPlan) => void;
}) {
  const plans = routeInfo.transitPlans ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold text-jidoro-ink">대중교통 추천 경로</p>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-jidoro-blue">
          현재 시간 기준
        </span>
      </div>
      {plans.map((plan, index) => (
        <TransitPlanCard key={plan.id} plan={plan} highlighted={index === 0} onDetail={() => onDetail(plan)} />
      ))}
    </section>
  );
}

function TransitPlanCard({
  plan,
  highlighted,
  onDetail
}: {
  plan: TransitPlan;
  highlighted: boolean;
  onDetail: () => void;
}) {
  const Icon = plan.primaryType === "subway" ? Train : plan.primaryType === "bus" ? Bus : Route;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        highlighted ? "border-blue-200 ring-2 ring-blue-50" : "border-jidoro-line"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-jidoro-blue">
              <Icon size={15} />
              {plan.label}
            </p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-3xl font-black text-jidoro-ink">{plan.duration}</p>
              <p className="pb-1 text-sm font-semibold text-jidoro-muted">{plan.distance}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-bold text-jidoro-muted">도착</p>
            <p className="text-sm font-extrabold text-jidoro-ink">{plan.arrivalTime}</p>
          </div>
        </div>

        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
          {plan.legs.map((leg, index) => (
            <span
              key={`${plan.id}-${leg.title}-${index}`}
              className="min-w-4 flex-1"
              style={{ backgroundColor: leg.color }}
              title={`${leg.title} ${leg.duration}`}
            />
          ))}
        </div>

        <p className="mt-3 text-sm font-semibold text-jidoro-ink">{plan.title}</p>
        <p className="mt-1 text-xs leading-5 text-jidoro-muted">
          {plan.summary} · 요금 {plan.fare}
        </p>
        {plan.arrivals.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {plan.arrivals.map((arrival, index) => (
              <span
                key={`${plan.id}-${arrival.title}-${index}`}
                className="rounded-full bg-jidoro-surface px-2 py-1 text-[11px] font-bold text-jidoro-muted"
              >
                {arrival.title} {arrival.arrivalText}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onDetail}
        className="flex h-11 w-full items-center justify-center gap-1 border-t border-jidoro-line text-sm font-extrabold text-jidoro-blue hover:bg-blue-50"
      >
        상세보기
        <ChevronDown size={16} />
      </button>
    </article>
  );
}

function RouteBar({ routeInfo }: { routeInfo: RouteInfo }) {
  const segments = routeInfo.routeSegments?.length ? routeInfo.routeSegments : [];

  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
      {segments.map((segment, index) => (
        <span
          key={`${segment.label}-${index}`}
          className="min-w-4 flex-1"
          style={{ backgroundColor: segment.color }}
          title={segment.label}
        />
      ))}
    </div>
  );
}

function TransitSection({ routeInfo }: { routeInfo: RouteInfo }) {
  const arrivals = routeInfo.transitArrivals ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-jidoro-ink">실시간 교통 정보</p>
        <span className="rounded-full bg-jidoro-surface px-2 py-1 text-[11px] font-bold text-jidoro-muted">
          TAGO
        </span>
      </div>

      {arrivals.length > 0 ? (
        <div className="mt-3 space-y-2">
          {arrivals.map((arrival, index) => (
            <TransitArrivalCard key={`${arrival.type}-${arrival.stationName}-${arrival.title}-${index}`} arrival={arrival} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-jidoro-surface p-3 text-sm leading-6 text-jidoro-muted">
          주변 정류장 또는 지하철 정보를 찾지 못했습니다.
        </p>
      )}

      {routeInfo.busArrivalNotice ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-700">
          {routeInfo.busArrivalNotice}
        </p>
      ) : null}
    </section>
  );
}

function TrafficLegend({ routeInfo }: { routeInfo: RouteInfo }) {
  const segments = routeInfo.routeSegments ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-extrabold text-jidoro-ink">교통 상태</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {segments.map((segment, index) => (
          <span
            key={`${segment.label}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-jidoro-surface px-3 py-1 text-xs font-bold text-jidoro-ink"
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} />
            {segment.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function StepsSection({ routeInfo }: { routeInfo: RouteInfo }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-extrabold text-jidoro-ink">상세 경로</p>
      <ol className="mt-3 space-y-3">
        {routeInfo.steps.map((step, index) => (
          <li key={`${step}-${index}`} className="flex gap-3 text-sm leading-6 text-jidoro-muted">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-jidoro-blue text-xs font-bold text-white">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center shadow-sm">
      <Route size={28} className="text-jidoro-blue" />
      <p className="mt-3 text-lg font-extrabold text-jidoro-ink">경로를 검색하세요</p>
      <p className="mt-2 text-sm leading-6 text-jidoro-muted">
        장소 상세에서 출발 또는 도착을 누르면 여기에서 바로 경로를 입력할 수 있습니다.
      </p>
    </div>
  );
}

function TransitArrivalCard({ arrival }: { arrival: TransitArrival }) {
  const Icon = arrival.type === "bus" ? Bus : Train;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            arrival.type === "bus" ? "bg-emerald-50 text-jidoro-green" : "bg-blue-50 text-jidoro-blue"
          }`}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-extrabold text-jidoro-ink">{arrival.title}</p>
            <span className="shrink-0 rounded-full bg-jidoro-surface px-2 py-1 text-xs font-extrabold text-jidoro-blue">
              {arrival.arrivalText}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-jidoro-muted">{arrival.stationName}</p>
          {arrival.detail ? (
            <p className="mt-1 text-xs leading-5 text-jidoro-muted">{arrival.detail}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RouteDetailDrawer({
  routeInfo,
  plan,
  onClose
}: {
  routeInfo: RouteInfo;
  plan: TransitPlan | null;
  onClose: () => void;
}) {
  const legs = plan?.legs ?? routeInfo.transitLegs ?? [];

  return (
    <div className="absolute inset-y-0 right-0 z-20 w-full max-w-[390px] border-l border-jidoro-line bg-white shadow-panel lg:left-full lg:right-auto">
      <div className="flex h-full flex-col">
        <div className="border-b border-jidoro-line p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-jidoro-blue">{plan?.label ?? "최적"}</p>
              <p className="mt-1 text-3xl font-black text-jidoro-ink">{plan?.duration ?? routeInfo.duration}</p>
              <p className="mt-1 text-sm font-semibold text-jidoro-muted">
                환승 0회 · {plan?.distance ?? routeInfo.distance} · {plan?.fare ?? "요금 정보 없음"}
              </p>
              {plan ? (
                <p className="mt-1 text-xs font-semibold text-jidoro-muted">
                  {plan.departureTime} 출발 · {plan.arrivalTime} 도착
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-lg text-jidoro-ink hover:bg-jidoro-surface"
              title="닫기"
            >
              <X size={21} />
            </button>
          </div>
          {plan ? <PlanBar plan={plan} /> : <RouteBar routeInfo={routeInfo} />}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {legs.length > 0 ? (
            <div className="space-y-0">
              {legs.map((leg, index) => (
                <TransitLegRow key={`${leg.title}-${index}`} leg={leg} first={index === 0} last={index === legs.length - 1} />
              ))}
            </div>
          ) : (
            <StepsSection routeInfo={routeInfo} />
          )}
        </div>

        <div className="border-t border-jidoro-line p-4">
          <p className="text-right text-sm font-semibold text-jidoro-muted">
            현재 {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanBar({ plan }: { plan: TransitPlan }) {
  return (
    <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
      {plan.legs.map((leg, index) => (
        <span
          key={`${plan.id}-bar-${index}`}
          className="min-w-4 flex-1"
          style={{ backgroundColor: leg.color }}
          title={`${leg.title} ${leg.duration}`}
        />
      ))}
    </div>
  );
}

function TransitLegRow({ leg, first, last }: { leg: TransitLeg; first: boolean; last: boolean }) {
  const Icon = leg.type === "bus" ? Bus : leg.type === "subway" ? Train : Footprints;

  return (
    <div className="grid grid-cols-[54px_24px_minmax(0,1fr)] gap-3">
      <div className="pt-1 text-right text-xs font-semibold text-jidoro-muted">
        {first ? "출발" : last ? "도착" : ""}
      </div>
      <div className="relative flex justify-center">
        <span className="z-10 flex size-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: leg.color }}>
          <Icon size={14} />
        </span>
        {!last ? <span className="absolute top-6 h-full w-px bg-slate-200" /> : null}
      </div>
      <div className="pb-6">
        <p className="text-sm font-extrabold text-jidoro-ink">{leg.from}</p>
        <div className="mt-3 rounded-lg border border-jidoro-line bg-jidoro-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold" style={{ color: leg.color }}>
              {leg.title}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-jidoro-muted">
              <Clock3 size={12} />
              {leg.duration}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-jidoro-muted">{leg.detail}</p>
        </div>
        {last ? <p className="mt-3 text-sm font-extrabold text-jidoro-ink">{leg.to}</p> : null}
      </div>
    </div>
  );
}
