"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Marker Icon Issue
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface BusData {
  id: string;
  driverId: string;
  driverName: string;
  routeId?: string;
  location: { lat: number; lng: number };
  updatedAt: string;
  status: string;
}

interface Stop {
  name: string;
  lat: number;
  lng: number;
}

interface Route {
  id: string;
  name: string;
  stops: Stop[];
  color: string;
}

interface MapProps {
  buses?: BusData[];
  center: { lat: number; lng: number };
  route?: Route | null;
  polylinePoints?: [number, number][]; // Optional high-fidelity path
  userLocation?: { lat: number; lng: number } | null;
  focusKey?: number;
}

// Helper to update map center dynamically (for single points)
function ChangeView({ center, focusKey = 0 }: { center: { lat: number; lng: number }; focusKey?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], 16, {
      animate: true,
      duration: 1.5,
    });
  }, [center.lat, center.lng, focusKey, map]);
  return null;
}

// Helper to fit bounds to a route
function RouteFitter({ route, polylinePoints }: { route: Route | null; polylinePoints?: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (polylinePoints && polylinePoints.length > 0) {
      const bounds = L.latLngBounds(polylinePoints);
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    } else if (route && route.stops.length > 0) {
      const bounds = L.latLngBounds(route.stops.map(s => [s.lat, s.lng]));
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    }
  }, [route, polylinePoints, map]);
  return null;
}

// Helper to create a custom divIcon with Lucide Icon (Bus)
const createCustomIcon = () => {
  return L.divIcon({
    html: `<div style="background-color: #3b82f6; color: white; padding: 6px; border-radius: 50%; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); border: 2px solid white; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bus"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><path d="m7.1 18-1.3-4.1c-.2-.7-.9-1.2-1.7-1.2H2"/><path d="M9 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M19 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg></div>`,
    className: "custom-leaflet-icon",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

const createUserIcon = () => {
  return L.divIcon({
    html: `
      <div style="position: relative; width: 22px; height: 22px;">
        <div style="position: absolute; inset: 0; border-radius: 9999px; background: rgba(37, 99, 235, 0.22); transform: scale(1.8);"></div>
        <div style="position: absolute; inset: 4px; border-radius: 9999px; background: #2563eb; border: 3px solid white; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);"></div>
      </div>
    `,
    className: "custom-leaflet-user-icon",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
};

export default function Map({ buses = [], center, route, polylinePoints, userLocation, focusKey = 0 }: MapProps) {
  const markerRefs = useRef<{[key: string]: L.Marker}>({});

  useEffect(() => {
    // Attempt to automatically open the popup if a specific bus is provided and there's only 1 bus
    if (buses.length === 1 && markerRefs.current[buses[0].id]) {
      markerRefs.current[buses[0].id].openPopup();
    }
  }, [buses]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      minZoom={3}
      maxBounds={[[-90, -180], [90, 180]]}
      maxBoundsViscosity={1.0}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      zoomControl={false}
    >
      <ChangeView center={center} focusKey={focusKey} />
      <RouteFitter route={route || null} polylinePoints={polylinePoints} />
      
      <TileLayer
        noWrap={true}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      {route && (
        <Polyline 
          positions={polylinePoints && polylinePoints.length > 0 ? polylinePoints : route.stops.map(s => [s.lat, s.lng])} 
          pathOptions={{ color: route.color || '#3b82f6', weight: 5, opacity: 0.8 }} 
        />
      )}

      {route && route.stops.map((stop, idx) => (
        <CircleMarker
          key={"stop-" + idx}
          center={[stop.lat, stop.lng]}
          radius={6}
          pathOptions={{ color: 'white', fillColor: route.color || '#3b82f6', fillOpacity: 1, weight: 2 }}
        >
          <Popup>
            <div className="text-sm font-bold">{stop.name}</div>
          </Popup>
        </CircleMarker>
      ))}

      {userLocation && (
        <>
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={35}
            pathOptions={{
              color: "#2563eb",
              weight: 1,
              fillColor: "#2563eb",
              fillOpacity: 0.12,
            }}
          />
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={createUserIcon()}
            zIndexOffset={100}
          >
            <Popup>
               <div className="text-sm font-bold">You are here</div>
            </Popup>
          </Marker>
        </>
      )}

      {buses.map((bus) => (
        <Marker 
          key={bus.id} 
          position={[bus.location.lat, bus.location.lng]}
          icon={createCustomIcon()}
          ref={(ref) => {
            if (ref) {
              markerRefs.current[bus.id] = ref;
            }
          }}
        >
           <Popup>
             <div className="p-1 min-w-[120px]">
               <h3 className="font-bold text-sm !m-0 !mb-1 text-blue-600">{bus.driverName}</h3>
               <div className="flex items-center gap-1 text-[10px] text-gray-500 !m-0 !mt-1">
                 <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
                 Live Now
               </div>
               <p className="text-[10px] text-gray-500 !m-0 !mt-1">
                 Last seen: {new Date(bus.updatedAt).toLocaleTimeString()}
               </p>
             </div>
           </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
