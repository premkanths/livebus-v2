"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useRoutes } from "@/context/RouteContext";
import { buildSimulatedBuses, DemoBusConfig } from "@/lib/demo-buses";
import { 
  Bus, 
  MapPinned, 
  Search, 
  Activity, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  Wifi,
  Filter,
  RefreshCw,
  Navigation
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
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
  isDemo?: boolean;
}

export default function AllBusesPage() {
  const { routes } = useRoutes();
  const [buses, setBuses] = useState<BusData[]>([]);
  const [demoBusConfigs, setDemoBusConfigs] = useState<DemoBusConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Real-time clock for freshness
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Listen to live buses
  useEffect(() => {
    const q = query(collection(db, 'buses'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const busList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusData));
      setBuses(busList);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to demo configs
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'demoBuses'), (snapshot) => {
      setDemoBusConfigs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DemoBusConfig)));
    });
    return () => unsubscribe();
  }, []);

  const demoBuses = useMemo(
    () => buildSimulatedBuses(demoBusConfigs, routes, now),
    [demoBusConfigs, routes, now]
  );

  const allBuses = useMemo(() => {
    return [...buses, ...demoBuses];
  }, [buses, demoBuses]);

  const filteredBuses = allBuses.filter(bus => 
    bus.routeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bus.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bus.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRouteName = (routeId?: string) => {
    return routes.find(r => r.id === routeId)?.name || "Unknown Route";
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-outfit">
      <DashboardHeader title="Fleet Overview" />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-600 font-black uppercase tracking-widest text-xs">
              <Activity className="w-4 h-4" />
              Live Fleet Status
            </div>
            <h1 className="text-4xl font-black text-zinc-900 tracking-tight">Active Buses</h1>
            <p className="text-zinc-500 font-medium">Monitoring {allBuses.length} vehicles across {routes.length} campus routes.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-600 transition-colors" />
              <Input 
                placeholder="Search by Route or Driver..." 
                className="pl-11 pr-4 h-12 w-full md:w-[320px] rounded-2xl bg-white border-none shadow-sm focus-visible:ring-blue-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="h-12 w-12 rounded-2xl border-none shadow-sm bg-white hover:bg-zinc-100">
              <Filter className="w-5 h-5 text-zinc-600" />
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Now", value: allBuses.length, icon: Wifi, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Total Routes", value: routes.length, icon: Navigation, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Live Drivers", value: buses.length, icon: ShieldCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Simulated", value: demoBuses.length, icon: RefreshCw, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[32px] border border-zinc-100 shadow-sm space-y-2">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-black text-zinc-900">{stat.value}</div>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bus List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="font-bold text-zinc-400 uppercase tracking-widest text-xs">Synchronizing Live Fleet...</p>
          </div>
        ) : filteredBuses.length === 0 ? (
          <div className="bg-white rounded-[40px] p-16 text-center border border-zinc-100 shadow-sm space-y-4">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
              <Bus className="w-10 h-10 text-zinc-200" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">No matching buses found</h3>
            <p className="text-zinc-500 max-w-sm mx-auto">Try searching for a different route ID or driver name to see results.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBuses.map((bus) => (
              <Card key={bus.id} className="rounded-[40px] p-8 border border-zinc-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden bg-white">
                <div className="relative z-10 space-y-6">
                  {/* Card Header */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-lg bg-blue-50 text-blue-700 border-blue-100 font-black uppercase text-[10px] py-1 px-2">
                          Route {bus.routeId}
                        </Badge>
                        {bus.isDemo && (
                          <Badge variant="outline" className="rounded-lg bg-amber-50 text-amber-700 border-amber-100 font-black uppercase text-[10px] py-1 px-2">
                            Simulated
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-xl font-black text-zinc-900 leading-tight">
                        {getRouteName(bus.routeId)}
                      </h3>
                    </div>
                    <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Bus className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Driver Info */}
                  <div className="flex items-center gap-4 py-4 border-y border-zinc-50">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center font-bold text-zinc-400">
                      {bus.driverName[0]}
                    </div>
                    <div>
                      <div className="text-sm font-black text-zinc-900">{bus.driverName}</div>
                      <div className="text-xs font-medium text-zinc-500">{bus.vehicleNumber || `VH-${bus.id.slice(-4).toUpperCase()}`}</div>
                    </div>
                    <div className="ml-auto">
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Live</span>
                            </div>
                        </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-700">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        In Transit
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Last Update</div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-700">
                        <Clock className="w-4 h-4 text-blue-500" />
                        Active
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <Link href={`/dashboard/user?bus=${bus.id}`} className="block">
                    <Button className="w-full h-14 rounded-2xl bg-zinc-900 hover:bg-black text-white font-black group/btn">
                      Track On Map
                      <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-all" />
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-100 text-center">
         <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.3em]">
           Live Fleet Monitoring System &copy; 2026
         </p>
      </footer>
    </div>
  );
}
