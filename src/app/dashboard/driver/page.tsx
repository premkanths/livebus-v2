"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bus, MapPin, Play, Square, LogOut, Clock, Wifi, AlertCircle, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRoutes } from '@/context/RouteContext';
import dynamic from "next/dynamic";
import { DashboardHeader } from '@/components/DashboardHeader';

const DynamicMap = dynamic(() => import("@/components/Map"), { ssr: false });
type GpsStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unsupported' | 'error';

export default function DriverDashboard() {
  const { profile, signOut } = useAuth();
  const { routes } = useRoutes();
  const { toast } = useToast();
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const selectedRouteRef = useRef<string>('');
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) || null;

  useEffect(() => {
    selectedRouteRef.current = selectedRouteId;
  }, [selectedRouteId]);

  const updateLocation = async () => {
    if (!profile) return;
    const currentRoute = selectedRouteRef.current;
    if (!currentRoute) return;

    if ("geolocation" in navigator) {
      setGpsStatus('locating');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ lat: latitude, lng: longitude });
          setGpsStatus('ready');

          try {
            const busRef = doc(db, 'buses', profile.uid);
            await setDoc(busRef, {
              driverId: profile.uid,
              driverName: profile.displayName || profile.email || 'Unnamed Driver',
              routeId: currentRoute,
              location: { lat: latitude, lng: longitude },
              updatedAt: new Date().toISOString(),
              status: 'active'
            }, { merge: true });
            
            setLastUpdate(new Date());
          } catch (error) {
            console.error("Error updating location:", error);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setGpsStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
          toast({
            title: "GPS Error",
            description: "Could not retrieve your current location. Please check permissions.",
            variant: "destructive"
          });
          stopTracking();
        },
        { enableHighAccuracy: true }
      );
    } else {
      setGpsStatus('unsupported');
      toast({
        title: "Unsupported",
        description: "Geolocation is not supported by your browser.",
        variant: "destructive"
      });
      stopTracking();
    }
  };

  const startTracking = () => {
    if (!selectedRouteId) {
      toast({
        title: "Route Required",
        description: "Please select the route you are driving before starting.",
        variant: "destructive"
      });
      return;
    }
    setIsTracking(true);
    updateLocation();
    intervalRef.current = setInterval(updateLocation, 4000);
    toast({
      title: "Tracking Started",
      description: "Sharing live location on route: " + selectedRouteId,
    });
  };

  const stopTracking = async () => {
    setIsTracking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (profile) {
      try {
        const busRef = doc(db, 'buses', profile.uid);
        await updateDoc(busRef, {
          status: 'inactive',
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error stopping tracking:", error);
      }
    }
    
    toast({
      title: "Tracking Stopped",
      description: "Passengers can no longer see your live location.",
    });
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const gpsMessage = {
    idle: 'GPS is idle until tracking starts.',
    locating: 'Trying to get your current GPS position...',
    ready: 'GPS connected and ready to share location.',
    denied: 'Location access denied. Allow GPS permission before starting tracking.',
    unsupported: 'Geolocation is not supported in this browser.',
    error: 'Could not retrieve your location. Try again in a better signal area.',
  }[gpsStatus];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <DashboardHeader title="Driver Console" />

      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="shadow-lg border-zinc-200 overflow-hidden rounded-3xl">
              <CardHeader className="bg-zinc-900 text-white pb-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/20 p-2 rounded-xl">
                      <Bus className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-black tracking-tight">Drive Service</CardTitle>
                      <CardDescription className="text-zinc-400 font-medium">Broadcast your live bus location.</CardDescription>
                    </div>
                  </div>
                  {selectedRoute && (
                    <div 
                      className="px-3 py-1.5 rounded-xl text-xs font-black text-white shadow-lg border border-white/10"
                      style={{ backgroundColor: selectedRoute.color || '#3b82f6' }}
                    >
                      EXP-{selectedRoute.id}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">Select Assigned Route</label>
                    <Select 
                      onValueChange={setSelectedRouteId} 
                      value={selectedRouteId}
                      disabled={isTracking}
                    >
                      <SelectTrigger className="h-14 rounded-2xl border-zinc-200 text-lg font-bold shadow-sm focus:ring-emerald-500">
                        <SelectValue placeholder="Pick a route line" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {routes.map((route) => (
                          <SelectItem key={route.id} value={route.id} className="py-3 font-bold">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: route.color || '#3b82f6' }} />
                              <span>{route.id} - {route.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-4">
                    {!isTracking ? (
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black h-16 rounded-2xl shadow-xl shadow-emerald-600/20 text-lg active:scale-[0.98] transition-all"
                        onClick={startTracking}
                      >
                        <Play className="w-6 h-6 mr-3 fill-current" />
                        Start Service
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black h-16 rounded-2xl shadow-xl shadow-red-600/20 text-lg active:scale-[0.98] transition-all"
                        onClick={stopTracking}
                      >
                        <Square className="w-6 h-6 mr-3 fill-current" />
                        Stop Service
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-zinc-200 rounded-3xl overflow-hidden">
              <CardHeader className="pb-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Live Telemetry</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Wifi className={`w-3.5 h-3.5 ${isTracking ? 'text-emerald-500 animate-pulse' : 'text-zinc-300'}`} />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Signal Status</span>
                    </div>
                    <p className={`text-sm font-black uppercase ${gpsStatus === 'ready' ? 'text-emerald-600' : 'text-zinc-400'}`}>
                      {gpsStatus === 'ready' ? 'Active' : gpsStatus === 'locating' ? 'Syncing...' : 'Standby'}
                    </p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5 text-zinc-300" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Last Update</span>
                    </div>
                    <p className="text-sm font-black text-zinc-800 uppercase tabular-nums">
                      {lastUpdate ? lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mt-4">
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Driver Rating</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-black text-zinc-800">
                        {avgRating ? avgRating.toFixed(1) : 'New Driver'}
                      </span>
                      {avgRating && <span className="text-[10px] text-zinc-400 font-bold">/ 5.0</span>}
                    </div>
                  </div>
                </div>

                {location && (
                  <div className="mt-4 p-4 bg-zinc-900 rounded-2xl text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/10 p-2 rounded-lg">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Current Coordinates</div>
                        <p className="text-xs font-mono font-bold tracking-tighter">
                          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="h-[400px] lg:h-auto rounded-3xl overflow-hidden shadow-2xl border-4 border-white relative group">
            <DynamicMap
              buses={location ? [{
                id: profile?.uid || 'me',
                driverId: profile?.uid || 'me',
                driverName: profile?.displayName || 'You',
                routeId: selectedRouteId,
                location: location,
                updatedAt: new Date().toISOString(),
                status: 'active'
              }] : []}
              center={location || { lat: 13.10, lng: 77.59 }}
              route={selectedRoute}
              userLocation={location}
              focusKey={location ? 1 : 0}
            />
            {!location && (
              <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px] z-10 flex items-center justify-center p-8 text-center">
                <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs animate-in zoom-in-95 duration-300">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h4 className="font-black text-zinc-800 uppercase tracking-widest text-sm mb-2">Map Offline</h4>
                  <p className="text-xs text-zinc-500 font-medium leading-relaxed">Start service to see your live position and route path on the map.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
