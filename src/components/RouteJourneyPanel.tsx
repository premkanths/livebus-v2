"use client";

import { Activity, Bus, Clock3, MapPinned, Navigation, Share2, Star } from "lucide-react";
import { MatchingRoute, Stop } from "@/context/RouteContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface BusData {
  id: string;
  driverId: string;
  driverName: string;
  vehicleNumber?: string;
  routeId?: string;
  location: { lat: number; lng: number };
  updatedAt: string;
  status: string;
}

interface RouteInsights {
  routeBuses: BusData[];
  boardingDistanceKm: number;
  nearestBus: {
    bus: BusData;
    distanceKm: number;
    etaMins: number | null;
  } | null;
}

interface RouteJourneyPanelProps {
  routeMeta: MatchingRoute;
  travelStops: Stop[];
  insights: RouteInsights;
  isWatching: boolean;
  onToggleWatch: () => void | Promise<void>;
  onRateDriver: () => void;
  formatDistance: (km: number) => string;
  formatEta: (minutes: number | null) => string;
  getStopOffsetFromBoarding: (routeMeta: MatchingRoute, stopTimeFromStart?: number) => string;
  freshnessText: string;
  onBack?: () => void;
  onShare?: () => void;
  className?: string;
  mobile?: boolean;
}

function getNearestStopIndex(bus: BusData | null, stops: Stop[]) {
  if (!bus || stops.length === 0) return 0;

  let nearestStopIdx = 0;
  let nearestStopDistance = Infinity;

  stops.forEach((stop, idx) => {
    const distance = getDistanceFromLatLonInKm(
      bus.location.lat,
      bus.location.lng,
      stop.lat,
      stop.lng
    );

    if (distance < nearestStopDistance) {
      nearestStopDistance = distance;
      nearestStopIdx = idx;
    }
  });

  return nearestStopIdx;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function RouteJourneyPanel({
  routeMeta,
  travelStops,
  insights,
  isWatching,
  onToggleWatch,
  onRateDriver,
  formatDistance,
  formatEta,
  getStopOffsetFromBoarding,
  freshnessText,
  onBack,
  onShare,
  className,
  mobile = false,
}: RouteJourneyPanelProps) {
  const accentColor = routeMeta.route.color || "#2563eb";
  const currentStopIndex = getNearestStopIndex(insights.nearestBus?.bus || null, travelStops);
  const progressPercent =
    travelStops.length > 1 ? (currentStopIndex / (travelStops.length - 1)) * 100 : 0;

  return (
    <Card
      className={`overflow-hidden border-white/60 bg-white/92 text-zinc-900 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl ${className || ""}`}
    >
      <div className="border-b border-zinc-200/80 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(255,255,255,0.94),rgba(14,165,233,0.1))] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white text-zinc-600 shadow-sm"
                aria-label="Back"
                onClick={onBack}
              >
                <Navigation className="h-4 w-4 -rotate-45" />
              </button>
              <div
                className="inline-flex rounded-2xl px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-sm"
                style={{ backgroundColor: accentColor }}
              >
                Route {routeMeta.route.id}
              </div>
            </div>
            <h3 className="truncate text-lg font-black tracking-tight">
              College Bus - {routeMeta.route.name}
            </h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              {routeMeta.sourceStop.name} to {routeMeta.destStop.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-2xl border border-white/80 bg-white text-zinc-500 shadow-sm hover:bg-zinc-50"
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-10 rounded-2xl px-4 text-[11px] font-black uppercase tracking-[0.2em] shadow-sm ${
                isWatching
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
              onClick={onToggleWatch}
            >
              <Activity className={`mr-2 h-3.5 w-3.5 ${isWatching ? "animate-pulse" : ""}`} />
              {isWatching ? "Watching" : "Watch"}
            </Button>
          </div>
        </div>

        <div className={`mt-5 grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
          <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
              <Clock3 className="h-3.5 w-3.5" />
              Next Bus
            </div>
            <p className="text-base font-black text-blue-700">{formatEta(insights.nearestBus?.etaMins ?? null)}</p>
            <p className="mt-1 text-[11px] font-bold text-zinc-500">
              {insights.nearestBus ? freshnessText : "No live vehicle on route"}
            </p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
              <MapPinned className="h-3.5 w-3.5" />
              Boarding Walk
            </div>
            <p className="text-base font-black text-zinc-900">{formatDistance(insights.boardingDistanceKm)}</p>
            <p className="mt-1 text-[11px] font-bold text-zinc-500">From your current pickup point</p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
              <Bus className="h-3.5 w-3.5" />
              Active Buses
            </div>
            <p className="text-base font-black text-zinc-900">{insights.routeBuses.length}</p>
            <p className="mt-1 truncate text-[11px] font-bold text-zinc-500">
              {insights.nearestBus?.bus.vehicleNumber || insights.nearestBus?.bus.driverName || "Waiting for dispatch"}
            </p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
              <Activity className="h-3.5 w-3.5" />
              Journey
            </div>
            <p className="text-base font-black text-zinc-900">{routeMeta.estimatedDurationMins} min</p>
            <p className="mt-1 text-[11px] font-bold text-zinc-500">{routeMeta.stopsToTravel} stops on this ride</p>
          </div>
        </div>
      </div>

      <div className={`${mobile ? "max-h-[45vh]" : "max-h-[68vh]"} overflow-y-auto p-5`}>
        <div className="mb-5 rounded-[28px] border border-zinc-200 bg-zinc-950 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Live Progress</p>
              <p className="mt-2 text-sm font-black">
                {insights.nearestBus
                  ? `${insights.nearestBus.bus.vehicleNumber || insights.nearestBus.bus.driverName} is near ${travelStops[currentStopIndex]?.name || routeMeta.sourceStop.name}`
                  : `Static preview from ${routeMeta.sourceStop.name} to ${routeMeta.destStop.name}`}
              </p>
            </div>

            {insights.nearestBus && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-2xl bg-white/10 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:bg-white/15"
                onClick={onRateDriver}
              >
                <Star className="mr-1.5 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                Rate
              </Button>
            )}
          </div>

          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(8, progressPercent)}%`, backgroundColor: accentColor }}
            />
          </div>
        </div>

        <div className="relative pl-10">
          <div className="absolute left-[17px] top-2 bottom-2 w-[3px] rounded-full bg-zinc-200" />

          {travelStops.map((stop, idx) => {
            const isCompleted = idx < currentStopIndex;
            const isCurrent = idx === currentStopIndex;
            const isDestination = idx === travelStops.length - 1;
            const badgeLabel = isCurrent
              ? "Current"
              : isCompleted
                ? "Passed"
                : isDestination
                  ? "Destination"
                  : "Upcoming";

            return (
              <div key={`${stop.name}-${idx}`} className="relative pb-6 last:pb-0">
                <div
                  className={`absolute left-[-33px] top-1.5 h-4 w-4 rounded-full border-[3px] border-white shadow-sm ${
                    isCurrent
                      ? "scale-110"
                      : ""
                  }`}
                  style={{
                    backgroundColor: isCompleted || isCurrent ? accentColor : "#ffffff",
                    borderColor: isCompleted || isCurrent ? accentColor : "#cbd5e1",
                    boxShadow: isCurrent ? `0 0 0 6px ${hexToRgba(accentColor, 0.14)}` : undefined,
                  }}
                />
                {isCurrent && (
                  <div
                    className="absolute left-[-66px] top-0.5 flex h-8 w-8 items-center justify-center rounded-2xl border border-white bg-white shadow-lg"
                    style={{ color: accentColor }}
                  >
                    <Bus className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`rounded-[26px] border p-4 shadow-sm transition-all ${
                    isCurrent
                      ? "border-transparent bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(255,255,255,1))]"
                      : isCompleted
                        ? "border-zinc-200 bg-zinc-50/90"
                        : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                          isCurrent ? "text-blue-700" : isCompleted ? "text-zinc-400" : "text-zinc-500"
                        }`}
                      >
                        {badgeLabel}
                      </p>
                      <h4 className="mt-1 text-sm font-black text-zinc-900">{stop.name}</h4>
                      <p className="mt-1 text-[11px] font-bold text-zinc-500">
                        {idx === 0
                          ? "Boarding point"
                          : isDestination
                            ? "Trip ends here"
                            : `${getStopOffsetFromBoarding(routeMeta, stop.timeFromStart)} from boarding`}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="rounded-2xl bg-zinc-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                        {stop.timeFromStart !== undefined ? `${stop.timeFromStart} min` : "ETA"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
