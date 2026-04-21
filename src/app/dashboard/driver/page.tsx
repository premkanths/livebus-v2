"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, addDoc, collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bus, 
  MapPin, 
  Play, 
  Square, 
  Clock, 
  Wifi, 
  AlertCircle, 
  Star, 
  Gauge, 
  Zap, 
  AlertTriangle, 
  CheckCircle2,
  Navigation,
  Send,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRoutes } from '@/context/RouteContext';
import dynamic from "next/dynamic";
import { DashboardHeader } from '@/components/DashboardHeader';
import { RequireRole } from '@/components/RequireRole';
import { Badge } from '@/components/ui/badge';

const DynamicMap = dynamic(() => import("@/components/Map"), { ssr: false });
type GpsStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unsupported' | 'error';

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeRouteId(routeId?: string) {
  return (routeId || '').trim().toUpperCase();
}

function DriverDashboardContent() {
  const { profile } = useAuth();
  const { routes } = useRoutes();
  const { toast } = useToast();
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [prevLocation, setPrevLocation] = useState<{ lat: number; lng: number; time: number } | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [isSendingAlert, setIsSendingAlert] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTrackingRef = useRef(false);
  const assignedRouteId = normalizeRouteId(profile?.assignedRouteId);
  const vehicleNumber = profile?.vehicleNumber || '';

  // Calculate Average Rating
  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'ratings'), where('driverId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setAvgRating(null);
        return;
      }
      let total = 0;
      snapshot.forEach(doc => total += doc.data().rating);
      setAvgRating(total / snapshot.size);
    }, (error) => console.warn('Ratings listener failed:', error.message));
    return () => unsubscribe();
  }, [profile?.uid]);

  const selectedRouteRef = useRef<string>('');
  const selectedRoute = routes.find((route) => normalizeRouteId(route.id) === normalizeRouteId(selectedRouteId)) || null;
  const assignedRoutes = assignedRouteId ? routes.filter((route) => normalizeRouteId(route.id) === assignedRouteId) : [];

  useEffect(() => { setSelectedRouteId(assignedRouteId); }, [assignedRouteId]);
  useEffect(() => { selectedRouteRef.current = selectedRouteId; }, [selectedRouteId]);
  useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);

  const nextStop = useMemo(() => {
    if (!selectedRoute || !location) return null;
    const routeStops = selectedRoute.stops;
    let nearestIdx = -1;
    let minDist = Infinity;

    routeStops.forEach((stop, idx) => {
      const d = getDistanceFromLatLonInKm(location.lat, location.lng, stop.lat, stop.lng);
      if (d < minDist) {
        minDist = d;
        nearestIdx = idx;
      }
    });

    if (nearestIdx !== -1 && nearestIdx < routeStops.length - 1) {
      return routeStops[nearestIdx + 1];
    }
    return null;
  }, [selectedRoute, location]);

  const markBusInactive = useCallback(async () => {
    if (!profile?.uid) return;
    try {
      const busRef = doc(db, 'buses', profile.uid);
      await setDoc(busRef, { status: 'inactive', updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) { console.error("Error marking bus inactive:", error); }
  }, [profile?.uid]);

  const updateLocation = async () => {
    if (!profile) return;
    const currentRoute = selectedRouteRef.current;
    if (!currentRoute) return;

    if ("geolocation" in navigator) {
      setGpsStatus('locating');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const currentLoc = { lat: latitude, lng: longitude };
          const currentTime = Date.now();

          // Speed Calculation
          if (prevLocation) {
            const dist = getDistanceFromLatLonInKm(prevLocation.lat, prevLocation.lng, latitude, longitude);
            const timeHrs = (currentTime - prevLocation.time) / (1000 * 3600);
            if (timeHrs > 0) {
              const currentSpeed = Math.min(Math.round(dist / timeHrs), 80); // Cap at 80kmh for realism
              setSpeed(currentSpeed);
            }
          }

          setLocation(currentLoc);
          setPrevLocation({ ...currentLoc, time: currentTime });
          setGpsStatus('ready');

          try {
            const busRef = doc(db, 'buses', profile.uid);
            await setDoc(busRef, {
              driverId: profile.uid,
              driverName: profile.displayName || profile.email || 'Unnamed Driver',
              vehicleNumber: vehicleNumber || 'Unassigned',
              routeId: currentRoute,
              location: currentLoc,
              speed: prevLocation ? Math.min(Math.round(getDistanceFromLatLonInKm(prevLocation.lat, prevLocation.lng, latitude, longitude) / ((currentTime - prevLocation.time) / (1000 * 3600))), 80) : 0,
              updatedAt: new Date().toISOString(),
              status: 'active'
            }, { merge: true });
            
            setLastUpdate(new Date());
          } catch (error) { console.error("Error updating location:", error); }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setGpsStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
          toast({ title: "GPS Error", description: "GPS failed. Check permissions.", variant: "destructive" });
          stopTracking({ showToast: false });
        },
        { enableHighAccuracy: true }
      );
    } else {
      setGpsStatus('unsupported');
      toast({ title: "Unsupported", description: "Geolocation not supported.", variant: "destructive" });
      stopTracking({ showToast: false });
    }
  };

  const startTracking = () => {
    if (!assignedRouteId || !selectedRouteId) {
      toast({ 
        title: "Route Assignment Required", 
        description: "Your official route has not been set by the Admin. Please contact the Command Hub to get synchronized.", 
        variant: "destructive" 
      });
      return;
    }
    if (!selectedRoute) {
      toast({ title: "Route Invalid", description: `Assigned route ${selectedRouteId} not found in database. Contact Admin.`, variant: "destructive" });
      return;
    }
    setIsTracking(true);
    updateLocation();
    intervalRef.current = setInterval(updateLocation, 4000);
    toast({ title: "Service Online", description: `Broadcasting vehicle ${vehicleNumber} location.` });
  };

  const stopTracking = async ({ showToast = true }: { showToast?: boolean } = {}) => {
    setIsTracking(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    await markBusInactive();
    if (showToast) toast({ title: "Service Offline", description: "Live location stopped." });
  };

  const broadcastAlert = async (type: string, message: string) => {
    if (!profile || !selectedRouteId) return;
    setIsSendingAlert(type);
    try {
      await addDoc(collection(db, 'alerts'), {
        type,
        message: `${vehicleNumber}: ${message}`,
        routeId: selectedRouteId,
        senderId: profile.uid,
        senderName: profile.displayName || 'Driver',
        timestamp: serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Expire in 30m
      });
      toast({ 
        title: "Alert Broadcasted", 
        description: `Passengers on Route ${selectedRouteId} have been notified.`,
      });
    } catch (err) {
      console.error("Alert broadcast failed:", err);
    } finally {
      setIsSendingAlert(null);
    }
  };

  useEffect(() => {
    const handlePageExit = () => { if (!isTrackingRef.current) return; void markBusInactive(); };
    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      handlePageExit();
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
    };
  }, [markBusInactive]);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-outfit">
      <DashboardHeader title="Premium Driver Console" />

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls & Telemetry */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Main Status Card */}
          <Card className="shadow-2xl border-none overflow-hidden rounded-[40px] bg-zinc-900 text-white">
            <CardHeader className="pb-8 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-600/30">
                    <Bus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black">Live Service</CardTitle>
                    <CardDescription className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest mt-1">Broadcast Terminal</CardDescription>
                  </div>
                </div>
                {isTracking && (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none animate-pulse px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                    Live
                  </Badge>
                )}
              </div>
              <div className="space-y-4 pt-4">
                 <div className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Route & Vehicle</p>
                    <div className="flex items-center justify-between">
                       <span className="text-lg font-black">{selectedRouteId} / {vehicleNumber || '---'}</span>
                       <div className="w-8 h-8 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                          <Navigation className="w-4 h-4 text-zinc-500" />
                       </div>
                    </div>
                 </div>

                 {!isTracking ? (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-16 rounded-[24px] shadow-xl shadow-blue-600/20 text-lg active:scale-95 transition-all group"
                      onClick={startTracking}
                      disabled={!assignedRouteId}
                    >
                      <Play className="w-5 h-5 mr-3 fill-current group-hover:scale-110 transition-transform" />
                      Start Driving Service
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-black h-16 rounded-[24px] shadow-xl shadow-red-600/20 text-lg active:scale-95 transition-all group"
                      onClick={() => stopTracking()}
                    >
                      <Square className="w-5 h-5 mr-3 fill-current group-hover:scale-110 transition-transform" />
                      Stop Driving Service
                    </Button>
                  )}
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] -mr-16 -mb-16" />
            </CardHeader>
          </Card>

          {/* Telemetry Grid */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white p-6 rounded-[32px] border border-zinc-100 shadow-sm space-y-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                   <Gauge className="w-5 h-5" />
                </div>
                <div>
                   <div className="text-3xl font-black text-zinc-900 tabular-nums">{speed}<span className="text-xs text-zinc-400 ml-1">km/h</span></div>
                   <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Current Speed</div>
                </div>
             </div>
             <div className="bg-white p-6 rounded-[32px] border border-zinc-100 shadow-sm space-y-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                   <Star className="w-5 h-5 fill-amber-600" />
                </div>
                <div>
                   <div className="text-3xl font-black text-zinc-900 tabular-nums">{avgRating ? avgRating.toFixed(1) : 'New'}</div>
                   <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Driver Rating</div>
                </div>
             </div>
          </div>

          {/* Signal Stats */}
          <div className="bg-white p-6 rounded-[32px] border border-zinc-100 shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">System Telemetry</h3>
                <Badge variant="outline" className="rounded-full font-black text-[9px] px-3 uppercase tracking-tighter border-zinc-100">
                   {isTracking ? 'Active Link' : 'Standby'}
                </Badge>
             </div>
             <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold py-2">
                   <div className="flex items-center gap-2 text-zinc-500">
                      <Wifi className={`w-4 h-4 ${gpsStatus === 'ready' ? 'text-emerald-500' : 'text-zinc-300'}`} />
                      GPS Signal
                   </div>
                   <span className={gpsStatus === 'ready' ? 'text-emerald-600' : 'text-zinc-400 uppercase tracking-tighter'}>
                      {gpsStatus === 'ready' ? 'Stable' : gpsStatus === 'locating' ? 'Searching...' : 'Idle'}
                   </span>
                </div>
                <div className="h-px bg-zinc-50 w-full" />
                <div className="flex items-center justify-between text-xs font-bold py-2">
                   <div className="flex items-center gap-2 text-zinc-500">
                      <Clock className="w-4 h-4 text-zinc-300" />
                      Sync Frequency
                   </div>
                   <span className="text-zinc-900">4,000ms</span>
                </div>
                <div className="h-px bg-zinc-50 w-full" />
                <div className="flex items-center justify-between text-xs font-bold py-2">
                   <div className="flex items-center gap-2 text-zinc-500">
                      <Zap className="w-4 h-4 text-blue-500" />
                      Cloud Status
                   </div>
                   <span className="text-zinc-900">Connected</span>
                </div>
             </div>
          </div>
        </div>

        {/* Center/Right Column: Live Map & Broadcast Controls */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Top Panel: Next Stop & Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Alert Broadcasting */}
             <div className="bg-white p-6 rounded-[32px] border border-zinc-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4 text-amber-500" />
                   <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900">Broadcast Delay Alert</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                   {[
                     { label: 'Heavy Traffic', type: 'traffic', msg: 'Heavy traffic delay on route.', icon: Navigation },
                     { label: '5m Delay', type: 'delay', msg: 'Running approx 5 mins behind schedule.', icon: Clock },
                     { label: 'Breakdown', type: 'emergency', msg: 'Vehicle technical issue. Relief bus requested.', icon: AlertCircle },
                     { label: 'Cleared', type: 'info', msg: 'Delays cleared. Back on schedule.', icon: CheckCircle2 }
                   ].map((a) => (
                      <Button 
                        key={a.label}
                        variant="outline" 
                        size="sm"
                        disabled={!isTracking || isSendingAlert !== null}
                        onClick={() => broadcastAlert(a.type, a.msg)}
                        className={`rounded-2xl h-12 justify-start font-bold text-[11px] gap-2 hover:bg-zinc-900 hover:text-white transition-all ${isSendingAlert === a.type ? 'animate-pulse' : ''}`}
                      >
                         {isSendingAlert === a.type ? <Loader2 className="w-3 h-3 animate-spin"/> : <a.icon className="w-3 h-3" />}
                         {a.label}
                      </Button>
                   ))}
                </div>
             </div>

             {/* Next Stop Insight */}
             <div className="bg-zinc-900 p-6 rounded-[32px] text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
                <div className="relative z-10">
                   <div className="flex items-center gap-2 mb-4">
                      <Navigation className="w-4 h-4 text-blue-400" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Route Progress</h3>
                   </div>
                   <div className="space-y-1">
                      <div className="text-[10px] font-black text-zinc-500 uppercase">Approaching Stop</div>
                      <div className="text-2xl font-black truncate">{nextStop ? nextStop.name : 'Terminal Reached'}</div>
                   </div>
                </div>
                <div className="mt-4 relative z-10">
                   <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase mb-2">
                      <span>Progress</span>
                      <span>{isTracking ? 'Driving' : 'Standby'}</span>
                   </div>
                   <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full bg-blue-500 rounded-full transition-all duration-1000 ${isTracking ? 'w-2/3' : 'w-0'}`} />
                   </div>
                </div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-[40px] -mr-8 -mt-8" />
             </div>
          </div>

          {/* Large Map Display */}
          <div className="h-[500px] lg:h-[600px] rounded-[40px] overflow-hidden shadow-2xl border-4 border-white relative group ring-1 ring-zinc-100">
            <DynamicMap
              buses={location ? [{
                id: profile?.uid || 'me',
                driverId: profile?.uid || 'me',
                driverName: profile?.displayName || 'You',
                routeId: selectedRouteId,
                vehicleNumber: vehicleNumber || 'Unassigned',
                location: location,
                updatedAt: new Date().toISOString(),
                status: 'active'
              }] : []}
              center={location || { lat: 13.1704, lng: 77.5662 }}
              route={selectedRoute}
              userLocation={location}
              focusKey={location ? 1 : 0}
            />
            
            {/* Map Overlay Button */}
            <div className="absolute top-6 right-6 z-20">
               <Button 
                onClick={() => location && setLocation(prev => prev ? {...prev} : null)} 
                variant="secondary" 
                className="w-14 h-14 rounded-2xl bg-white shadow-2xl hover:bg-zinc-50 border-none transition-all active:scale-95"
               >
                  <MapPin className="w-6 h-6 text-blue-600" />
               </Button>
            </div>

            {!isTracking && (
              <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-[4px] z-10 flex items-center justify-center p-8 text-center">
                <div className="bg-white rounded-[40px] p-10 shadow-2xl max-w-sm animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                     <AlertCircle className="w-10 h-10 text-blue-600" />
                  </div>
                  <h4 className="font-black text-zinc-900 uppercase tracking-[0.2em] text-sm mb-4">
                    {!assignedRouteId ? 'Assignment Required' : 'Service Offline'}
                  </h4>
                  <p className="text-xs text-zinc-500 font-bold leading-relaxed mb-6">
                    {!assignedRouteId 
                      ? 'You have not been assigned an official route yet. Please contact the Command Hub to activate your account.' 
                      : 'Start your live service to synchronize with the university fleet and share your position with passengers.'}
                  </p>
                  <Button onClick={startTracking} className="w-full h-12 bg-zinc-900 hover:bg-black rounded-2xl font-black">
                     Connect GPS Now
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="py-12 border-t border-zinc-100 text-center">
         <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em]">
           LiveBus Tracker Logic Layer &copy; 2026
         </p>
      </footer>
    </div>
  );
}

export default function DriverDashboard() {
  return (
    <RequireRole allowedRoles={['driver']}>
      <DriverDashboardContent />
    </RequireRole>
  );
}
