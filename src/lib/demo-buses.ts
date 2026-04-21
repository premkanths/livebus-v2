import { Route } from "@/context/RouteContext";

export interface DemoBusConfig {
  id: string;
  routeId: string;
  vehicleNumber: string;
  driverName: string;
  seedOffsetMinutes: number;
  cadenceMinutes: number;
  createdAt: string;
  createdBy?: string;
  isDemo: true;
}

export interface SimulatedBusData {
  id: string;
  driverId: string;
  driverName: string;
  vehicleNumber: string;
  routeId: string;
  location: { lat: number; lng: number };
  updatedAt: string;
  status: "active";
  isDemo: true;
}

const BUS_SERIES = [
  "KA-50-F-",
  "KA-04-D-",
  "KA-03-C-",
  "KA-53-M-",
  "KA-57-T-",
];

export function createDemoFleetConfigs(
  routes: Route[],
  countPerRoute = 5,
  createdBy?: string
): DemoBusConfig[] {
  const generatedAt = new Date().toISOString();

  return routes.flatMap((route, routeIndex) =>
    Array.from({ length: countPerRoute }, (_, busIndex) => {
      const serial = routeIndex * countPerRoute + busIndex + 1;
      const prefix = BUS_SERIES[serial % BUS_SERIES.length];
      const cadenceMinutes = getCadenceMinutes(route, busIndex);

      return {
        id: `demo-${route.id.toLowerCase()}-${busIndex + 1}`,
        routeId: route.id,
        vehicleNumber: `${prefix}${String(1200 + serial).padStart(4, "0")}`,
        driverName: `Demo Driver ${routeIndex + 1}-${busIndex + 1}`,
        seedOffsetMinutes: routeIndex * 11 + busIndex * 7,
        cadenceMinutes,
        createdAt: generatedAt,
        createdBy,
        isDemo: true as const,
      };
    })
  );
}

export function buildSimulatedBuses(
  configs: DemoBusConfig[],
  routes: Route[],
  now = Date.now()
): SimulatedBusData[] {
  return configs
    .map((config) => {
      const route = routes.find((candidate) => candidate.id === config.routeId);
      if (!route || route.stops.length < 2) return null;

      const location = getBusLocationForTime(route, config, now);
      return {
        id: config.id,
        driverId: config.id,
        driverName: config.driverName,
        vehicleNumber: config.vehicleNumber,
        routeId: config.routeId,
        location,
        updatedAt: new Date(now).toISOString(),
        status: "active" as const,
        isDemo: true as const,
      };
    })
    .filter((bus): bus is SimulatedBusData => bus !== null);
}

function getBusLocationForTime(route: Route, config: DemoBusConfig, now: number) {
  const stops = route.stops;
  const finalStopMinutes = Math.max(stops[stops.length - 1]?.timeFromStart || 0, 1);
  const forwardDuration = Math.max(finalStopMinutes, config.cadenceMinutes);
  const cycleDuration = forwardDuration * 2;
  const nowMinutes = now / 60000;
  const phase = positiveModulo(nowMinutes + config.seedOffsetMinutes, cycleDuration);
  const outbound = phase <= forwardDuration;
  const progressMinutes = outbound ? phase : cycleDuration - phase;
  const effectiveStops = outbound ? stops : [...stops].reverse();
  const normalizedStops = normalizeStops(effectiveStops);

  if (progressMinutes <= normalizedStops[0].timeFromStart) {
    return { lat: normalizedStops[0].lat, lng: normalizedStops[0].lng };
  }

  for (let index = 1; index < normalizedStops.length; index += 1) {
    const previousStop = normalizedStops[index - 1];
    const currentStop = normalizedStops[index];

    if (progressMinutes <= currentStop.timeFromStart) {
      const segmentDuration = Math.max(currentStop.timeFromStart - previousStop.timeFromStart, 1);
      const segmentProgress =
        (progressMinutes - previousStop.timeFromStart) / segmentDuration;

      return {
        lat: interpolate(previousStop.lat, currentStop.lat, segmentProgress),
        lng: interpolate(previousStop.lng, currentStop.lng, segmentProgress),
      };
    }
  }

  const lastStop = normalizedStops[normalizedStops.length - 1];
  return { lat: lastStop.lat, lng: lastStop.lng };
}

function normalizeStops(stops: Route["stops"]) {
  const base = stops[0]?.timeFromStart || 0;
  return stops.map((stop) => ({
    ...stop,
    timeFromStart: Math.max((stop.timeFromStart || 0) - base, 0),
  }));
}

function getCadenceMinutes(route: Route, busIndex: number) {
  const tripMinutes = route.stops[route.stops.length - 1]?.timeFromStart || 20;
  return Math.max(18, Math.round(tripMinutes + busIndex * 1.5));
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}
