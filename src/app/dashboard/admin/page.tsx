"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { Route, useRoutes } from '@/context/RouteContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  deleteDoc, 
  doc, 
  updateDoc, 
  setDoc, 
  where, 
  writeBatch,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Activity, 
  MapPin, 
  Trash2, 
  BusFront, 
  Route as RouteIcon, 
  Search, 
  RefreshCw, 
  Clock, 
  Pencil, 
  XCircle, 
  Sparkles, 
  PlayCircle,
  Users,
  ShieldCheck,
  LayoutDashboard,
  BellRing,
  History,
  Zap,
  TrendingUp,
  AlertTriangle,
  UserPlus
} from 'lucide-react';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { GeocodingResult } from '@/lib/geocoding';
import { DashboardHeader } from '@/components/DashboardHeader';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/context/AuthContext';
import { buildSimulatedBuses, createDemoFleetConfigs, DemoBusConfig } from '@/lib/demo-buses';
import { Badge } from '@/components/ui/badge';

interface DraftStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  timeFromStart: number;
}

interface DriverProfile {
  id: string;
  displayName?: string;
  email?: string;
  assignedRouteId?: string;
  vehicleNumber?: string;
  role?: string;
}

interface ActiveBus {
  id: string;
  driverName?: string;
  routeId?: string;
  vehicleNumber?: string;
  updatedAt?: string;
  isDemo?: boolean;
}

interface GlobalAlert {
  id: string;
  type: string;
  message: string;
  routeId: string;
  senderName: string;
  timestamp: any;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalizeRole(role?: string) {
  return (role || 'user').trim().toLowerCase();
}

function normalizeRouteId(routeId?: string) {
  return (routeId || '').trim().toUpperCase();
}

function AdminDashboardContent() {
  const { profile } = useAuth();
  const { routes } = useRoutes();
  const { toast } = useToast();

  const [routeId, setRouteId] = useState('');
  const [routeName, setRouteName] = useState('');
  const [routeColor, setRouteColor] = useState('#3b82f6');
  const [stops, setStops] = useState<DraftStop[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedSavedRouteId, setSelectedSavedRouteId] = useState<string>('');
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<DriverProfile[]>([]);
  const [globalAlerts, setGlobalAlerts] = useState<GlobalAlert[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverRouteId, setDriverRouteId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isAssigningDriver, setIsAssigningDriver] = useState(false);
  const [activeBuses, setActiveBuses] = useState<ActiveBus[]>([]);
  const [demoBusConfigs, setDemoBusConfigs] = useState<DemoBusConfig[]>([]);
  const [isSeedingDemoFleet, setIsSeedingDemoFleet] = useState(false);
  const [isDeletingDemoFleet, setIsDeletingDemoFleet] = useState(false);
  const [simulationNow, setSimulationNow] = useState(Date.now());
  const [promotionEmail, setPromotionEmail] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  // Real-time Sync Guard to prevent duplicate listeners in React 19/Fast Refresh
  const subscribersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    // Only subscribe if we have a valid admin profile
    if (!profile || normalizeRole(profile.role) !== 'admin') return;
    
    // Cleanup existing if any (safety fallback)
    subscribersRef.current.forEach(unsub => unsub());
    subscribersRef.current = [];

    console.log("[Admin] Initializing Command Hub Synchronization...");

    // 1. Users Listener
    const unsubUsers = onSnapshot(collection(db, 'users'), 
      (snapshot) => {
        const users = snapshot.docs.map(d => {
          const data = d.data() as DriverProfile;
          return {
            ...data,
            id: d.id,
            role: normalizeRole(data.role),
            assignedRouteId: normalizeRouteId(data.assignedRouteId),
            vehicleNumber: data.vehicleNumber?.trim().toUpperCase() || '',
          };
        });
        setAllUsers(users);
      },
      (error) => {
        console.error("Users Sync Error:", error);
        if (error.code === 'permission-denied') {
          toast({ 
            title: "Database Access Restricted", 
            description: "Your account lacks permission to view the user directory. Please ensure you have the 'admin' role in Firestore.", 
            variant: "destructive" 
          });
        }
      }
    );
    subscribersRef.current.push(unsubUsers);

    // 2. Alerts Listener
    const unsubAlerts = onSnapshot(
      query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(50)), 
      (snapshot) => {
        setGlobalAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GlobalAlert)));
      }
    );
    subscribersRef.current.push(unsubAlerts);

    // 3. Active Buses Listener
    const unsubBuses = onSnapshot(
      query(collection(db, 'buses'), where('status', '==', 'active')), 
      (snapshot) => {
        setActiveBuses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActiveBus)));
      }
    );
    subscribersRef.current.push(unsubBuses);

    // 4. Demo Buses Listener
    const unsubDemo = onSnapshot(collection(db, 'demoBuses'), (snapshot) => {
      setDemoBusConfigs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DemoBusConfig)));
    });
    subscribersRef.current.push(unsubDemo);

    return () => {
      console.log("[Admin] Disconnecting Command Hub Listeners...");
      subscribersRef.current.forEach(unsub => unsub());
      subscribersRef.current = [];
    };
  }, [profile, toast]);

  // Handle redundant separate effects if they existed (removing them below)


  // Drivers Filtered
  const drivers = useMemo(() => allUsers.filter(u => normalizeRole(u.role) === 'driver'), [allUsers]);
  const assignableUsers = useMemo(() => allUsers.filter(u => normalizeRole(u.role) !== 'admin'), [allUsers]);
  const passengerCount = useMemo(() => allUsers.filter(u => {
    const role = normalizeRole(u.role);
    return role === 'user' || role === 'passenger';
  }).length, [allUsers]);

  // Auto-Select First Available Driver
  useEffect(() => {
    if (!selectedDriverId && assignableUsers.length > 0) {
      setSelectedDriverId(assignableUsers[0].id);
    }
  }, [assignableUsers, selectedDriverId]);

  useEffect(() => {
    if (!selectedSavedRouteId && routes.length > 0) setSelectedSavedRouteId(routes[0].id);
  }, [routes, selectedSavedRouteId]);

  // Listeners consolidated above.


  useEffect(() => {
    const timer = window.setInterval(() => setSimulationNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedDriver = assignableUsers.find((driver) => driver.id === selectedDriverId) || null;

  useEffect(() => {
    // Only reset form if the driver ID has changed
    const driver = assignableUsers.find(d => d.id === selectedDriverId);
    if (!driver) {
      setDriverRouteId('');
      setVehicleNumber('');
      return;
    }
    
    // Only populate if current fields are empty or we explicitly switched drivers
    setDriverRouteId(normalizeRouteId(driver.assignedRouteId));
    setVehicleNumber(driver.vehicleNumber || '');
  }, [assignableUsers, selectedDriverId]); // Re-hydrate when user data arrives or selection changes

  const resetEditor = () => {
    setRouteId(''); setRouteName(''); setRouteColor('#3b82f6'); setStops([]); setEditingRouteId(null);
  };

  const loadRouteIntoEditor = (route: Route) => {
    setRouteId(route.id);
    setRouteName(route.name);
    setRouteColor(route.color || '#3b82f6');
    setStops(route.stops.map((stop, index) => ({
      id: `${route.id}-${index}-${stop.name}`,
      name: stop.name,
      lat: stop.lat,
      lng: stop.lng,
      timeFromStart: stop.timeFromStart || 0,
    })));
    setEditingRouteId(route.id);
  };

  const handleAddStop = (loc: GeocodingResult | null) => {
    if (!loc) return;
    const stopName = loc.displayName.split(',')[0];
    let timeOffset = 0;
    if (stops.length > 0) {
      const lastStop = stops[stops.length - 1];
      const distKm = getDistanceFromLatLonInKm(lastStop.lat, lastStop.lng, loc.lat, loc.lng);
      timeOffset = lastStop.timeFromStart + Math.round(distKm * 3);
    }
    setStops([...stops, { id: Math.random().toString(), name: stopName, lat: loc.lat, lng: loc.lng, timeFromStart: timeOffset }]);
  };

  const handleRemoveStop = (idx: number) => {
    const newStops = [...stops]; newStops.splice(idx, 1);
    for (let i = 1; i < newStops.length; i++) {
      const prev = newStops[i - 1]; const curr = newStops[i];
      newStops[i].timeFromStart = prev.timeFromStart + Math.round(getDistanceFromLatLonInKm(prev.lat, prev.lng, curr.lat, curr.lng) * 3);
    }
    if (newStops.length > 0) newStops[0].timeFromStart = 0;
    setStops(newStops);
  };

  const parseRouteNameAuto = () => {
    if (stops.length >= 2) {
      setRouteName(`${stops[0].name} to ${stops[stops.length - 1].name}`);
    }
  };

  const saveRoute = async () => {
    if (!routeId || stops.length < 2) {
      toast({ title: 'Incomplete', description: 'Enter Route ID and at least 2 stops.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const cleanId = routeId.trim().toUpperCase().replace(/\s+/g, '');
      const finalRouteName = routeName || `${stops[0].name} to ${stops[stops.length - 1].name}`;
      await setDoc(doc(db, 'routes', cleanId), {
        name: finalRouteName, color: routeColor,
        stops: stops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng, timeFromStart: s.timeFromStart }))
      });
      toast({ title: editingRouteId ? 'Route Updated' : 'Route Created', description: `Route ${cleanId} saved.` });
      setSelectedSavedRouteId(cleanId); resetEditor();
    } catch (err: any) { toast({ title: 'Error Saving', description: err.message, variant: 'destructive' }); }
    finally { setIsSaving(false); }
  };

  const deleteRoute = async () => {
    if (!selectedSavedRoute) return;
    if (!window.confirm(`Delete route ${selectedSavedRoute.id}?`)) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'routes', selectedSavedRoute.id));
      toast({ title: 'Route Deleted', description: `Route ${selectedSavedRoute.id} removed.` });
      if (editingRouteId === selectedSavedRoute.id) resetEditor();
    } catch (err: any) { toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' }); }
    finally { setIsDeleting(false); }
  };

  const saveDriverAssignment = async () => {
    if (!selectedDriverId || !driverRouteId || !vehicleNumber.trim()) {
      toast({ title: 'Incomplete', description: 'Select driver, route, and vehicle number.', variant: 'destructive' });
      return;
    }
    setIsAssigningDriver(true);
    try {
      const normalizedRouteId = normalizeRouteId(driverRouteId);
      await setDoc(doc(db, 'users', selectedDriverId), {
        role: 'driver',
        assignedRouteId: normalizedRouteId,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
      }, { merge: true });
      toast({ title: 'Driver Assigned', description: `Driver successfully assigned to ${normalizedRouteId}.` });
    } catch (err: any) { 
      console.error("Assignment Critical Error:", err);
      toast({ 
        title: 'Assignment Failed', 
        description: err.code === 'permission-denied' 
          ? "Permission Denied. Please ensure your account has the 'admin' role in the Users collection." 
          : err.message, 
        variant: 'destructive' 
      }); 
    }
    finally { setIsAssigningDriver(false); }
  };

  const createDemoFleet = async () => {
    if (routes.length === 0) return;
    setIsSeedingDemoFleet(true);
    try {
      const batch = writeBatch(db);
      const fleet = createDemoFleetConfigs(routes, 6, profile?.uid);
      fleet.forEach(bus => batch.set(doc(db, 'demoBuses', bus.id), bus));
      await batch.commit();
      toast({ title: 'Demo Fleet Ready', description: `${fleet.length} buses live.` });
    } catch (err: any) { toast({ title: 'Failed', description: err.message, variant: 'destructive' }); }
    finally { setIsSeedingDemoFleet(false); }
  };

  const deleteDemoFleet = async (routeId?: string) => {
    const targets = routeId ? demoBusConfigs.filter(b => b.routeId === routeId) : demoBusConfigs;
    if (targets.length === 0) return;
    if (!window.confirm('Delete demo buses?')) return;
    setIsDeletingDemoFleet(true);
    try {
      const batch = writeBatch(db);
      targets.forEach(bus => batch.delete(doc(db, 'demoBuses', bus.id)));
      await batch.commit();
      toast({ title: 'Demo Fleet Removed' });
    } catch (err: any) { toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' }); }
    finally { setIsDeletingDemoFleet(false); }
  };

  const recallAlert = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'alerts', id));
      toast({ title: 'Alert Recalled', description: 'Notification removed from all subscriber feeds.' });
    } catch (err) { toast({ title: 'Error', description: 'Could not recall alert.', variant: 'destructive' }); }
  };

  const promoteUserByEmail = async () => {
    if (!promotionEmail.trim()) return;
    setIsPromoting(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', promotionEmail.trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        toast({ 
          title: "User Not Found", 
          description: "No account registered with this email address.",
          variant: "destructive" 
        });
        return;
      }

      const userDoc = snap.docs[0];
      await setDoc(doc(db, 'users', userDoc.id), { role: 'driver' }, { merge: true });
      
      toast({ 
        title: "User Promoted!", 
        description: `${promotionEmail} is now a Driver and will appear in the assignment list.`,
      });
      setPromotionEmail('');
    } catch (err: any) {
      toast({ title: "Operation Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPromoting(false);
    }
  };

  const demoteToUser = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to demote ${email} to standard User role?`)) return;
    try {
      await setDoc(doc(db, 'users', id), { role: 'user', assignedRouteId: '', vehicleNumber: '' }, { merge: true });
      toast({ title: "User Demoted", description: `${email} is no longer a driver.` });
    } catch (err: any) {
      toast({ title: "Demotion Failed", description: err.message, variant: "destructive" });
    }
  };

  const selectedSavedRoute = useMemo(() => routes.find(r => r.id === selectedSavedRouteId) || null, [routes, selectedSavedRouteId]);
  const simulatedDemoBuses = useMemo(() => buildSimulatedBuses(demoBusConfigs, routes, simulationNow), [demoBusConfigs, routes, simulationNow]);
  const combinedActiveBuses = useMemo(() => [...activeBuses, ...simulatedDemoBuses], [activeBuses, simulatedDemoBuses]);
  const activeBusCountsByRoute = useMemo(() => {
    return combinedActiveBuses.reduce<Record<string, number>>((acc, bus) => {
      if (bus.routeId) acc[bus.routeId] = (acc[bus.routeId] || 0) + 1;
      return acc;
    }, {});
  }, [combinedActiveBuses]);

  const selectedRouteActiveBuses = selectedSavedRoute ? combinedActiveBuses.filter(b => b.routeId === selectedSavedRoute.id) : [];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-outfit">
      <DashboardHeader title="LiveBus Command Hub" />

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Stats & User Management */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Real-time Intel Card */}
          <Card className="shadow-2xl border-none overflow-hidden rounded-[40px] bg-zinc-900 text-white">
            <CardHeader className="pb-8">
               <div className="flex items-center justify-between mb-4">
                  <div className="bg-emerald-500/20 p-2 rounded-xl">
                     <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <Badge className="bg-white/10 text-white text-[9px] uppercase tracking-widest border-none">Secure Link</Badge>
               </div>
               <CardTitle className="text-xl font-black">Fleet Intel</CardTitle>
               <CardDescription className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest mt-1">Global System Health</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-3xl p-4 border border-white/5">
                     <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Busses</div>
                     <div className="text-2xl font-black mt-1 tabular-nums">{combinedActiveBuses.length}</div>
                  </div>
                  <div className="bg-white/5 rounded-3xl p-4 border border-white/5">
                     <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Drivers Found</div>
                     <div className="text-2xl font-black mt-1 tabular-nums transition-all duration-500">{drivers.length}</div>
                  </div>
               </div>
               <div className="bg-emerald-500/10 rounded-3xl p-5 border border-emerald-500/10 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest">Global Passengers</div>
                    <div className="text-2xl font-black text-emerald-400 mt-1 tabular-nums">{passengerCount}</div>
                  </div>
                  <div className="text-right">
                     <div className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest mb-1">Users Synced</div>
                     <div className="text-lg font-black text-emerald-400/50">{allUsers.length}</div>
                  </div>
               </div>
               {allUsers.length === 0 && (
                  <div className="bg-red-500/10 rounded-2xl p-4 border border-red-500/20 text-center text-red-400">
                     <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
                     <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">No users discovered. <br/>Check security rules.</p>
                  </div>
               )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-4">
             <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-400 px-2">Rapid Deployment</h3>
             <Button onClick={createDemoFleet} disabled={isSeedingDemoFleet} className="w-full h-14 rounded-[24px] bg-white border border-zinc-200 shadow-sm text-zinc-900 hover:bg-zinc-50 font-black justify-start px-6 gap-3 group">
                <div className="bg-blue-50 p-2 rounded-xl group-hover:bg-blue-100 transition-colors">
                   <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                {isSeedingDemoFleet ? 'Deploying...' : 'Deploy Demo Fleet'}
             </Button>

             <Button onClick={() => deleteDemoFleet()} disabled={isDeletingDemoFleet || demoBusConfigs.length === 0} variant="destructive" className="w-full h-14 rounded-[24px] font-black justify-start px-6 gap-3 shadow-xl shadow-red-600/10">
                <div className="bg-black/10 p-2 rounded-xl">
                   <Trash2 className="w-4 h-4" />
                </div>
                Clear Demo Data
             </Button>
          </div>

          {/* Driver Assignment Card */}
          <Card className="shadow-lg border-zinc-100 rounded-[40px] overflow-hidden">
             <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                   <UserPlus className="w-4 h-4 text-blue-600" />
                   <h3 className="text-xs font-black uppercase tracking-widest">Fleet Assignment</h3>
                </div>
             </CardHeader>
             <CardContent className="space-y-5">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Select Account</label>
                   <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                      <SelectTrigger className="rounded-2xl border-zinc-100 h-12 font-bold shadow-sm">
                         <SelectValue placeholder="User or Driver" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                         {assignableUsers.map(d => (
                           <SelectItem key={d.id} value={d.id} className="font-bold">
                             {(d.displayName || d.email || 'Unnamed User')} ({normalizeRole(d.role)})
                           </SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Route ID</label>
                   <Select value={driverRouteId} onValueChange={setDriverRouteId}>
                      <SelectTrigger className="rounded-2xl border-zinc-100 h-12 font-bold shadow-sm">
                         <SelectValue placeholder="Select Route" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                         {routes.map(r => <SelectItem key={r.id} value={r.id} className="font-bold">{r.id} - {r.name}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Vehicle Num</label>
                   <Input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="KA-01-V-1234" className="rounded-2xl border-zinc-100 h-12 font-bold tracking-tight uppercase" />
                </div>
                <Button onClick={saveDriverAssignment} disabled={isAssigningDriver || assignableUsers.length === 0} className="w-full rounded-2xl h-14 bg-zinc-900 font-bold hover:bg-black transition-all">
                   {isAssigningDriver ? 'Assigning...' : 'Save Driver Assignment'}
                </Button>
                {selectedDriver && normalizeRole(selectedDriver.role) !== 'driver' && (
                  <p className="text-[9px] text-zinc-400 font-bold text-center px-2">
                    This assignment will also promote the selected user to the Driver role.
                  </p>
                )}
             </CardContent>
          </Card>

          {/* User Access Control */}
          <Card className="shadow-lg border-zinc-100 rounded-[40px] overflow-hidden bg-white mb-6">
             <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                   <ShieldCheck className="w-4 h-4 text-emerald-600" />
                   <h3 className="text-xs font-black uppercase tracking-widest">Access Control</h3>
                </div>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Promote accounts to Driver role</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Search Email</label>
                   <div className="relative">
                      <Input 
                        value={promotionEmail} 
                        onChange={e => setPromotionEmail(e.target.value)} 
                        placeholder="e.g. user@gmail.com" 
                        className="rounded-2xl border-zinc-100 h-12 font-bold tracking-tight" 
                      />
                   </div>
                </div>
                <Button 
                   onClick={promoteUserByEmail} 
                   disabled={isPromoting || !promotionEmail.trim()} 
                   className="w-full rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-600/20 text-white transition-all"
                >
                   {isPromoting ? 'Searching...' : 'Promote to Driver'}
                </Button>
                <p className="text-[9px] text-zinc-400 font-bold text-center px-2">
                   Promoted users immediately appear in the Fleet Assignment list above.
                </p>
             </CardContent>
          </Card>

          {/* Fleet Status Monitor Table */}
          <Card className="shadow-lg border-zinc-100 rounded-[40px] overflow-hidden bg-white mt-6">
             <CardHeader className="pb-4 border-b border-zinc-50">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-zinc-600" />
                      <h3 className="text-xs font-black uppercase tracking-widest">Fleet Status Monitor</h3>
                   </div>
                   <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="h-8 text-[10px] font-black uppercase tracking-widest gap-2">
                      <RefreshCw className="w-3 h-3" /> Sync Core
                   </Button>
                </div>
             </CardHeader>
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                      <thead>
                         <tr className="bg-zinc-50/50">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Driver</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Assignment</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Vehicle</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Actions</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                         {drivers.length > 0 ? drivers.map(d => (
                            <tr key={d.id} className="hover:bg-zinc-50/50 transition-colors">
                               <td className="px-6 py-4">
                                  <div className="font-bold text-xs text-zinc-900">{d.displayName || d.email}</div>
                                  <div className="text-[10px] text-zinc-400 font-medium truncate max-w-[120px]">{d.email}</div>
                               </td>
                               <td className="px-6 py-4">
                                  {d.assignedRouteId ? (
                                     <Badge variant="outline" className="bg-blue-50 text-blue-700 border-none font-bold text-[10px]">
                                        {d.assignedRouteId}
                                     </Badge>
                                  ) : (
                                     <span className="text-[10px] text-zinc-300 font-bold uppercase">Unassigned</span>
                                  )}
                               </td>
                               <td className="px-6 py-4">
                                  <span className="text-[11px] font-black text-zinc-700 tracking-tighter uppercase">{d.vehicleNumber || '---'}</span>
                               </td>
                               <td className="px-6 py-4">
                                  <div className="flex items-center gap-1.5">
                                     <div className={`w-1.5 h-1.5 rounded-full ${activeBuses.some(b => b.id === d.id) ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-200'}`} />
                                     <span className="text-[9px] font-black uppercase text-zinc-400">
                                        {activeBuses.some(b => b.id === d.id) ? 'Online' : 'Standby'}
                                     </span>
                                  </div>
                               </td>
                               <td className="px-6 py-4 text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-bold text-[10px]"
                                    onClick={() => demoteToUser(d.id, d.email || 'this user')}
                                  >
                                    Demote
                                  </Button>
                               </td>
                            </tr>
                         )) : (
                            <tr>
                               <td colSpan={4} className="px-6 py-12 text-center text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                                  No Drivers Registered
                               </td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </CardContent>
          </Card>
        </div>

        {/* Center Column: Route & Alert Managers */}
        <div className="lg:col-span-5 space-y-6">
           
           {/* Global Alert Monitor */}
           <Card className="shadow-xl border-none rounded-[40px] overflow-hidden bg-white">
              <CardHeader className="bg-zinc-50/50 pb-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <BellRing className="w-5 h-5 text-amber-500" />
                       <CardTitle className="text-lg font-black">Live Alert Monitor</CardTitle>
                    </div>
                    <Badge variant="outline" className="rounded-full bg-white font-black text-[9px] border-zinc-100">{globalAlerts.length} Active</Badge>
                 </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                 {globalAlerts.length > 0 ? (
                    <div className="divide-y divide-zinc-50">
                       {globalAlerts.map(alert => (
                          <div key={alert.id} className="p-4 hover:bg-zinc-50 transition-colors flex items-start justify-between gap-4 group">
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                   <Badge className={`text-[8px] font-black uppercase tracking-tighter px-1.5 border-none ${alert.type === 'emergency' ? 'bg-red-500' : alert.type === 'traffic' ? 'bg-amber-500' : 'bg-blue-500'}`}>
                                      {alert.type}
                                   </Badge>
                                   <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate max-w-[100px]">{alert.routeId}</span>
                                   <span className="text-[10px] text-zinc-300 font-bold ml-auto tabular-nums">
                                      {alert.timestamp?.toDate ? new Date(alert.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                                   </span>
                                </div>
                                <p className="text-xs font-bold text-zinc-800 leading-tight mb-1">{alert.message}</p>
                                <div className="text-[9px] font-black text-zinc-400 uppercase">By {alert.senderName}</div>
                             </div>
                             <Button onClick={() => recallAlert(alert.id)} variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 className="w-4 h-4" />
                             </Button>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <div className="py-12 text-center opacity-30 flex flex-col items-center">
                       <History className="w-10 h-10 mb-2" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No Active Alerts</p>
                    </div>
                 )}
              </CardContent>
           </Card>

           {/* Route Discovery & Management */}
           <Card className="shadow-xl border-none rounded-[40px] overflow-hidden bg-white flex flex-col h-[600px]">
              <CardHeader className="bg-zinc-50 border-b border-zinc-100 pb-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <LayoutDashboard className="w-5 h-5 text-blue-600" />
                       <CardTitle className="text-lg font-black">Route Architecture</CardTitle>
                    </div>
                    <div className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-1 rounded-lg">{routes.length} Active Lines</div>
                 </div>
              </CardHeader>
              <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
                 {routes.map(r => (
                    <div key={r.id} onClick={() => setSelectedSavedRouteId(r.id)} className={`w-full group text-left p-4 rounded-[32px] border transition-all cursor-pointer ${selectedSavedRouteId === r.id ? 'border-blue-500 bg-blue-50/30' : 'border-zinc-100 bg-white hover:border-zinc-300 shadow-sm'}`}>
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg overflow-hidden relative" style={{ backgroundColor: r.color || '#3b82f6' }}>
                                <Badge className="bg-white/20 border-none text-[10px] font-black">{r.id.slice(0, 3)}</Badge>
                             </div>
                             <div>
                                <h4 className="font-black text-sm text-zinc-900 tracking-tight">{r.id}</h4>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate max-w-[140px]">{r.name}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <div className="flex items-center gap-1.5 mb-1">
                                <div className={`w-2 h-2 rounded-full ${activeBusCountsByRoute[r.id] ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-200'}`} />
                                <span className="text-[10px] font-black uppercase text-zinc-400">{activeBusCountsByRoute[r.id] || 0} Online</span>
                             </div>
                             <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block">{r.stops.length} STOPS</div>
                          </div>
                       </div>

                       {selectedSavedRouteId === r.id && (
                          <div className="mt-4 pt-4 border-t border-zinc-200/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                             <div className="flex gap-2">
                                <Button onClick={() => loadRouteIntoEditor(r)} size="sm" className="flex-1 rounded-2xl bg-zinc-900 hover:bg-black font-black text-[10px] h-9">
                                   <Pencil className="w-3 h-3 mr-2" /> EDIT LINE
                                </Button>
                                <Button onClick={deleteRoute} variant="destructive" size="sm" className="rounded-2xl font-black text-[10px] h-9">
                                   <Trash2 className="w-3 h-3" />
                                </Button>
                             </div>
                             <div className="space-y-2">
                                {r.stops.map((s, idx) => (
                                   <div key={idx} className="flex items-center gap-3 py-1">
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.color }} />
                                      <span className="text-[11px] font-bold text-zinc-700 truncate">{s.name}</span>
                                      <span className="ml-auto text-[9px] font-black text-zinc-300">+{s.timeFromStart} M</span>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}
                    </div>
                 ))}
              </CardContent>
           </Card>
        </div>

        {/* Right Column: Route Builder */}
        <div className="lg:col-span-4">
           <Card className="shadow-2xl border-none rounded-[40px] bg-white h-full flex flex-col overflow-hidden">
              <CardHeader className="bg-zinc-900 text-white pb-8 relative">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="bg-blue-600 p-2 rounded-xl">
                       <TrendingUp className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-xl font-black">{editingRouteId ? 'Update Architecture' : 'Route Architect'}</CardTitle>
                 </div>
                 <CardDescription className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">Global Route Seeker & Mapper</CardDescription>
                 <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-600/10 blur-[40px] -mr-16 -mb-16" />
              </CardHeader>
              
              <CardContent className="p-6 space-y-6 flex-1 flex flex-col">
                 
                 {/* Identity Info */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Route ID</label>
                       <Input value={routeId} onChange={e => setRouteId(e.target.value)} placeholder="285M" className="rounded-2xl border-zinc-100 h-12 font-black uppercase text-lg" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Color Token</label>
                       <div className="flex items-center gap-2">
                          <Input type="color" value={routeColor} onChange={e => setRouteColor(e.target.value)} className="w-12 h-12 p-1.5 rounded-2xl border-zinc-100" />
                          <div className="flex-1 bg-zinc-50 h-12 rounded-2xl flex items-center px-4 font-black text-[11px] border border-zinc-100 text-zinc-500">{routeColor.toUpperCase()}</div>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Description</label>
                    <div className="relative">
                       <Input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Rajanukunte to Majestic" className="rounded-2xl border-zinc-100 h-12 font-bold pr-12" />
                       <Button onClick={parseRouteNameAuto} variant="ghost" size="icon" className="absolute right-2 top-2 h-8 w-8 rounded-xl hover:bg-zinc-100">
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                       </Button>
                    </div>
                 </div>

                 {/* Stop Placement */}
                 <div className="space-y-3 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Timeline Constructor</h3>
                       <Badge variant="outline" className="rounded-full font-black text-[9px] px-3">{stops.length} STOPS</Badge>
                    </div>

                    <div className="relative z-50">
                       <LocationSearchInput 
                          placeholder="Search landmark or stop..." 
                          onLocationSelect={handleAddStop}
                          icon={<MapPin className="w-4 h-4 text-blue-600" />}
                       />
                    </div>

                    <div className="flex-1 overflow-y-auto mt-2 min-h-[200px] relative">
                       {stops.length > 0 ? (
                         <div className="space-y-4 pl-4 py-2 mt-4">
                            <div className="absolute left-[20px] top-4 bottom-4 w-1 bg-zinc-100 rounded-full" />
                            {stops.map((s, idx) => (
                               <div key={idx} className="relative flex items-center justify-between gap-4 group">
                                  <div className="flex items-center gap-4 flex-1">
                                     <div className="w-4 h-4 rounded-full border-2 border-white shadow-md relative z-10 transition-transform group-hover:scale-125" style={{ backgroundColor: idx === 0 ? '#22c55e' : (idx === stops.length - 1 ? '#ef4444' : routeColor) }} />
                                     <div className="flex-1 bg-zinc-50 border border-zinc-100 p-4 rounded-3xl group-hover:border-blue-200 transition-colors">
                                        <h4 className="text-xs font-black text-zinc-900 truncate">{s.name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                          <Clock className="w-3 h-3 text-zinc-300" />
                                          <span className="text-[10px] font-black text-zinc-400">+{s.timeFromStart} MINS</span>
                                        </div>
                                     </div>
                                  </div>
                                  <Button onClick={() => handleRemoveStop(idx)} variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                     <Trash2 className="w-4 h-4" />
                                  </Button>
                               </div>
                            ))}
                         </div>
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-8 border-4 border-dashed border-zinc-50 rounded-[40px]">
                            <MapPin className="w-12 h-12 mb-4" />
                            <p className="text-xs font-black uppercase tracking-widest leading-relaxed">Map is currently empty. Seek landmarks above.</p>
                         </div>
                       )}
                    </div>
                 </div>

                 <Button onClick={saveRoute} disabled={isSaving || stops.length < 2 || !routeId} className="w-full h-16 rounded-[24px] bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-2xl shadow-blue-600/20 active:scale-95 transition-all">
                    {isSaving ? 'Synchronizing...' : (editingRouteId ? 'Update Global Route' : 'Publish Network Branch')}
                 </Button>

                 {editingRouteId && (
                   <Button onClick={resetEditor} variant="outline" className="w-full rounded-2xl h-12 font-bold border-zinc-200">
                      Cancel Architect Mode
                   </Button>
                 )}
              </CardContent>
           </Card>
        </div>

      </main>

      {/* Admin Branding */}
      <footer className="py-12 border-t border-zinc-100 text-center bg-white/50 backdrop-blur-sm mt-12">
         <p className="text-[9px] font-black text-zinc-300 uppercase tracking-[0.5em]">
           LiveBus Tracker Core Command System &copy; 2026 | Restricted Access
         </p>
      </footer>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <RequireRole allowedRoles={['admin']}>
      <AdminDashboardContent />
    </RequireRole>
  );
}
