export interface RoutePath {
  coordinates: [number, number][]; // [lat, lng]
}

/**
 * Fetches a road-following route from OSRM between a sequence of stops.
 * @param stops An array of stops with lat and lng.
 * @returns A promise resolving to the route path coordinates.
 */
export async function fetchRoadFollowingRoute(stops: { lat: number; lng: number }[]): Promise<[number, number][]> {
  if (stops.length < 2) return [];

  const coordsString = stops.map(s => `${s.lng},${s.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.statusText}`);
    }
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('OSRM returned no routes, falling back to straight lines.');
      return stops.map(s => [s.lat, s.lng]);
    }

    // OSRM returns [lng, lat], we need [lat, lng] for Leaflet
    const path: [number, number][] = data.routes[0].geometry.coordinates.map(
      (coord: [number, number]) => [coord[1], coord[0]]
    );

    return path;
  } catch (error) {
    console.error('Failed to fetch road-following route:', error);
    // Fallback to straight lines between stops
    return stops.map(s => [s.lat, s.lng]);
  }
}
