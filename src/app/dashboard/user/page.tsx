"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import dynamic from "next/dynamic";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bus, Map as MapIcon, ArrowDownUp, Crosshair, Loader2, MapPinned, MapPin, WifiOff, Clock3, Search, ListFilter, Activity, ChevronLeft, ChevronRight, GripVertical, Shield, ArrowRight, LayoutGrid } from 'lucide-react';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { GeocodingResult } from '@/lib/geocoding';
import { MatchingRoute, useRoutes } from '@/context/RouteContext';
import { DashboardHeader } from '@/components/DashboardHeader';
import { fetchRoadFollowingRoute } from '@/lib/routing';
import { RatingDialog } from '@/components/RatingDialog';
import { requestNotificationPermission, sendLocalNotification } from '@/lib/notifications';
import { RequireRole } from '@/components/RequireRole';
import { RouteJourneyPanel } from '@/components/RouteJourneyPanel';
import { buildSimulatedBuses, DemoBusConfig } from '@/lib/demo-buses';
import { FeatureShowcaseGrid } from '@/components/FeatureShowcaseGrid';
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
  const { user, profile } = useAuth();
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
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('locating');
  const [focusKey, setFocusKey] = useState(0);
  const [hasAutoCentered, setHasAutoCentered] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'results' | 'map'>('search');
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isResultsPanelOpen, setIsResultsPanelOpen] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 400);
    return () => clearTimeout(timer);
  }, [activeTab, isResultsPanelOpen, selectedRouteMeta]);

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

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setGpsStatus('ready');
        if (!hasAutoCentered) {
          setMapCenter(loc);
          setHasAutoCentered(true);
          setFocusKey(f => f + 1);
        }
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [hasAutoCentered]);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSearch = () => {
    if (!source && !dest) return;
    setMatchingRoutes(findLenientMatchingRoutes(source?.lat || null, source?.lng || null, dest?.lat || null, dest?.lng || null, 8));
    setSelectedRouteMeta(null);
    setIsResultsPanelOpen(true);
    if (isMobile) setActiveTab('results');
  };

  const handleRouteSelect = (meta: MatchingRoute) => {
    setSelectedRouteMeta(meta);
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
    denied: 'Location access denied. Please enable GPS in your browser.',
    unsupported: 'Geolocation is not supported in this browser.',
    error: 'Location unavailable. Check permissions.',
  }[gpsStatus];

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 overflow-hidden relative font-outfit">
      <DashboardHeader title="Passenger Dashboard" />
      <ShowcaseDrawer open={showcaseOpen} onOpenChange={setShowcaseOpen} />

      <main className="flex-1 relative overflow-hidden">
        {/* BACKGROUND MAP */}
        <div className="absolute inset-0 z-0">
          <DynamicMap
            buses={displayedBuses}
            center={mapCenter}
            route={selectedRouteMeta?.route || null}
            polylinePoints={selectedRoutePath}
            userLocation={userLocation}
            focusKey={focusKey}
          />
        </div>

        {/* TOP LEFT SEARCH CARD */}
        <div className={`absolute top-4 left-4 right-4 lg:right-auto lg:w-[420px] z-30 transition-all duration-500 transform ${isMobile && activeTab !== 'search' ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
          <Card className="p-5 shadow-2xl border-white/20 bg-white/90 backdrop-blur-xl rounded-[28px] border">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <Search className="w-4 h-4 text-white" />
              </div>
              <h2 className="font-black text-zinc-900 tracking-tight uppercase text-xs">Plan Your Journey</h2>
            </div>

            <div className="space-y-3 relative">
              <div className="absolute left-[18px] top-6 bottom-6 w-[2px] bg-zinc-200/50 border-l border-dashed border-zinc-300"></div>
              <LocationSearchInput placeholder="From where?" onLocationSelect={setSource} />
              <LocationSearchInput placeholder="To where?" onLocationSelect={setDest} />
              <Button 
                variant="ghost" size="icon" 
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-md border hover:bg-zinc-50 rounded-full w-8 h-8"
                onClick={() => { const s = source; setSource(dest); setDest(s); }}
              >
                <ArrowDownUp className="w-4 h-4 text-zinc-400" />
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-100/50">
              <div className={`w-2 h-2 rounded-full ${gpsStatus === 'ready' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">{gpsMessage}</span>
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-[10px] font-black uppercase text-blue-600 px-2" onClick={() => setHasAutoCentered(false)}>Recenter</Button>
            </div>

            <Button
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
              onClick={handleSearch}
              disabled={!source || !dest}
            >
              Search Live Buses
            </Button>
          </Card>
        </div>

        {/* SLIDING RESULTS PANEL */}
        <div className={`absolute transition-all duration-500 z-40 ${
          isMobile 
            ? `inset-x-0 bottom-0 bg-white rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] border-t transform ${activeTab === 'results' ? 'translate-y-0 h-[70vh]' : 'translate-y-full h-0'}`
            : `top-4 bottom-4 left-4 w-[420px] bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/20 transform ${isResultsPanelOpen ? 'translate-x-0' : '-translate-x-[110%]'}`
        }`}>
          <div className="h-full flex flex-col">
            <div className="p-6 flex items-center justify-between border-b shrink-0">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setIsResultsPanelOpen(false); if (isMobile) setActiveTab('search'); }}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="font-black text-xl text-zinc-900 tracking-tight">Available Routes</h2>
              </div>
              <span className="bg-zinc-100 text-zinc-500 text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase">{matchingRoutes.length} found</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {(routesLoading || busesLoading) ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-3xl" />)}
                </div>
              ) : matchingRoutes.length === 0 ? (
                <div className="text-center py-20 px-6">
                  <div className="w-20 h-20 bg-zinc-50 rounded-[30px] flex items-center justify-center mx-auto mb-6 border">
                    <WifiOff className="w-8 h-8 text-zinc-300" />
                  </div>
                  <h3 className="font-black text-xl text-zinc-800">No direct buses</h3>
                  <p className="text-zinc-500 mt-2 text-sm">We couldn't find a direct route. Try different stops.</p>
                </div>
              ) : (
                matchingRoutes.map(meta => {
                  const insights = getRouteInsights(meta);
                  const active = selectedRouteMeta?.route.id === meta.route.id;
                  return (
                    <Card 
                      key={meta.route.id} 
                      className={`p-5 cursor-pointer rounded-3xl border-2 transition-all hover:shadow-xl group ${active ? 'border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-500/10' : 'border-zinc-100 hover:border-zinc-200'}`}
                      onClick={() => handleRouteSelect(meta)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="px-3 py-1.5 rounded-xl text-[10px] font-black text-white shadow-sm tracking-widest uppercase" style={{ backgroundColor: meta.route.color }}>
                          Route {meta.route.id}
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-zinc-900">{meta.estimatedDurationMins}m</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-zinc-800 truncate">{meta.sourceStop.name}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase">Boarding</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-300" />
                        <div className="flex-1 min-w-0 text-right">
                          <p className="font-bold text-sm text-zinc-800 truncate">{meta.destStop.name}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase">Destination</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100">
                            <Bus className="w-4 h-4 text-emerald-600" />
                          </div>
                          <p className="text-xs font-bold text-emerald-600">{insights.routeBuses.length} Live</p>
                        </div>
                        {insights.nearestBus && (
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-zinc-800">{formatEta(insights.nearestBus.etaMins)}</p>
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                              <Clock3 className="w-4 h-4 text-blue-600" />
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* FLOATING ACTION BUTTONS */}
        <div className="absolute right-6 bottom-24 lg:bottom-10 z-30 flex flex-col gap-3">
          <Button 
            className="w-14 h-14 rounded-2xl bg-white shadow-2xl border hover:bg-zinc-50 transition-all active:scale-90 group"
            onClick={() => { if (userLocation) { setMapCenter(userLocation); setFocusKey(f => f + 1); } }}
          >
            <Crosshair className={`w-6 h-6 ${gpsStatus === 'ready' ? 'text-blue-600' : 'text-zinc-400'}`} />
          </Button>
          <Button 
            className="w-14 h-14 rounded-2xl bg-zinc-900 text-white shadow-2xl hover:bg-zinc-800 transition-all active:scale-90"
            onClick={() => setShowcaseOpen(true)}
          >
            <LayoutGrid className="w-6 h-6" />
          </Button>
        </div>

        {/* JOURNEY PANEL OVERLAY */}
        {selectedRouteMeta && selectedInsights && (
          <div className={`absolute z-50 transition-all duration-500 ${
            isMobile ? 'inset-x-0 bottom-0' : 'top-4 right-4 bottom-4 w-[430px]'
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
              onBack={() => { setSelectedRouteMeta(null); if (isMobile) setActiveTab('results'); }}
              onShare={async () => {
                if (navigator.share) await navigator.share({ title: `Bus ${selectedRouteMeta.route.id}`, text: `Tracking ${selectedRouteMeta.route.name}` });
              }}
              className={isMobile ? "rounded-t-[40px] shadow-2xl h-[85vh]" : "rounded-[32px] shadow-2xl h-full"}
              mobile={isMobile}
            />
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="lg:hidden h-[72px] bg-white/80 backdrop-blur-xl border-t flex items-center justify-around px-4 z-[60] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {[
          { id: 'search', icon: Search, label: 'Search' },
          { id: 'results', icon: ListFilter, label: 'Routes' },
          { id: 'map', icon: MapIcon, label: 'Explore' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === tab.id ? 'text-emerald-600 scale-110' : 'text-zinc-400 opacity-60'}`}
          >
            <div className={`p-2 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-emerald-50 text-emerald-600' : ''}`}>
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'stroke-[3px]' : 'stroke-[2px]'}`} />
            </div>
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
