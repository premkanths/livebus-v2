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
import { Bus, Map as MapIcon, ArrowDownUp, Crosshair, Loader2, MapPinned, MapPin, WifiOff, Clock3, Search, ListFilter, Activity, ChevronLeft, ChevronRight, GripVertical, Shield } from 'lucide-react';
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
import { ArrowRight, LayoutGrid } from 'lucide-react';

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
  const scheduledDelta =
    (routeMeta.sourceStop.timeFromStart || 0) - (nearestStop.timeFromStart || 0);
  const directDistanceToBoarding = getDistanceFromLatLonInKm(
    bus.location.lat,
    bus.location.lng,
    routeMeta.sourceStop.lat,
    routeMeta.sourceStop.lng
  );

  if (scheduledDelta >= 0) {
    return Math.max(1, Math.round(scheduledDelta + nearestStopDistance * 3));
  }

  return Math.max(1, Math.round(directDistanceToBoarding * 3));
}

function UserDashboardContent() {
  const { user, profile } = useAuth();
  const { routes, findMatchingRoutes, findLenientMatchingRoutes, loading: routesLoading } = useRoutes();
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
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  
  // Layout Overhaul States
  const [sidebarWidth, setSidebarWidth] = useState(1000);
  const [searchPanelWidth, setSearchPanelWidth] = useState(400);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [journeyPanelWidth, setJourneyPanelWidth] = useState(430);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingInner, setIsResizingInner] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingJourney, setIsResizingJourney] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX;
        // Allow up to 2/3 of viewport
        const maxWidth = window.innerWidth * 0.66;
        if (newWidth > 320 && newWidth < maxWidth) {
          setSidebarWidth(newWidth);
        }
      } else if (isResizingInner) {
        const newWidth = e.clientX;
        if (newWidth > 200 && newWidth < sidebarWidth - 100) {
          setSearchPanelWidth(newWidth);
        }
      } else if (isResizingRight) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 200 && newWidth < 600) {
          setRightSidebarWidth(newWidth);
        }
      } else if (isResizingJourney) {
        const newWidth = window.innerWidth - e.clientX - 24; // Account for right margin
        if (newWidth > 320 && newWidth < 700) {
          setJourneyPanelWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsResizingInner(false);
      setIsResizingRight(false);
      setIsResizingJourney(false);
      document.body.style.cursor = 'default';
    };

    if (isResizing || isResizingInner || isResizingRight || isResizingJourney) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isResizingInner, isResizingRight, isResizingJourney, sidebarWidth]);

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
            `${bus.vehicleNumber || `Bus ${bus.routeId}`} is ${boardingIdx - nearestStopIdx} stop(s) away from ${boardingStop.name}.`
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
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const busList: BusData[] = [];
        snapshot.forEach((doc) => {
          busList.push({ id: doc.id, ...doc.data() } as BusData);
        });
        setBuses(busList);
        setBusesLoading(false);
      },
      (error) => {
        console.warn('Firestore buses listener failed:', error.message);
        setBusesLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Initial search for Presidency University
  useEffect(() => {
    if (routes.length > 0 && !source && !dest) {
      const presidencyCoords = { lat: 13.1704, lng: 77.5662 };
      setDest({ displayName: "Presidency University", ...presidencyCoords });
      const matches = findLenientMatchingRoutes(null, null, presidencyCoords.lat, presidencyCoords.lng, 8);
      setMatchingRoutes(matches);
    }
  }, [routes.length]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'demoBuses'), 
      (snapshot) => {
        const configs = snapshot.docs.map((demoDoc) => ({
          id: demoDoc.id,
          ...demoDoc.data(),
        })) as DemoBusConfig[];

        setDemoBusConfigs(configs);
      },
      (error) => {
        console.warn('Firestore demoBuses listener failed:', error.message);
      }
    );

    return () => unsubscribe();
  }, []);

  // Handle deep-linking to a specific bus from All Buses page
  const searchParams = useSearchParams();
  const busIdParam = searchParams.get('bus');

  useEffect(() => {
    if (busIdParam && freshBuses.length > 0) {
      const targetBus = freshBuses.find(b => b.id === busIdParam);
      if (targetBus) {
        setMapCenter(targetBus.location);
        setFocusKey(prev => prev + 1);
        setIsSidebarCollapsed(true); // Maximize map view
        
        // Find if this bus belongs to a route and select it
        if (targetBus.routeId) {
          const matchingRoute = routes.find(r => r.id === targetBus.routeId);
          if (matchingRoute) {
             const meta = findLenientMatchingRoutes(null, null, matchingRoute.stops[0].lat, matchingRoute.stops[0].lng, 1)
               .find(m => m.route.id === targetBus.routeId);
             if (meta) setSelectedRouteMeta(meta);
          }
        }
      }
    }
  }, [busIdParam, freshBuses.length]);

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
    if (!source && !dest) return;
    const matches = findLenientMatchingRoutes(
      source ? source.lat : null, 
      source ? source.lng : null, 
      dest ? dest.lat : null, 
      dest ? dest.lng : null, 
      8
    );
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
        etaMins: estimateArrivalMins(routeMeta, bus),
      }))
      .sort((a, b) => {
        if (a.etaMins !== null && b.etaMins !== null) return a.etaMins - b.etaMins;
        return a.distanceKm - b.distanceKm;
      })[0] || null;

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

  const selectedTravelStops = useMemo(() => {
    if (!selectedRouteMeta) return [];

    const stops = selectedRouteMeta.route.stops;
    const sourceIdx = stops.findIndex((stop) => stop.name === selectedRouteMeta.sourceStop.name);
    const destIdx = stops.findIndex((stop) => stop.name === selectedRouteMeta.destStop.name);

    if (sourceIdx === -1 || destIdx === -1 || sourceIdx > destIdx) return [];
    return stops.slice(sourceIdx, destIdx + 1);
  }, [selectedRouteMeta]);

  const selectedInsights = selectedRouteMeta ? getRouteInsights(selectedRouteMeta) : null;
  const nearestBusFreshness =
    selectedInsights?.nearestBus && now
      ? getFreshnessText(selectedInsights.nearestBus.bus.updatedAt, now)
      : 'Live bus data unavailable';

  const toggleWatching = async () => {
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
  };

  const handleShareRoute = async () => {
    if (!selectedRouteMeta || typeof navigator === 'undefined' || !navigator.share) return;

    try {
      await navigator.share({
        title: `College Bus - ${selectedRouteMeta.route.name}`,
        text: `Track ${selectedRouteMeta.sourceStop.name} to ${selectedRouteMeta.destStop.name} on route ${selectedRouteMeta.route.id}.`,
      });
    } catch {
      // Ignore cancellations from the native share sheet.
    }
  };

  const gpsMessage = {
    locating: 'Trying to locate you...',
    ready: userLocation ? 'Your live location is visible on the map.' : 'Location found.',
    denied: 'Location access denied. Please enable GPS in your browser.',
    unsupported: 'Geolocation is not supported in this browser.',
    error: 'Location unavailable. Please check your Windows Privacy settings.',
  }[gpsStatus];

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden relative leading-relaxed font-outfit">
      <DashboardHeader title="Passenger Dashboard" />
      <ShowcaseDrawer open={showcaseOpen} onOpenChange={setShowcaseOpen} />
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* Fixed Toggle Button for Re-opening */}
        {isSidebarCollapsed && (
          <button 
            onClick={() => setIsSidebarCollapsed(false)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[60] w-8 h-16 bg-white border border-zinc-200 rounded-r-2xl flex items-center justify-center shadow-2xl hover:bg-zinc-50 transition-all group active:scale-95"
            title="Expand Panel"
          >
            <ChevronRight className="w-5 h-5 text-blue-600 transition-transform group-hover:scale-110" />
          </button>
        )}

        {/* Sidebar / Panels */}
        <div 
          ref={sidebarRef}
          style={{ width: isSidebarCollapsed ? '0px' : `${sidebarWidth}px` }}
          className={`h-full bg-white z-40 relative flex-shrink-0 transition-all duration-300 ease-in-out border-r shadow-2xl flex flex-col ${isSidebarCollapsed ? 'overflow-hidden border-none shadow-none' : ''} ${activeTab === 'map' ? 'hidden md:flex' : 'flex'}`}
        >
          {/* Collapse Toggle Button (Inside edge when expanded) */}
          {!isSidebarCollapsed && (
            <button 
              onClick={() => setIsSidebarCollapsed(true)}
              className="absolute -right-4 top-1/2 -translate-y-1/2 z-[60] w-8 h-16 bg-white border border-zinc-200 rounded-full flex items-center justify-center shadow-lg hover:bg-zinc-50 transition-all group active:scale-95"
              title="Collapse Panel"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-400 transition-transform group-hover:scale-110" />
            </button>
          )}

          {/* Horizontal Split Layout for Panels */}
          <div className={`flex-1 flex h-full ${sidebarWidth > 700 ? 'flex-row' : 'flex-col'}`}>
            
            {/* LEFT / TOP HALF: SEARCH */}
            <div 
              style={{ width: (sidebarWidth > 700 && !isSidebarCollapsed) ? `${searchPanelWidth}px` : 'auto' }}
              className={`flex flex-col h-full overflow-hidden flex-shrink-0 ${sidebarWidth > 700 ? 'border-r' : 'h-auto'}`}
            >
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
                <div className="w-full space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="mx-auto max-w-xs text-center">
                    <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <Bus className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-800 mb-2">Where to?</h3>
                    <p className="text-zinc-500 leading-relaxed">
                      Enter your source and destination to find the fastest bus routes and see live positions.
                    </p>
                  </div>
                  <div className="w-full rounded-[28px] border border-zinc-200 bg-white p-5 text-left shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-black text-zinc-900">Project Demo Screens</h4>
                        <p className="mt-1 text-xs text-zinc-500">Open these during presentation to show future-ready features.</p>
                      </div>
                      <Link href="/dashboard/user/smart-pass" className="text-xs font-black text-blue-600">
                        Open first
                      </Link>
                    </div>
                  </div>
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

            {/* Middle Resize Handle */}
            {sidebarWidth > 700 && !isSidebarCollapsed && (
              <div
                onMouseDown={() => setIsResizingInner(true)}
                className="w-1.5 h-full z-40 cursor-col-resize hover:bg-blue-600/30 transition-colors flex items-center justify-center group flex-shrink-0"
              >
                <div className="w-[1px] h-10 bg-zinc-200 group-hover:bg-blue-600/50" />
              </div>
            )}

            {/* RIGHT / BOTTOM HALF: RESULTS */}
            <div className="flex flex-col h-full overflow-hidden bg-zinc-50 flex-1">
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
                              <div className="text-[10px] font-bold text-zinc-400 uppercase leading-none mb-1">Next Bus ETA</div>
                              <div className="font-black text-zinc-800 text-xs">
                                {insights.nearestBus ? formatEta(insights.nearestBus.etaMins) : 'Offline'}
                              </div>
                              {insights.nearestBus && (
                                <div className="text-[10px] font-bold text-zinc-400 mt-0.5">
                                  {formatDistance(insights.nearestBus.distanceKm)} away
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] text-zinc-400 font-bold uppercase mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 tracking-widest">
                          <span className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {insights.routeBuses.length} active buses
                          </span>
                          <span className="text-emerald-600">
                            {insights.nearestBus
                              ? `${insights.nearestBus.bus.vehicleNumber || insights.nearestBus.bus.driverName} | ${now ? getFreshnessText(insights.nearestBus.bus.updatedAt, now) : 'Live Now'}`
                              : 'No buses online'}
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
        </div>

        {/* RESIZE HANDLE (LEFT SIDEBAR) */}
        {!isSidebarCollapsed && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className="w-1.5 h-full z-50 cursor-col-resize hover:bg-blue-600/30 transition-colors flex items-center justify-center group"
          >
            <div className="w-[1px] h-10 bg-zinc-200 group-hover:bg-blue-600/50" />
          </div>
        )}

        {/* MAP VIEW CONTENT */}
        <main className="flex-1 relative overflow-hidden bg-muted/20 h-full">
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
          {selectedRouteMeta && selectedInsights && (
            <div 
              style={{ width: `${journeyPanelWidth}px` }}
              className="pointer-events-none absolute inset-y-6 right-6 z-20 hidden animate-in slide-in-from-right-8 duration-500 md:block"
            >
              {/* Resizer Handle for Journey Panel */}
              <div
                onMouseDown={() => setIsResizingJourney(true)}
                className="pointer-events-auto absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-24 z-50 cursor-col-resize flex items-center justify-center group"
              >
                <div className="w-1.5 h-16 bg-white/80 backdrop-blur shadow-md rounded-full border border-zinc-200 group-hover:bg-blue-600 transition-colors flex items-center justify-center">
                  <div className="w-[1px] h-6 bg-zinc-300 group-hover:bg-blue-200" />
                </div>
              </div>

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
                onBack={() => setActiveTab('results')}
                onShare={handleShareRoute}
                className="pointer-events-auto h-full rounded-[32px]"
              />
            </div>
          )}

          {selectedRouteMeta && selectedInsights && (
            <div className="absolute inset-x-0 bottom-0 z-20 animate-in slide-in-from-bottom-5 duration-300 md:hidden">
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
                onBack={() => setActiveTab('results')}
                onShare={handleShareRoute}
                className="rounded-t-[32px] border-x-0 border-b-0"
                mobile
              />
            </div>
          )}
        </main>

        {/* RESIZE HANDLE (RIGHT SIDEBAR) */}
        {!isRightSidebarCollapsed && (
          <div
            onMouseDown={() => setIsResizingRight(true)}
            className="w-1.5 h-full z-50 cursor-col-resize hover:bg-blue-600/30 transition-colors flex items-center justify-center group"
          >
            <div className="w-[1px] h-10 bg-zinc-200 group-hover:bg-blue-600/50" />
          </div>
        )}

        {/* RIGHT SIDEBAR: FEATURES (LITTLE LOWER) */}
        <div 
          style={{ width: isRightSidebarCollapsed ? '0px' : `${rightSidebarWidth}px` }}
          className={`h-full bg-zinc-50 z-40 relative flex-shrink-0 transition-all duration-300 ease-in-out border-l shadow-2xl flex flex-col ${isRightSidebarCollapsed ? 'overflow-hidden border-none shadow-none' : ''}`}
        >
          {/* Collapse Button (Right Sidebar) */}
          {!isRightSidebarCollapsed && (
             <button 
               onClick={() => setIsRightSidebarCollapsed(true)}
               className="absolute -left-4 top-1/2 -translate-y-1/2 z-[60] w-8 h-16 bg-white border border-zinc-200 rounded-full flex items-center justify-center shadow-lg hover:bg-zinc-50 transition-all group active:scale-95"
               title="Collapse Features"
             >
               <ChevronRight className="w-5 h-5 text-zinc-400 transition-transform group-hover:scale-110" />
             </button>
          )}

          {/* Feature Content (Positioned Lower) */}
          <div className="flex-1 overflow-y-auto pt-20">
            <div className="px-4 pb-8 space-y-6">
              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-zinc-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-50 rounded-2xl">
                    <Activity className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quick Tools</h3>
                    <p className="text-lg font-black text-zinc-900 leading-tight">Advanced Features</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link href="/dashboard/user/smart-pass" className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Shield className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-zinc-900 truncate tracking-tight">Smart Pass</h4>
                      <p className="text-[10px] text-zinc-500 font-medium tracking-tight">Biometric bus authentication</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300" />
                  </Link>

                  <Link href="#" className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <LayoutGrid className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-zinc-900 truncate tracking-tight">Campus Map</h4>
                      <p className="text-[10px] text-zinc-500 font-medium tracking-tight">Detailed University navigation</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300" />
                  </Link>
                </div>
              </div>

              <div className="relative rounded-[32px] overflow-hidden bg-zinc-900 p-6 text-white shadow-xl">
                 <div className="relative z-10">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-2">Showcase</h4>
                    <p className="text-lg font-bold leading-tight mb-4">Explore our thesis project capabilities.</p>
                    <Button 
                      variant="outline" 
                      className="w-full rounded-xl bg-white/10 border-white/20 hover:bg-white/20 text-white font-bold border-none h-12"
                      onClick={() => setShowcaseOpen(true)}
                    >
                      Open Full Showcase
                    </Button>
                 </div>
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-[80px] -mr-16 -mt-16" />
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Toggle Button for Right Sidebar */}
        {isRightSidebarCollapsed && (
          <button 
            onClick={() => setIsRightSidebarCollapsed(false)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] w-8 h-16 bg-white border border-zinc-200 rounded-l-2xl flex items-center justify-center shadow-2xl hover:bg-zinc-50 transition-all group active:scale-95"
            title="Expand Features"
          >
            <ChevronLeft className="w-5 h-5 text-blue-600 transition-transform group-hover:scale-110" />
          </button>
        )}
      </div>

      <RatingDialog
        isOpen={!!ratingTarget}
        onClose={() => setRatingTarget(null)}
        driverId={ratingTarget?.id || ''}
        driverName={ratingTarget?.name || ''}
        passengerId={user?.uid || ''}
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

export default function UserDashboard() {
  return (
    <RequireRole allowedRoles={['user']}>
      <UserDashboardContent />
    </RequireRole>
  );
}
