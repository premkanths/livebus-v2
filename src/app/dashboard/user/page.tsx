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
  Clock3, 
  Search, 
  ListFilter, 
  ChevronLeft, 
  ArrowRight, 
  LayoutGrid, 
  Activity,
  ShieldCheck,
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
  }, [activeTab, isResultsPanelOpen, selectedRouteMeta, isRightSidebarCollapsed]);

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

      <main className="flex-1 flex overflow-hidden relative">
        {/* BACKGROUND MAP - Now filling the flexible center space */}
        <div className="flex-1 relative z-0">
          <DynamicMap
            buses={displayedBuses}
            center={mapCenter}
            route={selectedRouteMeta?.route || null}
            polylinePoints={selectedRoutePath}
            userLocation={userLocation}
            focusKey={focusKey}
          />
          
          {/* FLOATING STATUS CARD (TOP LEFT) */}
          <div className="absolute top-4 left-4 z-10 hidden md:block">
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
            </Card>
          </div>
        </div>

        {/* LEFT SEARCH PANEL - Using a sidebar-like behavior for better map sizing */}
        <div className={`transition-all duration-500 overflow-hidden bg-white border-r z-20 flex flex-col ${isMobile ? 'hidden' : (source || dest ? 'w-[420px]' : 'w-[420px]')}`}>
           <div className="p-6 space-y-6">
              <div className="flex items-center gap-2">
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

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
                onClick={handleSearch}
                disabled={!source || !dest}
              >
                Find Live Buses
              </Button>
           </div>
           
           {/* Results list inside the left panel */}
           <div className="flex-1 overflow-y-auto border-t bg-zinc-50/50 p-4 space-y-4 no-scrollbar">
              {(routesLoading || busesLoading) ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-3xl" />)}
                </div>
              ) : matchingRoutes.length === 0 ? (
                <div className="text-center py-10">
                  <WifiOff className="w-10 h-10 text-zinc-300 mx-auto mb-4" />
                  <p className="text-sm font-bold text-zinc-400">Search to see routes</p>
                </div>
              ) : (
                matchingRoutes.map(meta => {
                  const insights = getRouteInsights(meta);
                  const active = selectedRouteMeta?.route.id === meta.route.id;
                  return (
                    <Card 
                      key={meta.route.id} 
                      className={`p-5 cursor-pointer rounded-3xl border-2 transition-all hover:shadow-xl group ${active ? 'border-emerald-500 bg-white ring-4 ring-emerald-500/10' : 'border-zinc-100 hover:border-zinc-200 bg-white'}`}
                      onClick={() => handleRouteSelect(meta)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="px-3 py-1.5 rounded-xl text-[10px] font-black text-white shadow-sm tracking-widest uppercase" style={{ backgroundColor: meta.route.color }}>
                          Route {meta.route.id}
                        </div>
                        <span className="text-lg font-black text-zinc-900">{meta.estimatedDurationMins}m</span>
                      </div>
                      <div className="flex items-center gap-3 py-2 text-xs font-bold text-zinc-600">
                        <span className="truncate">{meta.sourceStop.name}</span>
                        <ArrowRight className="w-3 h-3 shrink-0" />
                        <span className="truncate">{meta.destStop.name}</span>
                      </div>
                    </Card>
                  );
                })
              )}
           </div>
        </div>

        {/* RIGHT SIDEBAR - As seen in the screenshot */}
        <div className={`transition-all duration-500 bg-white border-l z-20 flex flex-col ${isMobile ? 'hidden' : (isRightSidebarCollapsed ? 'w-0' : 'w-[320px]')}`}>
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
            onClick={() => { if (userLocation) { setMapCenter(userLocation); setFocusKey(f => f + 1); } }}
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
              onBack={() => { setSelectedRouteMeta(null); }}
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
