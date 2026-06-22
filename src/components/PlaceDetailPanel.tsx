"use client";

import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Heart,
  MapPin,
  Navigation,
  ParkingCircle,
  Phone,
  ScanSearch,
  Share2,
  Star
} from "lucide-react";
import { getPrimaryAddress } from "@/lib/placeUtils";
import type { Place } from "@/types/place";

interface PlaceDetailPanelProps {
  place: Place;
  favorite: boolean;
  copiedText: string;
  onBack: () => void;
  onClose: () => void;
  onToggleFavorite: (place: Place) => void;
  onSetStart: (place: Place) => void;
  onSetDestination: (place: Place) => void;
  onOpenRoadview: (place: Place) => void;
  onCopyText: (value: string, label: string) => void;
}

export default function PlaceDetailPanel({
  place,
  favorite,
  copiedText,
  onBack,
  onClose,
  onToggleFavorite,
  onSetStart,
  onSetDestination,
  onOpenRoadview,
  onCopyText
}: PlaceDetailPanelProps) {
  const address = getPrimaryAddress(place);
  const shareText = `${place.name} ${address}`;

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-slate-200 bg-slate-50/95 shadow-[8px_0_30px_rgba(15,23,42,0.06)] lg:w-[430px] lg:shrink-0">
      <div className="border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex size-9 items-center justify-center rounded-xl text-jidoro-ink transition hover:bg-slate-100"
            title="검색 결과로"
          >
            <ArrowLeft size={21} />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(place)}
              className={`flex size-9 items-center justify-center rounded-lg ${
                favorite ? "bg-rose-50 text-rose-600" : "text-jidoro-ink hover:bg-slate-100"
              }`}
              title="즐겨찾기"
            >
              <Heart size={19} fill={favorite ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-xl text-jidoro-ink transition hover:bg-slate-100"
              title="닫기"
            >
              ×
            </button>
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-black leading-tight text-jidoro-ink">{place.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-jidoro-muted">{place.rawCategory || place.category}</span>
          {place.rating ? (
            <span className="inline-flex items-center gap-1 font-bold text-amber-600">
              <Star size={15} fill="currentColor" />
              {place.rating.toFixed(1)}
            </span>
          ) : null}
          <span className="font-bold text-jidoro-green">{place.status}</span>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onSetStart(place)}
            className="inline-flex h-10 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-jidoro-blue transition hover:bg-blue-100"
          >
            출발
          </button>
          <button
            type="button"
            onClick={() => onSetDestination(place)}
            className="inline-flex h-10 items-center justify-center rounded-full bg-jidoro-blue text-sm font-extrabold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700"
          >
            도착
          </button>
          <button
            type="button"
            onClick={() => onOpenRoadview(place)}
            className="inline-flex h-10 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white text-sm font-bold text-jidoro-ink shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-jidoro-blue"
          >
            <ScanSearch size={15} />
            거리뷰
          </button>
          <button
            type="button"
            onClick={() => onCopyText(shareText, "공유 문구 복사됨")}
            className="inline-flex h-10 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white text-sm font-bold text-jidoro-ink shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-jidoro-blue"
          >
            <Share2 size={15} />
            공유
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
        {copiedText ? (
          <p className="mx-5 mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-jidoro-green">
            {copiedText}
          </p>
        ) : null}

        <section className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="mt-0.5 shrink-0 text-jidoro-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-6 text-jidoro-ink">{address}</p>
              {place.address && place.address !== address ? (
                <p className="mt-1 text-xs leading-5 text-jidoro-muted">지번 {place.address}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onCopyText(address, "주소 복사됨")}
              className="shrink-0 text-xs font-bold text-jidoro-blue"
            >
              복사
            </button>
          </div>
        </section>

        <section className="mx-4 mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold text-jidoro-ink">장소 정보</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <InfoTile label="구분" value={place.category} />
            <InfoTile label="거리" value={place.distance} />
            <InfoTile label="영업시간" value={place.hours} />
            <InfoTile label="주차" value={place.parking ? "가능" : "정보 없음"} />
          </div>
          <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm leading-6 text-jidoro-ink">
            {place.description}
          </p>
        </section>

        <section className="mx-4 mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3 text-sm text-jidoro-muted">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Phone size={17} className="shrink-0 text-jidoro-blue" />
                <span className="truncate">{place.phone}</span>
              </div>
              {place.phone !== "전화번호 정보 없음" && place.phone !== "해당 없음" ? (
                <button
                  type="button"
                  onClick={() => onCopyText(place.phone, "전화번호 복사됨")}
                  className="shrink-0 text-xs font-bold text-jidoro-blue"
                >
                  복사
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <ParkingCircle size={17} className="text-jidoro-blue" />
              <span>{place.parking ? "주차 가능" : "주차 정보 없음"}</span>
            </div>
          </div>
        </section>

        <section className="mx-4 mb-5 mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSetDestination(place)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-jidoro-blue text-sm font-extrabold text-white"
            >
              <Navigation size={17} />
              길찾기
            </button>
            {place.link ? (
              <a
                href={place.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-jidoro-line bg-white text-sm font-bold text-jidoro-ink hover:border-jidoro-blue hover:text-jidoro-blue"
              >
                <ExternalLink size={17} />
                열기
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onCopyText(address, "주소 복사됨")}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-jidoro-line bg-white text-sm font-bold text-jidoro-ink hover:border-jidoro-blue hover:text-jidoro-blue"
              >
                <Copy size={17} />
                주소
              </button>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-jidoro-surface p-3">
      <p className="text-xs font-bold text-jidoro-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold text-jidoro-ink">{value}</p>
    </div>
  );
}
