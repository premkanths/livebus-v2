"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Route, useRoutes } from '@/context/RouteContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, updateDoc, Timestamp, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MapPin, LogOut, Trash2, BusFront, Route as RouteIcon, Activity, Search, RefreshCw, Clock, Pencil, XCircle, Shield, LayoutDashboard, Database, RefreshCcw } from 'lucide-react';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { GeocodingResult } from '@/lib/geocoding';
import { DashboardHeader } from '@/components/DashboardHeader';

interface DraftStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  timeFromStart: number;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function AdminDashboard() {
  const { signOut } = useAuth();
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

  useEffect(() => {
    if (!selectedSavedRouteId && routes.length > 0) {
      setSelectedSavedRouteId(routes[0].id);
    }

    if (selectedSavedRouteId && routes.length > 0 && !routes.some((route) => route.id === selectedSavedRouteId)) {
      setSelectedSavedRouteId(routes[0].id);
    }
  }, [routes, selectedSavedRouteId]);

  const resetEditor = () => {
    setRouteId('');
    setRouteName('');
    setRouteColor('#3b82f6');
    setStops([]);
    setEditingRouteId(null);
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
      const addMins = Math.round(distKm * 3);
      timeOffset = lastStop.timeFromStart + addMins;
    }

    setStops([
      ...stops,
      {
        id: Math.random().toString(),
        name: stopName,
        lat: loc.lat,
        lng: loc.lng,
        timeFromStart: timeOffset,
      },
    ]);
  };

  const handleRemoveStop = (idx: number) => {
    const newStops = [...stops];
    newStops.splice(idx, 1);

    for (let i = 1; i < newStops.length; i++) {
      const prev = newStops[i - 1];
      const curr = newStops[i];
      const distKm = getDistanceFromLatLonInKm(prev.lat, prev.lng, curr.lat, curr.lng);
      newStops[i].timeFromStart = prev.timeFromStart + Math.round(distKm * 3);
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
      toast({
        title: 'Incomplete',
        description: 'Please enter a Route ID and map at least 2 stops.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const cleanId = routeId.trim().toUpperCase().replace(/\s+/g, '');
      const finalRouteName = routeName || `${stops[0].name} to ${stops[stops.length - 1].name}`;

      const payload = {
        name: finalRouteName,
        color: routeColor,
        stops: stops.map((stop) => ({
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          timeFromStart: stop.timeFromStart,
        })),
      };

      await setDoc(doc(db, 'routes', cleanId), payload);

      toast({
        title: editingRouteId ? 'Route Updated' : 'Route Created',
        description: `Route ${cleanId} is now saved and visible across the system.`,
      });

      setSelectedSavedRouteId(cleanId);
      resetEditor();
    } catch (err: any) {
      toast({ title: 'Error Saving', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRoute = async () => {
    if (!selectedSavedRoute) return;

    const confirmed = window.confirm(`Delete route ${selectedSavedRoute.id}? This cannot be undone.`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'routes', selectedSavedRoute.id));
      toast({
        title: 'Route Deleted',
        description: `Route ${selectedSavedRoute.id} has been removed.`,
      });

      if (editingRouteId === selectedSavedRoute.id) {
        resetEditor();
      }
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err.message || 'Could not delete the route.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedSavedRoute = routes.find((route) => route.id === selectedSavedRouteId) || null;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <DashboardHeader title="Admin Control Center" />

      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-md border-0 bg-white">
            <CardHeader className="border-b bg-zinc-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <RouteIcon className="w-5 h-5 text-primary" />
                Route Identity
              </CardTitle>
              <CardDescription>
                {editingRouteId ? `Editing route ${editingRouteId}` : 'Establish a new operational bus line.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="routeId" className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Bus Number / ID</Label>
                <Input
                  id="routeId"
                  placeholder="e.g. 285M, V-500D"
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="font-mono text-lg h-12 uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="routeName" className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Route Description</Label>
                <div className="flex gap-2">
                  <Input
                    id="routeName"
                    placeholder="e.g. Rajanukunte to Majestic"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                  />
                  <Button variant="outline" size="icon" onClick={parseRouteNameAuto} title="Auto-fill from stops">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="routeColor" className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Route Color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="routeColor"
                    type="color"
                    value={routeColor}
                    onChange={(e) => setRouteColor(e.target.value)}
                    className="h-12 w-20 p-2"
                  />
                  <div className="flex items-center gap-2 rounded-full border bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700">
                    <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: routeColor }} />
                    {routeColor.toUpperCase()}
                  </div>
                </div>
              </div>
              {editingRouteId && (
                <Button variant="outline" className="w-full" onClick={resetEditor}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Clear Editor
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-0 bg-white flex flex-col h-[520px]">
            <CardHeader className="border-b bg-zinc-50/50 pb-3">
              <CardTitle className="flex items-center justify-between text-lg font-bold">
                <div className="flex items-center gap-2">
                  <BusFront className="w-5 h-5 text-zinc-500" />
                  Saved Routes
                </div>
                <div className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-xs">{routes.length} Active</div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-y-auto space-y-3 p-4">
              {routes.map((route) => (
                <button
                  type="button"
                  key={route.id}
                  onClick={() => setSelectedSavedRouteId(route.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selectedSavedRouteId === route.id
                      ? 'border-primary bg-primary/5'
                      : 'border-zinc-100 bg-zinc-50 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: route.color || '#3b82f6' }} />
                        <h4 className="font-bold text-zinc-900 leading-none">{route.id}</h4>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-1">{route.name}</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 bg-white border px-1.5 rounded-sm">{route.stops.length} Stops</span>
                    </div>
                  </div>

                  {selectedSavedRouteId === route.id && (
                    <div className="mt-3 border-t border-zinc-200 pt-3 space-y-2">
                      {route.stops.map((stop, stopIndex) => (
                        <div key={`${route.id}-${stopIndex}`} className="flex items-start gap-3 text-sm">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: route.color || '#3b82f6' }} />
                          <div className="flex-1">
                            <div className="font-medium text-zinc-800">{stop.name}</div>
                            <div className="text-xs text-zinc-500">
                              {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                              {typeof stop.timeFromStart === 'number' ? ` | +${stop.timeFromStart} mins` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
              {routes.length === 0 && (
                <div className="text-center text-zinc-400 text-sm mt-10">No routes established yet.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="shadow-md border-0 bg-white h-full flex flex-col">
            <CardHeader className="border-b bg-zinc-50/50 pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Stop Sequence</CardTitle>
                <CardDescription>
                  {editingRouteId ? 'Update stops, color, and route identity.' : 'Add linear stops from start to end.'}
                </CardDescription>
              </div>
              <div className="bg-zinc-100 px-3 py-1 rounded-full text-sm font-semibold border text-zinc-600">
                {stops.length} Stops
              </div>
            </CardHeader>
            <CardContent className="pt-6 flex-1 flex flex-col">
              {selectedSavedRoute && (
                <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest text-blue-700">Selected Saved Route</div>
                      <div className="mt-1 text-lg font-bold text-zinc-900">
                        {selectedSavedRoute.id} - {selectedSavedRoute.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-zinc-700 border">
                        <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: selectedSavedRoute.color || '#3b82f6' }} />
                        {selectedSavedRoute.color || '#3b82f6'}
                      </div>
                      <div className="text-sm text-blue-700 font-medium">
                        {selectedSavedRoute.stops.length} saved stops
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => loadRouteIntoEditor(selectedSavedRoute)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Route
                    </Button>
                    <Button type="button" variant="destructive" onClick={deleteRoute} disabled={isDeleting}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isDeleting ? 'Deleting...' : 'Delete Route'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="mb-8 z-50">
                <Label className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Map New Stop</Label>
                <div className="relative z-50">
                  <LocationSearchInput
                    placeholder="Search for bus stop or landmark..."
                    onLocationSelect={handleAddStop}
                    icon={<Search className="w-4 h-4 text-primary" />}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-[200px]">
                {stops.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 border-2 border-dashed rounded-xl p-8 mb-6">
                    <MapPin className="w-12 h-12 mb-3" />
                    <p className="font-medium text-lg">Timeline is empty</p>
                    <p className="text-sm text-center max-w-sm mt-1">Use the search box above to plot the first terminal stop.</p>
                  </div>
                ) : (
                  <div className="relative pl-4 space-y-6 mb-8 mt-2">
                    <div className="absolute left-[27px] top-4 bottom-4 w-1 bg-zinc-200 rounded-full" />
                    {stops.map((stop, idx) => {
                      const stopColor = idx === 0 ? '#22c55e' : idx === stops.length - 1 ? '#ef4444' : routeColor;

                      return (
                        <div key={stop.id} className="relative flex items-start gap-6 group">
                          <div className="flex flex-col items-center relative z-10 pt-1">
                            <div className="w-6 h-6 rounded-full border-4 border-white shadow-sm" style={{ backgroundColor: stopColor }} />
                          </div>
                          <div className="flex-1 bg-zinc-50 border group-hover:border-primary/30 transition-colors p-4 rounded-xl flex items-center gap-4">
                            <div className="flex-1">
                              <h4 className="font-bold text-zinc-900">{stop.name}</h4>
                              <div className="flex items-center gap-3 mt-1 opacity-70 flex-wrap">
                                <span className="text-xs font-mono bg-zinc-200 px-1.5 py-0.5 rounded">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 text-white" style={{ backgroundColor: routeColor }}>
                                  <Clock className="w-3 h-3" />
                                  +{stop.timeFromStart} mins
                                </span>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveStop(idx)} className="text-zinc-400 hover:text-red-500 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                onClick={saveRoute}
                disabled={isSaving || stops.length < 2 || !routeId}
                className="w-full h-14 text-lg font-bold shadow-xl mt-4"
              >
                {isSaving ? (editingRouteId ? 'Updating Route...' : 'Publishing Route...') : (editingRouteId ? 'UPDATE ROUTE' : 'PUBLISH PRODUCTION ROUTE')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
