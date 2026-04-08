"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import dynamic from "next/dynamic";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bus, Map as MapIcon, ArrowDownUp, Crosshair, Loader2, MapPinned, MapPin, WifiOff, Clock3, Search, ListFilter, Activity, Star } from 'lucide-react';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { GeocodingResult } from '@/lib/geocoding';
import { MatchingRoute, useRoutes } from '@/context/RouteContext';
import { DashboardHeader } from '@/components/DashboardHeader';
import { fetchRoadFollowingRoute } from '@/lib/routing';
import { RatingDialog } from '@/components/RatingDialog';
import { requestNotificationPermission, sendLocalNotification } from '@/lib/notifications';

import { useToast } from '@/hooks/use-toast';

interface BusData {
  id: string;
  driverId: string;
  driverName: string;
  routeId?: string;
  location: { lat: number; lng: number };
  updatedAt: string;
  status: string;
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
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

function getFreshnessText(updatedAt: string, now: number) {
  const ageSeconds = Math.max(0, Math.round((now - new Date(updatedAt).getTime()) / 1000));
  if (ageSeconds < 5) return 'updated just now';
  if (ageSeconds < 60) return `updated ${ageSeconds}s ago`;
  const ageMinutes = Math.round(ageSeconds / 60);
  return `updated ${ageMinutes}m ago`;
}

export default function UserDashboard() {
  const { user: profile, signOut } = useAuth();
  const { routes, findMatchingRoutes, loading: routesLoading } = useRoutes();
  const { toast } = useToast();
  const [buses, setBuses] = useState<BusData[]>([]);
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

  useEffect(() => {
    if (selectedRouteMeta) {
      fetchRoadFollowingRoute(selectedRouteMeta.route.stops).then(setSelectedRoutePath);
    } else {
      setSelectedRoutePath([]);
    }
  }, [selectedRouteMeta]);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('locating');
  const [focusKey, setFocusKey] = useState(0);
  const [hasAutoCentered, setHasAutoCentered] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'results' | 'map'>('search');

  const freshBuses = useMemo(
    () => buses.filter((bus) => now !== null && (now - new Date(bus.updatedAt).getTime()) <= STALE_BUS_MS),
    [buses, now]
  );

  useEffect(() => {
    if (!isWatching || !selectedRouteMeta || freshBuses.length === 0) return;

    const boardingStop = selectedRouteMeta.sourceStop;
    const routeStops = selectedRouteMeta.route.stops;
    const boardingIdx = routeStops.findIndex(s => s.name === boardingStop.name);
    
    if (boardingIdx === -1) return;

    freshBuses.forEach(bus => {
      if (bus.routeId !== selectedRouteMeta.route.id) return;

      // Find nearest stop to bus
      let nearestStopIdx = -1;
      let minDistance = Infinity;

      routeStops.forEach((stop, idx) => {
        const dist = getDistanceFromLatLonInKm(bus.location.lat, bus.location.lng, stop.lat, stop.lng);
        if (dist < minDistance) {
          minDistance = dist;
          nearestStopIdx = idx;
        }
      });

      // If bus is within 2 stops and moving towards boarding stop
      if (nearestStopIdx !== -1 && nearestStopIdx < boardingIdx && (boardingIdx - nearestStopIdx) <= 2) {
        if (!notifiedBuses.current.has(bus.id)) {
          sendLocalNotification(
            "Bus Arriving Soon!",
            `Bus ${bus.routeId} is ${boardingIdx - nearestStopIdx} stop(s) away from ${boardingStop.name}.`
          );
          notifiedBuses.current.add(bus.id);
        }
      }
    });
  }, [freshBuses, isWatching, selectedRouteMeta]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'buses'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const busList: BusData[] = [];
      snapshot.forEach((doc) => {
        busList.push({ id: doc.id, ...doc.data() } as BusData);
      });
      setBuses(busList);
      setBusesLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const tryIPFallback = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const loc = { lat: data.latitude, lng: data.longitude };
        setUserLocation(loc);
        setMapCenter(loc);
        setHasAutoCentered(true);
        setFocusKey((current) => current + 1);
        setGpsStatus('ready');
      } else {
        setGpsStatus('error');
      }
    } catch (err) {
      setGpsStatus('error');
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      tryIPFallback();
      return;
    }

    locateUser(); // Do an immediate initial fetch

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        setGpsStatus('ready');
        setIsLocating(false);

        setHasAutoCentered((prev) => {
          if (!prev) {
            setMapCenter(loc);
            setFocusKey((current) => current + 1);
            return true;
          }
          return prev;
        });
      },
      (error) => {
        console.warn("Geolocation watch update missed:", error.message);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('denied');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          // Hardware/OS blocked. Try standard accuracy for background too.
          // Don't overwrite error if IP fallback succeeded.
        }
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const locateUser = (isRetry = false) => {
    if (userLocation && !isRetry) {
      setMapCenter({ lat: userLocation.lat, lng: userLocation.lng });
      setFocusKey((current) => current + 1);
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      tryIPFallback();
      return;
    }

    setIsLocating(true);
    setGpsStatus('locating');

    const options = { 
      enableHighAccuracy: false, 
      timeout: 10000, 
      maximumAge: 0 
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        setMapCenter(loc);
        setHasAutoCentered(true);
        setFocusKey((current) => current + 1);
        setIsLocating(false);
        setGpsStatus('ready');
      },
      (error) => {
        console.warn("Geolocation manual fetch failed:", error.message);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setIsLocating(false);
        } else {
          tryIPFallback(); // Fallback to IP geolocation
        }
      },
      options
    );
  };

  const handleSearch = () => {
    if (!source || !dest) return;
    const matches = findMatchingRoutes(source.lat, source.lng, dest.lat, dest.lng, 8);
    setMatchingRoutes(matches);
    setSelectedRouteMeta(null);
  };

  const handleSwap = () => {
    const temp = source;
    setSource(dest);
    setDest(temp);
  };

  const handleRouteSelect = (routeMeta: MatchingRoute) => {
    setSelectedRouteMeta(routeMeta);
  };

  const getRouteInsights = (routeMeta: MatchingRoute) => {
    const routeBuses = freshBuses.filter((bus) => bus.routeId === routeMeta.route.id);
    const boardingReference = userLocation || source;
    const boardingDistanceKm = boardingReference
      ? getDistanceFromLatLonInKm(
          boardingReference.lat,
          boardingReference.lng,
          routeMeta.sourceStop.lat,
          routeMeta.sourceStop.lng
        )
      : 0;

    const nearestBus = routeBuses
      .map((bus) => ({
        bus,
        distanceKm: getDistanceFromLatLonInKm(
          bus.location.lat,
          bus.location.lng,
          routeMeta.sourceStop.lat,
          routeMeta.sourceStop.lng
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;

    return {
      routeBuses,
      boardingDistanceKm,
      nearestBus,
    };
  };

  const nearbyStops = useMemo(() => {
    if (!userLocation || !routes) return [];
    
    const allStops = routes.flatMap(r => r.stops.map(s => ({ ...s, routeId: r.id, routeName: r.name, color: r.color })));
    const uniqueStops = Array.from(new Map(allStops.map(s => [s.name, s])).values());
    
    return uniqueStops
      .map(stop => ({
        ...stop,
        distance: getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, stop.lat, stop.lng)
      }))
      .filter(stop => stop.distance < 2) // Within 2km
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
  }, [userLocation, routes]);

  const displayedBuses = selectedRouteMeta
    ? freshBuses.filter((bus) => bus.routeId === selectedRouteMeta.route.id)
    : freshBuses;

  const gpsMessage = {
    locating: 'Trying to locate you...',
    ready: userLocation ? 'Your live location is visible on the map.' : 'Location found.',
    denied: 'Location access denied. Please enable GPS in your browser.',
    unsupported: 'Geolocation is not supported in this browser.',
    error: 'Location unavailable. Please check your Windows Privacy settings.',
  }[gpsStatus];

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden relative">
      <DashboardHeader title="Passenger Dashboard" />
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Sidebar / Panels */}
        <div className={`w-full md:w-[430px] h-full bg-white z-40 md:border-r shadow-2xl flex-col relative flex-shrink-0 ${activeTab === 'map' ? 'hidden md:flex' : 'flex'}`}>
          
          {/* SEARCH TAB CONTENT */}
          <div className={`${activeTab === 'search' ? 'flex' : 'hidden md:flex'} flex-col h-full overflow-hidden`}>
            <div className="p-4 bg-zinc-900 text-white shadow-md z-10 relative">
              <div className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-4 flex items-center gap-2">
                <Activity className="w-3 h-3" />
                Plan Your Trip
              </div>
              
              <div className="flex bg-zinc-800 rounded-xl p-3 pt-4 pb-4 border border-zinc-700/50 shadow-inner">
                <div className="w-12 flex flex-col items-center justify-center gap-1 relative">
                  <div className="w-3 h-3 rounded-full border-2 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                  <div className="w-[1px] h-8 bg-zinc-600 border-dashed border-l border-zinc-500"></div>
                  <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
                </div>

                <div className="flex-1 flex flex-col gap-3 mr-2">
                  <LocationSearchInput
                    placeholder="Enter Source..."
                    onLocationSelect={setSource}
                  />
                  <hr className="border-t border-zinc-700" />
                  <LocationSearchInput
                    placeholder="Enter Destination..."
                    onLocationSelect={setDest}
                  />
                </div>

                <div className="w-10 flex items-center justify-center">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="hover:bg-zinc-700 hover:text-white rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 shadow-sm" 
                    onClick={handleSwap}
                  >
                    <ArrowDownUp className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm transition-all duration-300 flex items-center gap-3 ${
                gpsStatus === 'ready'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                  : gpsStatus === 'locating'
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-100 animate-pulse'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
              }`}>
                {gpsStatus === 'locating' ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <MapPinned className="w-4 h-4 flex-shrink-0" />}
                <span className="font-medium tracking-wide">{gpsMessage}</span>
              </div>

              <Button
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 font-bold text-md h-14 rounded-xl text-white shadow-lg active:scale-[0.98] transition-all"
                onClick={() => { handleSearch(); setActiveTab('results'); }}
                disabled={!source || !dest}
              >
                Find Live Buses
              </Button>
            </div>

            {/* NEARBY STOPS (Advanced Feature) */}
            {userLocation && nearbyStops.length > 0 && (
              <div className="p-4 bg-white border-b overflow-hidden flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Nearby Boarding Points</h3>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                  {nearbyStops.map((stop, idx) => (
                    <button
                      key={`${stop.routeId}-${idx}`}
                      className="flex-shrink-0 bg-zinc-50 border border-zinc-100 hover:border-emerald-200 hover:bg-emerald-50/30 p-2.5 rounded-xl transition-all text-left group min-w-[130px]"
                      onClick={() => {
                        setSource({ displayName: stop.name, lat: stop.lat, lng: stop.lng });
                        toast({ title: "Source set to " + stop.name, description: "Select destination to find routes." });
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tabular-nums">{formatDistance(stop.distance)}</span>
                      </div>
                      <p className="text-[11px] font-black text-zinc-800 truncate group-hover:text-emerald-700">{stop.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Desktop Quick Links or Empty State */}
            <div className="hidden md:flex flex-1 overflow-y-auto bg-zinc-50 p-6 flex-col items-center justify-center text-center">
              {!source && !dest ? (
                <div className="max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Bus className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-800 mb-2">Where to?</h3>
                  <p className="text-zinc-500 leading-relaxed">
                    Enter your source and destination to find the fastest bus routes and see live positions.
                  </p>
                </div>
              ) : (
                <div className="w-full text-left space-y-4">
                   <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Current Search</div>
                   <div className="bg-white rounded-2xl p-4 border shadow-sm">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                        <div>
                          <div className="text-xs text-zinc-400 font-medium">From</div>
                          <div className="font-bold text-zinc-800">{source?.displayName.split(',')[0] || '...'}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                        <div>
                          <div className="text-xs text-zinc-400 font-medium">To</div>
                          <div className="font-bold text-zinc-800">{dest?.displayName.split(',')[0] || '...'}</div>
                        </div>
                      </div>
                   </div>
                   <Button variant="outline" className="w-full rounded-xl h-12 border-zinc-200" onClick={() => { handleSearch(); setActiveTab('results'); }}>
                      View Available Routes
                   </Button>
                </div>
              )}
            </div>
          </div>

          {/* RESULTS TAB CONTENT */}
          <div className={`${activeTab === 'results' ? 'flex' : 'hidden md:hidden'} flex-col h-full overflow-hidden bg-zinc-50`}>
            <div className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveTab('search')}>
                  <ArrowDownUp className="w-4 h-4 rotate-90" />
                </Button>
                <h2 className="font-bold text-lg text-zinc-800">Available Routes</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black bg-zinc-100 text-zinc-500 px-2 py-1 rounded-md uppercase tracking-tighter border">
                  {matchingRoutes.length} Found
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(routesLoading || busesLoading) && (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
              )}

              {!routesLoading && !busesLoading && matchingRoutes.length === 0 && source && dest && (
                <div className="text-center p-10 bg-white border rounded-3xl shadow-sm">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <WifiOff className="w-8 h-8 text-zinc-400" />
                  </div>
                  <p className="font-bold text-zinc-800 text-lg">No direct buses</p>
                  <p className="mt-2 text-zinc-500 text-sm leading-relaxed">
                    We couldn't find a direct bus for this route. Try selecting different stops nearby.
                  </p>
                  <Button variant="outline" className="mt-6 rounded-xl" onClick={() => setActiveTab('search')}>
                    Adjust Search
                  </Button>
                </div>
              )}

              {!routesLoading && !busesLoading && (
                <div className="flex flex-col gap-4">
                  {matchingRoutes.map((meta) => {
                    const isActive = selectedRouteMeta?.route.id === meta.route.id;
                    const insights = getRouteInsights(meta);

                    return (
                      <Card
                        key={meta.route.id}
                        className={`p-5 cursor-pointer transition-all duration-300 border-2 rounded-2xl shadow-sm hover:shadow-md ${
                          isActive 
                            ? 'border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/10' 
                            : 'border-zinc-100 bg-white hover:border-zinc-300'
                        }`}
                        onClick={() => {
                          handleRouteSelect(meta);
                          if (window.innerWidth < 768) setActiveTab('map');
                        }}
                      >
                        <div className="flex justify-between items-start mb-4 gap-3">
                          <div className="flex gap-2 items-center flex-wrap">
                            <div
                              className="font-black px-3 py-1.5 rounded-xl text-xs border text-white shadow-sm tracking-wider"
                              style={{ backgroundColor: meta.route.color || '#3b82f6', borderColor: 'rgba(255,255,255,0.2)' }}
                            >
                              EXP-{meta.route.id}
                            </div>
                            <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 uppercase tracking-widest">
                              Live Now
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-zinc-900">{meta.estimatedDurationMins} min</div>
                            <div className="text-[10px] font-bold text-zinc-400 uppercase">Est. Trip</div>
                          </div>
                        </div>

                        <div className="flex items-center text-sm font-bold gap-3 text-zinc-800 my-4">
                          <div className="flex flex-col flex-1">
                            <span className="truncate">{meta.sourceStop.name}</span>
                            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-tighter mt-0.5">Boarding</span>
                          </div>
                          <div className="flex items-center justify-center px-2">
                            <div className="h-[2px] w-8 bg-zinc-200 rounded-full relative">
                               <div className="absolute right-0 -top-[3px] w-2 h-2 border-t-2 border-r-2 border-zinc-300 rotate-45" />
                            </div>
                          </div>
                          <div className="flex flex-col flex-1 text-right">
                            <span className="truncate">{meta.destStop.name}</span>
                            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-tighter mt-0.5">Destination</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-5">
                          <div className="rounded-xl bg-zinc-50 border p-3 flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                              <MapPinned className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-zinc-400 uppercase leading-none mb-1">Walk to bus</div>
                              <div className="font-black text-zinc-800 text-xs">
                                {formatDistance(insights.boardingDistanceKm)}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-xl bg-zinc-50 border p-3 flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                              <Clock3 className="w-3.5 h-3.5 text-zinc-500" />
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-zinc-400 uppercase leading-none mb-1">Next Bus</div>
                              <div className="font-black text-zinc-800 text-xs">
                                {insights.nearestBus ? formatDistance(insights.nearestBus.distanceKm) : 'Offline'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] text-zinc-400 font-bold uppercase mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 tracking-widest">
                          <span className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {insights.routeBuses.length} active buses
                          </span>
                          <span className="text-emerald-600">
                            {insights.nearestBus ? (now ? getFreshnessText(insights.nearestBus.bus.updatedAt, now) : 'Live Now') : 'No buses online'}
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MAP VIEW CONTENT */}
        <main className={`flex-1 relative overflow-hidden bg-muted/20 h-full ${activeTab === 'map' ? 'block' : 'hidden md:block'}`}>
          <div className="w-full h-full absolute inset-0 z-0">
            <DynamicMap
              buses={displayedBuses}
              center={mapCenter}
              route={selectedRouteMeta?.route || null}
              polylinePoints={selectedRoutePath}
              userLocation={userLocation}
              focusKey={focusKey}
            />
          </div>

          {/* Map Overlay Buttons */}
          <div className="absolute top-6 right-6 z-20 flex flex-col gap-3">
            <Button
              variant="secondary"
              size="icon"
              className={`shadow-2xl bg-white hover:bg-zinc-50 rounded-2xl w-14 h-14 border border-zinc-200 text-zinc-700 transition-all active:scale-95 ${isLocating ? 'ring-4 ring-emerald-500/20' : ''}`}
              onClick={() => locateUser()}
              title="Find My Location"
            >
              {isLocating ? <Loader2 className="w-6 h-6 animate-spin text-emerald-600" /> : <Crosshair className="w-6 h-6" />}
            </Button>
            
            <Button
              variant="secondary"
              size="icon"
              className="md:hidden shadow-2xl bg-zinc-900 rounded-2xl w-14 h-14 text-white hover:bg-zinc-800 transition-all active:scale-95"
              onClick={() => setActiveTab('results')}
              title="View Results"
            >
              <ListFilter className="w-6 h-6" />
            </Button>
          </div>

          {/* Desktop Status Overlay */}
          <div className="absolute top-6 left-6 z-20 hidden lg:block">
            <div className="rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border px-5 py-4 min-w-[260px] border-zinc-200/50">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${gpsStatus === 'ready' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-black">Live System Status</div>
              </div>
              <div className="text-sm font-black text-zinc-800 mb-1">{gpsMessage}</div>
              <div className="text-[11px] font-bold text-zinc-500 flex items-center gap-1.5">
                <Bus className="w-3 h-3" />
                Tracking {displayedBuses.length} fresh bus{displayedBuses.length === 1 ? '' : 'es'}
              </div>
            </div>
          </div>

          {/* Route Timeline Overlay */}
          {selectedRouteMeta && (
            <div className="hidden md:block absolute bottom-8 left-8 z-20 w-[380px] pointer-events-none animate-in slide-in-from-left-8 duration-500">
              <Card className="p-6 bg-zinc-900/95 backdrop-blur-xl text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-zinc-800/50 pointer-events-auto rounded-3xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h3 className="font-black text-xs opacity-50 uppercase tracking-[0.2em]">Route Journey</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                        isWatching 
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                          : 'bg-white/10 text-zinc-400 hover:bg-white/20'
                      }`}
                      onClick={async () => {
                        if (!isWatching) {
                          const granted = await requestNotificationPermission();
                          if (granted) {
                            setIsWatching(true);
                            toast({ title: "Alerts Enabled", description: "We'll notify you when the bus is 2 stops away." });
                          } else {
                            toast({ title: "Permission Denied", description: "Enable notifications in your browser settings.", variant: "destructive" });
                          }
                        } else {
                          setIsWatching(false);
                          notifiedBuses.current.clear();
                        }
                      }}
                    >
                      <Activity className={`w-3 h-3 ${isWatching ? 'animate-pulse' : ''}`} />
                      {isWatching ? 'Watching' : 'Watch Route'}
                    </Button>
                  </div>
                  <div className="px-2 py-1 bg-white/10 rounded-lg text-[10px] font-bold">EXP-{selectedRouteMeta.route.id}</div>
                </div>
                
                <div className="flex flex-col gap-0 relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-zinc-700 via-zinc-600 to-zinc-700"></div>

                  <div className="flex items-start gap-5 pb-6">
                    <div className="w-4 h-4 bg-zinc-600 rounded-full z-10 flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(0,0,0,0.5)] border-2 border-zinc-900"></div>
                    <div>
                      <p className="text-sm font-black tracking-tight">Walk to {selectedRouteMeta.sourceStop.name}</p>
                      <p className="text-[11px] font-bold text-zinc-400 mt-0.5 uppercase tracking-wide">
                        Distance: {formatDistance(getRouteInsights(selectedRouteMeta).boardingDistanceKm)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-5 py-2 pb-8">
                    <div className="w-4 h-4 rounded-full z-10 flex-shrink-0 mt-1 ring-4 ring-zinc-900 shadow-lg" style={{ backgroundColor: selectedRouteMeta.route.color || '#3b82f6' }}></div>
                    <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <div
                          className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black text-white uppercase tracking-wider"
                          style={{ backgroundColor: selectedRouteMeta.route.color || '#3b82f6' }}
                        >
                          Board Bus
                        </div>
                        {getRouteInsights(selectedRouteMeta).nearestBus && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] font-black text-zinc-400 hover:text-white uppercase tracking-wider"
                            onClick={() => {
                              const bus = getRouteInsights(selectedRouteMeta).nearestBus?.bus;
                              if (bus) setRatingTarget({ id: bus.driverId, name: bus.driverName });
                            }}
                          >
                            <Star className="w-3 h-3 mr-1 fill-amber-400 text-amber-400" />
                            Rate Driver
                          </Button>
                        )}
                      </div>
                      <p className="text-sm font-black tracking-tight leading-tight">Ride {selectedRouteMeta.stopsToTravel} stops</p>
                      <p className="text-[11px] font-bold text-emerald-400 mt-1 uppercase tracking-wide">{selectedRouteMeta.estimatedDurationMins} mins travel time</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-5 pt-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full z-10 flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(239,68,68,0.3)] border-2 border-zinc-900"></div>
                    <div>
                      <p className="text-sm font-black tracking-tight">Arrival at {selectedRouteMeta.destStop.name}</p>
                      <p className="text-[11px] font-bold text-zinc-400 mt-0.5 uppercase tracking-wide">End of Trip</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      <RatingDialog
        isOpen={!!ratingTarget}
        onClose={() => setRatingTarget(null)}
        driverId={ratingTarget?.id || ''}
        driverName={ratingTarget?.name || ''}
        passengerId={profile?.uid || ''}
      />
      
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden h-[76px] flex-shrink-0 flex items-center justify-around bg-white border-t px-4 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <button 
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center justify-center px-4 h-full transition-all duration-300 ${activeTab === 'search' ? 'text-emerald-600 scale-110' : 'text-zinc-400'}`}
        >
          <div className={`p-2 rounded-2xl mb-1 transition-all ${activeTab === 'search' ? 'bg-emerald-50 shadow-sm' : ''}`}>
             <Search className={`w-5 h-5 ${activeTab === 'search' ? 'stroke-[3px]' : 'stroke-[2px]'}`} />
          </div>
          <span className="text-[9px] font-black tracking-widest uppercase">Search</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('results')}
          className={`flex flex-col items-center justify-center px-4 h-full transition-all duration-300 ${activeTab === 'results' ? 'text-emerald-600 scale-110' : 'text-zinc-400'}`}
        >
          <div className={`p-2 rounded-2xl mb-1 transition-all ${activeTab === 'results' ? 'bg-emerald-50 shadow-sm' : ''}`}>
             <ListFilter className={`w-5 h-5 ${activeTab === 'results' ? 'stroke-[3px]' : 'stroke-[2px]'}`} />
          </div>
          <span className="text-[9px] font-black tracking-widest uppercase">Routes</span>
        </button>

        <button 
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center justify-center px-4 h-full transition-all duration-300 ${activeTab === 'map' ? 'text-emerald-600 scale-110' : 'text-zinc-400'}`}
        >
          <div className={`p-2 rounded-2xl mb-1 transition-all ${activeTab === 'map' ? 'bg-emerald-50 shadow-sm' : ''}`}>
             <MapIcon className={`w-5 h-5 ${activeTab === 'map' ? 'stroke-[3px]' : 'stroke-[2px]'}`} />
          </div>
          <span className="text-[9px] font-black tracking-widest uppercase">Map</span>
        </button>
      </div>
    </div>
  );
}
