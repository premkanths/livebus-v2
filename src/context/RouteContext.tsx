"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { routes as defaultRoutes } from '@/lib/routes';

export interface Stop {
  name: string;
  lat: number;
  lng: number;
  timeFromStart?: number;
}

export interface Route {
  id: string;
  name: string;
  stops: Stop[];
  color: string;
}

export interface MatchingRoute {
  route: Route;
  sourceStop: Stop;
  destStop: Stop;
  stopsToTravel: number;
  estimatedDurationMins: number;
}

interface RouteContextType {
  routes: Route[];
  loading: boolean;
  findMatchingRoutes: (sourceLat: number, sourceLng: number, destLat: number, destLng: number, maxDistanceKm?: number) => MatchingRoute[];
  findLenientMatchingRoutes: (sourceLat: number | null, sourceLng: number | null, destLat: number | null, destLng: number | null, maxDistanceKm?: number) => MatchingRoute[];
}

const RouteContext = createContext<RouteContextType>({
  routes: [],
  loading: true,
  findMatchingRoutes: () => [],
  findLenientMatchingRoutes: () => [],
});

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export const RouteProvider = ({ children }: { children: React.ReactNode }) => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'routes'), 
      (snapshot) => {
        const firestoreRoutes: Route[] = [];
        snapshot.forEach((doc) => {
          firestoreRoutes.push({ id: doc.id, ...doc.data() } as Route);
        });

        // Merge logic: Default routes are the base, Firestore routes potentially override them
        const mergedRoutesMap = new Map<string, Route>();
        
        // 1. Add all default routes first
        defaultRoutes.forEach(r => mergedRoutesMap.set(r.id, r));
        
        // 2. Add/Override with Firestore routes
        firestoreRoutes.forEach(r => mergedRoutesMap.set(r.id, r));

        setRoutes(Array.from(mergedRoutesMap.values()));
        setLoading(false);
      },
      (error) => {
        console.warn('Firestore routes listener failed (likely permission denied):', error.message);
        // Fallback to default routes if we can't load from Firestore
        if (routes.length === 0) {
          setRoutes(defaultRoutes);
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const findMatchingRoutes = (sourceLat: number, sourceLng: number, destLat: number, destLng: number, maxDistanceKm = 5): MatchingRoute[] => {
    const matchingRoutes: MatchingRoute[] = [];

    for (const route of routes) {
      let sourceStopIndex = -1;
      let destStopIndex = -1;

      let minSourceDist = maxDistanceKm;
      for (let i = 0; i < route.stops.length; i++) {
        const dist = getDistanceFromLatLonInKm(sourceLat, sourceLng, route.stops[i].lat, route.stops[i].lng);
        if (dist < minSourceDist) {
          minSourceDist = dist;
          sourceStopIndex = i;
        }
      }

      let minDestDist = maxDistanceKm;
      for (let i = 0; i < route.stops.length; i++) {
        const dist = getDistanceFromLatLonInKm(destLat, destLng, route.stops[i].lat, route.stops[i].lng);
        if (dist < minDestDist) {
          minDestDist = dist;
          destStopIndex = i;
        }
      }

      if (sourceStopIndex !== -1 && destStopIndex !== -1 && sourceStopIndex < destStopIndex) {
        matchingRoutes.push({
          route,
          sourceStop: route.stops[sourceStopIndex],
          destStop: route.stops[destStopIndex],
          stopsToTravel: destStopIndex - sourceStopIndex,
          estimatedDurationMins: (route.stops[destStopIndex].timeFromStart || 0) - (route.stops[sourceStopIndex].timeFromStart || 0)
        });
      }
    }
    return matchingRoutes;
  };

  const findLenientMatchingRoutes = (sourceLat: number | null, sourceLng: number | null, destLat: number | null, destLng: number | null, maxDistanceKm = 5): MatchingRoute[] => {
    const matchingRoutes: MatchingRoute[] = [];

    for (const route of routes) {
      let sourceStopIndex = -1;
      let destStopIndex = -1;

      // Check for source match
      if (sourceLat !== null && sourceLng !== null) {
        let minSourceDist = maxDistanceKm;
        for (let i = 0; i < route.stops.length; i++) {
          const dist = getDistanceFromLatLonInKm(sourceLat, sourceLng, route.stops[i].lat, route.stops[i].lng);
          if (dist < minSourceDist) {
            minSourceDist = dist;
            sourceStopIndex = i;
          }
        }
      }

      // Check for dest match
      if (destLat !== null && destLng !== null) {
        let minDestDist = maxDistanceKm;
        for (let i = 0; i < route.stops.length; i++) {
          const dist = getDistanceFromLatLonInKm(destLat, destLng, route.stops[i].lat, route.stops[i].lng);
          if (dist < minDestDist) {
            minDestDist = dist;
            destStopIndex = i;
          }
        }
      }

      // Lenient Logic:
      // If we have both, must be in order
      if (sourceStopIndex !== -1 && destStopIndex !== -1) {
        if (sourceStopIndex < destStopIndex) {
          matchingRoutes.push({
            route,
            sourceStop: route.stops[sourceStopIndex],
            destStop: route.stops[destStopIndex],
            stopsToTravel: destStopIndex - sourceStopIndex,
            estimatedDurationMins: (route.stops[destStopIndex].timeFromStart || 0) - (route.stops[sourceStopIndex].timeFromStart || 0)
          });
        }
      } 
      // If we only have source, assume going to the end of the route
      else if (sourceStopIndex !== -1 && (destLat === null || destLng === null)) {
        const lastIdx = route.stops.length - 1;
        if (sourceStopIndex < lastIdx) {
          matchingRoutes.push({
            route,
            sourceStop: route.stops[sourceStopIndex],
            destStop: route.stops[lastIdx],
            stopsToTravel: lastIdx - sourceStopIndex,
            estimatedDurationMins: (route.stops[lastIdx].timeFromStart || 0) - (route.stops[sourceStopIndex].timeFromStart || 0)
          });
        }
      }
      // If we only have destination, assume coming from the start of the route
      else if (destStopIndex !== -1 && (sourceLat === null || sourceLng === null)) {
        if (destStopIndex > 0) {
          matchingRoutes.push({
            route,
            sourceStop: route.stops[0],
            destStop: route.stops[destStopIndex],
            stopsToTravel: destStopIndex,
            estimatedDurationMins: route.stops[destStopIndex].timeFromStart || 0
          });
        }
      }
    }
    return matchingRoutes;
  };

  return (
    <RouteContext.Provider value={{ routes, loading, findMatchingRoutes, findLenientMatchingRoutes }}>
      {children}
    </RouteContext.Provider>
  );
};

export const useRoutes = () => useContext(RouteContext);
