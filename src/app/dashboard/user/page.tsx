"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import dynamic from "next/dynamic";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bus, 
  Map as MapIcon, 
  ArrowDownUp, 
  Crosshair, 
  WifiOff, 
  Search, 
  ListFilter, 
  X,
  ChevronLeft, 
  ChevronRight,
  ArrowRight, 
  Activity,
  CreditCard,
  MapPinned
} from 'lucide-react';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { GeocodingResult } from '@/lib/geocoding';
import { MatchingRoute, useRoutes } from '@/context/RouteContext';
import { DashboardHeader } from '@/components/DashboardHeader';
import { fetchRoadFollowingRoute } from '@/lib/routing';
import { RatingDialog } from '@/components/RatingDialog';
import { requestNotificationPermission } from '@/lib/notifications';
import { RequireRole } from '@/components/RequireRole';
import { RouteJourneyPanel } from '@/components/RouteJourneyPanel';
import { buildSimulatedBuses, DemoBusConfig } from '@/lib/demo-buses';
import { ShowcaseDrawer } from '@/components/ShowcaseDrawer';
import { useToast } from '@/hooks/use-toast';

interface BusData {
  id: string;
  driverId: string;
  driverName: string;
  vehicleNumber?: string;
  routeId?: string;
  location: { lat: number; lng: number };
  updatedAt: string;
  status: string;
  isDemo?: boolean;
}

type GpsStatus = 'locating' | 'ready' | 'denied' | 'unsupported' | 'error';

const STALE_BUS_MS = 60_000;
const DynamicMap = dynamic(() => import("@/components/Map"), { ssr: false });

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function getFreshnessText(updatedAt: string, now: number) {
  const ageSeconds = Math.max(0, Math.round((now - new Date(updatedAt).getTime()) / 1000));
  if (ageSeconds < 5) return 'updated just now';
  if (ageSeconds < 60) return `updated ${ageSeconds}s ago`;
  const ageMinutes = Math.round(ageSeconds / 60);
  return `updated ${ageMinutes}m ago`;
}

function formatEta(minutes: number | null) {
  if (minutes === null) return 'ETA unavailable';
  if (minutes <= 1) return 'Arriving now';
  return `${minutes} min`;
}

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access denied. Please allow location in your browser.';
    case error.POSITION_UNAVAILABLE:
      return 'Location unavailable on this device right now.';
    case error.TIMEOUT:
      return 'Location request timed out. Try again.';
    default:
      return 'Location unavailable. Check permissions.';
  }
}

function getStopOffsetFromBoarding(routeMeta: MatchingRoute, stopTimeFromStart?: number) {
  if (typeof stopTimeFromStart !== 'number') return '';
  const boardingTime = routeMeta.sourceStop.timeFromStart || 0;
  const offset = Math.max(0, stopTimeFromStart - boardingTime);
  return offset === 0 ? 'Board' : `+${offset}m`;
}

function estimateArrivalMins(routeMeta: MatchingRoute, bus: BusData) {
  const routeStops = routeMeta.route.stops;
  const boardingIdx = routeStops.findIndex((stop) => stop.name === routeMeta.sourceStop.name);
  if (boardingIdx === -1) return null;

  let nearestStopIdx = -1;
  let nearestStopDistance = Infinity;

  routeStops.forEach((stop, idx) => {
    const distance = getDistanceFromLatLonInKm(bus.location.lat, bus.location.lng, stop.lat, stop.lng);
    if (distance < nearestStopDistance) {
      nearestStopDistance = distance;
      nearestStopIdx = idx;
    }
  });

  if (nearestStopIdx === -1) return null;

  const nearestStop = routeStops[nearestStopIdx];
  const scheduledDelta = (routeMeta.sourceStop.timeFromStart || 0) - (nearestStop.timeFromStart || 0);
  const directDistanceToBoarding = getDistanceFromLatLonInKm(bus.location.lat, bus.location.lng, routeMeta.sourceStop.lat, routeMeta.sourceStop.lng);

  if (scheduledDelta >= 0) {
    return Math.max(1, Math.round(scheduledDelta + nearestStopDistance * 3));
  }
  return Math.max(1, Math.round(directDistanceToBoarding * 3));
}

function UserDashboardContent() {
  const { user } = useAuth();
  const { routes, findLenientMatchingRoutes, loading: routesLoading } = useRoutes();
  const { toast } = useToast();
  const [buses, setBuses] = useState<BusData[]>([]);
  const [demoBusConfigs, setDemoBusConfigs] = useState<DemoBusConfig[]>([]);
  const [busesLoading, setBusesLoading] = useState(true);
  const [source, setSource] = useState<GeocodingResult | null>(null);
  const [dest, setDest] = useState<GeocodingResult | null>(null);
  const [matchingRoutes, setMatchingRoutes] = useState<MatchingRoute[]>([]);
  const [selectedRouteMeta, setSelectedRouteMeta] = useState<MatchingRoute | null>(null);
  const [selectedRoutePath, setSelectedRoutePath] = useState<[number, number][]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: 13.10, lng: 77.59 });
  const [ratingTarget, setRatingTarget] = useState<{ id: string; name: string } | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const notifiedBuses = useRef<Set<string>>(new Set());

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('locating');
  const [focusKey, setFocusKey] = useState(0);
  const [hasAutoCentered, setHasAutoCentered] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'results' | 'map'>('search');
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isResultsPanelOpen, setIsResultsPanelOpen] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [isPlannerCollapsed, setIsPlannerCollapsed] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (selectedRouteMeta) {
      fetchRoadFollowingRoute(selectedRouteMeta.route.stops).then(setSelectedRoutePath);
    } else {
      setSelectedRoutePath([]);
    }
  }, [selectedRouteMeta]);

  // Force map resize whenever panels change
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 400);
    return () => clearTimeout(timer);
  }, [activeTab, isResultsPanelOpen, selectedRouteMeta, isRightSidebarCollapsed, isPlannerCollapsed]);

  const demoBuses = useMemo(
    () => buildSimulatedBuses(demoBusConfigs, routes, now || Date.now()),
    [demoBusConfigs, routes, now]
  );

  const freshBuses = useMemo(() => {
    const liveBuses = buses.filter(
      (bus) => now !== null && (now - new Date(bus.updatedAt).getTime()) <= STALE_BUS_MS
    );
    return [...liveBuses, ...demoBuses];
  }, [buses, demoBuses, now]);

  useEffect(() => {
    const q = query(collection(db, 'buses'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const busList: BusData[] = [];
      snapshot.forEach((doc) => busList.push({ id: doc.id, ...doc.data() } as BusData));
      setBuses(busList);
      setBusesLoading(false);
    }, () => setBusesLoading(false));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (routes.length > 0 && !source && !dest) {
      const presidencyCoords = { lat: 13.1704, lng: 77.5662 };
      setDest({ displayName: "Presidency University", ...presidencyCoords });
      setMatchingRoutes(findLenientMatchingRoutes(null, null, presidencyCoords.lat, presidencyCoords.lng, 8));
    }
  }, [routes.length]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'demoBuses'), (snapshot) => {
      setDemoBusConfigs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DemoBusConfig)));
    });
    return () => unsubscribe();
  }, []);

  const applyUserLocation = (loc: { lat: number; lng: number }, shouldCenter = true) => {
    setUserLocation(loc);
    setGpsStatus('ready');
    if (shouldCenter) {
      setMapCenter(loc);
      setHasAutoCentered(true);
      setFocusKey((f) => f + 1);
    }
  };

  const requestDeviceLocation = () => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      toast({ title: 'GPS Unsupported', description: 'This browser cannot access your location.' });
      return;
    }

    setGpsStatus('locating');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (error) => {
        const nextStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'error';
        setGpsStatus(nextStatus);
        toast({
          title: nextStatus === 'denied' ? 'Location Blocked' : 'Location Unavailable',
          description: getGeolocationErrorMessage(error),
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      return;
    }

    requestDeviceLocation();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        applyUserLocation(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          !hasAutoCentered
        );
      },
      (error) => {
        setGpsStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [hasAutoCentered]);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const clearSelectedRoute = () => {
    setSelectedRouteMeta(null);
    setIsWatching(false);
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedRouteMeta) {
        clearSelectedRoute();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedRouteMeta]);

  const handleSearch = () => {
    if (!source && !dest) return;
    setMatchingRoutes(findLenientMatchingRoutes(source?.lat || null, source?.lng || null, dest?.lat || null, dest?.lng || null, 8));
    clearSelectedRoute();
    setIsResultsPanelOpen(true);
    if (isMobile) setActiveTab('results');
  };

  const handleRouteSelect = (meta: MatchingRoute) => {
    if (selectedRouteMeta?.route.id === meta.route.id) {
      clearSelectedRoute();
    } else {
      setSelectedRouteMeta(meta);
    }
    if (isMobile) setActiveTab('map');
  };

  const getRouteInsights = (routeMeta: MatchingRoute) => {
    const routeBuses = freshBuses.filter((bus) => bus.routeId === routeMeta.route.id);
    const boardingReference = userLocation || source;
    const boardingDistanceKm = boardingReference ? getDistanceFromLatLonInKm(boardingReference.lat, boardingReference.lng, routeMeta.sourceStop.lat, routeMeta.sourceStop.lng) : 0;
    const nearestBus = routeBuses.map((bus) => ({ bus, distanceKm: getDistanceFromLatLonInKm(bus.location.lat, bus.location.lng, routeMeta.sourceStop.lat, routeMeta.sourceStop.lng), etaMins: estimateArrivalMins(routeMeta, bus) })).sort((a, b) => (a.etaMins || 999) - (b.etaMins || 999))[0] || null;
    return { routeBuses, boardingDistanceKm, nearestBus };
  };

  const displayedBuses = selectedRouteMeta ? freshBuses.filter(b => b.routeId === selectedRouteMeta.route.id) : freshBuses;
  const selectedTravelStops = useMemo(() => {
    if (!selectedRouteMeta) return [];
    const stops = selectedRouteMeta.route.stops;
    const sIdx = stops.findIndex(s => s.name === selectedRouteMeta.sourceStop.name);
    const dIdx = stops.findIndex(s => s.name === selectedRouteMeta.destStop.name);
    return (sIdx !== -1 && dIdx !== -1 && sIdx <= dIdx) ? stops.slice(sIdx, dIdx + 1) : [];
  }, [selectedRouteMeta]);

  const selectedInsights = selectedRouteMeta ? getRouteInsights(selectedRouteMeta) : null;
  const nearestBusFreshness = selectedInsights?.nearestBus && now ? getFreshnessText(selectedInsights.nearestBus.bus.updatedAt, now) : 'Live data unavailable';
  const layoutTrigger = [
    activeTab,
    isMobile ? 'mobile' : 'desktop',
    isPlannerCollapsed ? 'planner-collapsed' : 'planner-open',
    isRightSidebarCollapsed ? 'tools-collapsed' : 'tools-open',
    selectedRouteMeta?.route.id || 'no-route',
  ].join(':');

  const toggleWatching = async () => {
    if (isWatching) {
      setIsWatching(false);
      notifiedBuses.current.clear();
    } else if (await requestNotificationPermission()) {
      setIsWatching(true);
      toast({ title: "Alerts Enabled", description: "We'll notify you when the bus is 2 stops away." });
    }
  };

  const gpsMessage = {
    locating: 'Trying to locate you...',
    ready: userLocation ? 'Your live location is visible on the map.' : 'Location found.',
    denied: 'Location access denied. Please allow location in your browser.',
    unsupported: 'Geolocation is not supported in this browser.',
    error: 'Location unavailable. Check permissions.',
  }[gpsStatus];

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 overflow-hidden relative font-outfit">
      <DashboardHeader title="Passenger Dashboard" />
      <ShowcaseDrawer open={showcaseOpen} onOpenChange={setShowcaseOpen} />

      <main className="flex-1 flex overflow-hidden relative">
        {/* LEFT SEARCH PANEL */}
        <div
          className={`relative z-20 hidden border-r border-zinc-200/80 bg-white/96 transition-all duration-500 lg:flex lg:flex-col ${
            isPlannerCollapsed ? 'w-[92px]' : 'w-[420px]'
          }`}
        >
          <div className="border-b border-zinc-200/80 p-4">
            <div className={`flex items-center ${isPlannerCollapsed ? 'justify-center' : 'justify-between gap-3'}`}>
              {isPlannerCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsPlannerCollapsed(false)}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50"
                  aria-label="Expand plan panel"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-200/70">
                      <Search className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Trip Planner</p>
                      <h2 className="text-lg font-black tracking-tight text-zinc-950">Plan Your Journey</h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPlannerCollapsed(true)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50"
                    aria-label="Collapse plan panel"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {isPlannerCollapsed ? (
            <div className="flex flex-1 flex-col items-center justify-between px-4 py-5">
              <div className="flex flex-col items-center gap-3">
                {[
                  { icon: Search, label: 'Search' },
                  { icon: Bus, label: 'Routes' },
                  { icon: Crosshair, label: 'Locate' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 shadow-sm"
                    title={item.label}
                    onClick={item.label === 'Locate' ? requestDeviceLocation : undefined}
                  >
                    <item.icon className="h-5 w-5" />
                  </button>
                ))}
              </div>

              <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 px-3 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Routes</p>
                <p className="mt-2 text-xl font-black text-zinc-900">{matchingRoutes.length}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-6 p-6">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Fresh buses', value: String(freshBuses.length), tone: 'text-emerald-600' },
                    { label: 'GPS', value: gpsStatus === 'ready' ? 'On' : 'Off', tone: gpsStatus === 'ready' ? 'text-blue-600' : 'text-amber-600' },
                    { label: 'Matches', value: String(matchingRoutes.length), tone: 'text-zinc-900' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-3 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{item.label}</p>
                      <p className={`mt-2 text-lg font-black ${item.tone}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="relative space-y-3">
                  <div className="absolute bottom-6 left-[18px] top-6 w-[2px] border-l border-dashed border-zinc-300 bg-zinc-200/40" />
                  <LocationSearchInput placeholder="From where?" onLocationSelect={setSource} />
                  <LocationSearchInput placeholder="To where?" onLocationSelect={setDest} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full border bg-white shadow-md hover:bg-zinc-50"
                    onClick={() => { const s = source; setSource(dest); setDest(s); }}
                  >
                    <ArrowDownUp className="h-4 w-4 text-zinc-400" />
                  </Button>
                </div>

                <Button
                  className="h-12 w-full rounded-2xl bg-emerald-600 font-black text-white shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] hover:bg-emerald-700"
                  onClick={handleSearch}
                  disabled={!source || !dest}
                >
                  Find Live Buses
                </Button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto border-t border-zinc-200/80 bg-zinc-50/70 p-4 no-scrollbar">
                {(routesLoading || busesLoading) ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-3xl" />)}
                  </div>
                ) : matchingRoutes.length === 0 ? (
                  <div className="py-10 text-center">
                    <WifiOff className="mx-auto mb-4 h-10 w-10 text-zinc-300" />
                    <p className="text-sm font-bold text-zinc-400">Search to see routes</p>
                  </div>
                ) : (
                  matchingRoutes.map(meta => {
                    const insights = getRouteInsights(meta);
                    const active = selectedRouteMeta?.route.id === meta.route.id;
                    return (
                      <Card
                        key={meta.route.id}
                        className={`group cursor-pointer rounded-[28px] border-2 p-5 transition-all hover:shadow-xl ${
                          active ? 'border-emerald-500 bg-white ring-4 ring-emerald-500/10' : 'border-zinc-100 bg-white hover:border-zinc-200'
                        }`}
                        onClick={() => handleRouteSelect(meta)}
                      >
                        <div className="mb-4 flex items-start justify-between">
                          <div
                            className="rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm"
                            style={{ backgroundColor: meta.route.color }}
                          >
                            Route {meta.route.id}
                          </div>
                          <span className="text-lg font-black text-zinc-900">{meta.estimatedDurationMins}m</span>
                        </div>

                        <div className="flex items-center gap-3 py-2 text-xs font-bold text-zinc-600">
                          <span className="truncate">{meta.sourceStop.name}</span>
                          <ArrowRight className="h-3 w-3 shrink-0" />
                          <span className="truncate">{meta.destStop.name}</span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">ETA</p>
                            <p className="mt-1 text-sm font-black text-zinc-900">{formatEta(insights.nearestBus?.etaMins ?? null)}</p>
                          </div>
                          <div className="rounded-2xl bg-zinc-50 px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Walk</p>
                            <p className="mt-1 text-sm font-black text-zinc-900">{formatDistance(insights.boardingDistanceKm)}</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* BACKGROUND MAP */}
        <div className="relative z-0 flex-1 min-w-0">
          <DynamicMap
            buses={displayedBuses}
            center={mapCenter}
            route={selectedRouteMeta?.route || null}
            polylinePoints={selectedRoutePath}
            userLocation={userLocation}
            focusKey={focusKey}
            layoutTrigger={layoutTrigger}
          />

          {selectedRouteMeta && (
            <div className="absolute right-4 top-4 z-20">
              <Button
                className="h-11 rounded-2xl border border-white/80 bg-white/95 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-700 shadow-lg backdrop-blur hover:bg-white"
                onClick={clearSelectedRoute}
              >
                <X className="mr-2 h-4 w-4" />
                Back To Map
              </Button>
            </div>
          )}
          
          {/* FLOATING STATUS CARD (TOP LEFT) */}
          <div className={`absolute left-4 z-10 hidden md:block ${selectedRouteMeta ? 'top-20' : 'top-4'}`}>
            <Card className="p-4 bg-white/90 backdrop-blur shadow-xl border-white/20 rounded-3xl w-64">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Live System Status</span>
              </div>
              <p className="text-sm font-black text-zinc-900 leading-tight">
                {gpsMessage}
              </p>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-zinc-400">
                <Activity className="w-3 h-3" />
                Tracking {freshBuses.length} fresh buses
              </div>
              {gpsStatus !== 'ready' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 h-9 rounded-2xl border border-zinc-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-700 hover:bg-zinc-50"
                  onClick={requestDeviceLocation}
                >
                  <Crosshair className="mr-2 h-3.5 w-3.5" />
                  Use My Location
                </Button>
              )}
            </Card>
          </div>
        </div>

        {/* RIGHT SIDEBAR - As seen in the screenshot */}
        <div className={`relative z-20 hidden border-l bg-white/96 transition-all duration-500 lg:flex lg:flex-col ${isRightSidebarCollapsed ? 'w-0' : 'w-[320px]'}`}>
          <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
            <div className="space-y-6">
              {/* Advanced Features Card */}
              <Card className="rounded-[32px] p-6 bg-white border border-zinc-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quick Tools</p>
                    <h3 className="text-lg font-black text-zinc-900 tracking-tight">Advanced Features</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { title: "Smart Pass", desc: "Biometric bus authentication", icon: CreditCard },
                    { title: "Campus Map", desc: "Detailed University navigation", icon: MapPinned },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-all group cursor-pointer border border-transparent hover:border-zinc-100">
                      <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-blue-600 transition-all">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-zinc-800">{item.title}</p>
                        <p className="text-[10px] font-medium text-zinc-400">{item.desc}</p>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-zinc-300 rotate-180 group-hover:translate-x-1 transition-transform" />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Showcase Card */}
              <Card className="rounded-[32px] p-6 bg-zinc-900 text-white shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-2">Showcase</p>
                  <h3 className="text-lg font-black leading-tight mb-6">Explore our thesis project capabilities.</h3>
                  <Button 
                    className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl h-12 font-black text-xs"
                    onClick={() => setShowcaseOpen(true)}
                  >
                    Open Full Showcase
                  </Button>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-[80px] -mr-16 -mt-16 group-hover:bg-blue-500/30 transition-all" />
              </Card>
            </div>
          </div>
          
          {/* Collapse toggle */}
          <button 
            onClick={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
            className="absolute left-0 top-1/2 -translate-x-1/2 z-30 w-8 h-16 bg-white border rounded-full flex items-center justify-center shadow-lg hover:bg-zinc-50 transition-all"
          >
            <ChevronLeft className={`w-5 h-5 text-zinc-400 transition-transform ${isRightSidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* MOBILE FLOATING RECENTER BUTTON */}
        <div className="absolute right-6 bottom-24 z-30 lg:hidden">
          <Button 
            className="w-14 h-14 rounded-2xl bg-white shadow-2xl border hover:bg-zinc-50"
            onClick={() => {
              if (userLocation) {
                setMapCenter(userLocation);
                setFocusKey(f => f + 1);
              } else {
                requestDeviceLocation();
              }
            }}
          >
            <Crosshair className={`w-6 h-6 ${gpsStatus === 'ready' ? 'text-blue-600' : 'text-zinc-400'}`} />
          </Button>
        </div>

        {/* JOURNEY PANEL OVERLAY */}
        {selectedRouteMeta && selectedInsights && (
          <div className={`absolute z-[100] transition-all duration-500 ${
            isMobile ? 'inset-x-0 bottom-0' : 'bottom-4 right-4 w-[430px]'
          }`}>
            <RouteJourneyPanel
              routeMeta={selectedRouteMeta}
              travelStops={selectedTravelStops}
              insights={selectedInsights}
              isWatching={isWatching}
              onToggleWatch={toggleWatching}
              onRateDriver={() => {
                const bus = selectedInsights.nearestBus?.bus;
                if (bus) setRatingTarget({ id: bus.driverId, name: bus.driverName });
              }}
              formatDistance={formatDistance}
              formatEta={formatEta}
              getStopOffsetFromBoarding={getStopOffsetFromBoarding}
              freshnessText={nearestBusFreshness}
              onBack={clearSelectedRoute}
              onShare={async () => {
                if (navigator.share) await navigator.share({ title: `Bus ${selectedRouteMeta.route.id}`, text: `Tracking ${selectedRouteMeta.route.name}` });
              }}
              className={isMobile ? "rounded-t-[40px] shadow-2xl h-[85vh]" : "rounded-[32px] shadow-2xl"}
              mobile={isMobile}
            />
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="lg:hidden h-[72px] bg-white border-t flex items-center justify-around px-4 z-[60]">
        {[
          { id: 'search', icon: Search, label: 'Search' },
          { id: 'results', icon: ListFilter, label: 'Routes' },
          { id: 'map', icon: MapIcon, label: 'Explore' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center gap-1 ${activeTab === tab.id ? 'text-emerald-600' : 'text-zinc-400'}`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      <RatingDialog
        isOpen={!!ratingTarget}
        onClose={() => setRatingTarget(null)}
        driverId={ratingTarget?.id || ''}
        driverName={ratingTarget?.name || ''}
        passengerId={user?.uid || ''}
      />
    </div>
  );
}

export default function UserDashboard() {
  return (
    <RequireRole allowedRoles={['user']}>
      <UserDashboardContent />
    </RequireRole>
  );
}
