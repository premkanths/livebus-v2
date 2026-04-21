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

const PRESIDENCY = {
  name: "Presidency University",
  lat: 13.1704,
  lng: 77.5662,
};

export const routes: Route[] = [
  {
    id: "PU-101",
    name: "Majestic to Presidency University",
    color: "#2563eb",
    stops: [
      { name: "Majestic", lat: 12.9763, lng: 77.5712, timeFromStart: 0 },
      { name: "Mekhri Circle", lat: 13.0215, lng: 77.5946, timeFromStart: 12 },
      { name: "Hebbal", lat: 13.0352, lng: 77.597, timeFromStart: 18 },
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 30 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 42 },
      { ...PRESIDENCY, timeFromStart: 45 }
    ]
  },
  {
    id: "PU-102",
    name: "Hebbal to Presidency University",
    color: "#16a34a",
    stops: [
      { name: "Hebbal", lat: 13.0352, lng: 77.597, timeFromStart: 0 },
      { name: "Kodigehalli", lat: 13.0516, lng: 77.5794, timeFromStart: 8 },
      { name: "Yelahanka New Town", lat: 13.0977, lng: 77.5963, timeFromStart: 18 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 30 },
      { ...PRESIDENCY, timeFromStart: 34 }
    ]
  },
  {
    id: "PU-103",
    name: "Yelahanka to Presidency University",
    color: "#0ea5e9",
    stops: [
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 0 },
      { name: "Chikkabommasandra", lat: 13.0735, lng: 77.57, timeFromStart: 8 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 18 },
      { ...PRESIDENCY, timeFromStart: 22 }
    ]
  },
  {
    id: "PU-104",
    name: "Jakkur to Presidency University",
    color: "#7c3aed",
    stops: [
      { name: "Jakkur", lat: 13.0722, lng: 77.6013, timeFromStart: 0 },
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 10 },
      { name: "Kogilu Cross", lat: 13.1284, lng: 77.6015, timeFromStart: 18 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 28 },
      { ...PRESIDENCY, timeFromStart: 31 }
    ]
  },
  {
    id: "PU-105",
    name: "Kempegowda Airport to Presidency University",
    color: "#f59e0b",
    stops: [
      { name: "Kempegowda Airport", lat: 13.1986, lng: 77.7066, timeFromStart: 0 },
      { name: "Kannamangala Gate", lat: 13.1818, lng: 77.6633, timeFromStart: 12 },
      { name: "Yelahanka Air Force Station", lat: 13.1364, lng: 77.6116, timeFromStart: 24 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 38 },
      { ...PRESIDENCY, timeFromStart: 42 }
    ]
  },
  {
    id: "PU-106",
    name: "Devanahalli to Presidency University",
    color: "#ef4444",
    stops: [
      { name: "Devanahalli", lat: 13.2422, lng: 77.7132, timeFromStart: 0 },
      { name: "Airport Trumpet", lat: 13.1994, lng: 77.7058, timeFromStart: 10 },
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 28 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 40 },
      { ...PRESIDENCY, timeFromStart: 44 }
    ]
  },
  {
    id: "PU-107",
    name: "Doddaballapura to Presidency University",
    color: "#06b6d4",
    stops: [
      { name: "Doddaballapura", lat: 13.2945, lng: 77.5378, timeFromStart: 0 },
      { name: "Bashettihalli", lat: 13.2308, lng: 77.5402, timeFromStart: 14 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 26 },
      { ...PRESIDENCY, timeFromStart: 30 }
    ]
  },
  {
    id: "PU-108",
    name: "Peenya to Presidency University",
    color: "#db2777",
    stops: [
      { name: "Peenya", lat: 13.0329, lng: 77.5273, timeFromStart: 0 },
      { name: "Yeshwanthpur", lat: 13.028, lng: 77.554, timeFromStart: 8 },
      { name: "Hebbal", lat: 13.0352, lng: 77.597, timeFromStart: 18 },
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 28 },
      { ...PRESIDENCY, timeFromStart: 42 }
    ]
  },
  {
    id: "PU-109",
    name: "KR Puram to Presidency University",
    color: "#14b8a6",
    stops: [
      { name: "KR Puram", lat: 13.0077, lng: 77.695, timeFromStart: 0 },
      { name: "Tin Factory", lat: 13.0279, lng: 77.6616, timeFromStart: 8 },
      { name: "Nagawara", lat: 13.0423, lng: 77.62, timeFromStart: 18 },
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 30 },
      { ...PRESIDENCY, timeFromStart: 44 }
    ]
  },
  {
    id: "PU-110",
    name: "Whitefield to Presidency University",
    color: "#8b5cf6",
    stops: [
      { name: "Whitefield", lat: 12.9698, lng: 77.75, timeFromStart: 0 },
      { name: "Marathahalli", lat: 12.9591, lng: 77.6974, timeFromStart: 12 },
      { name: "Nagawara", lat: 13.0423, lng: 77.62, timeFromStart: 28 },
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 40 },
      { ...PRESIDENCY, timeFromStart: 54 }
    ]
  },
  {
    id: "PU-111",
    name: "Manyata Tech Park to Presidency University",
    color: "#f97316",
    stops: [
      { name: "Manyata Tech Park", lat: 13.0475, lng: 77.62, timeFromStart: 0 },
      { name: "Thanisandra", lat: 13.0545, lng: 77.6336, timeFromStart: 6 },
      { name: "Kogilu", lat: 13.1234, lng: 77.6035, timeFromStart: 18 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 28 },
      { ...PRESIDENCY, timeFromStart: 32 }
    ]
  },
  {
    id: "PU-112",
    name: "Rajankunte to Presidency University Shuttle",
    color: "#65a30d",
    stops: [
      { name: "Rajanukunte Railway Gate", lat: 13.1672, lng: 77.5554, timeFromStart: 0 },
      { name: "Rajanukunte Circle", lat: 13.1686, lng: 77.5601, timeFromStart: 3 },
      { name: "Presidency Boys Hostel", lat: 13.1718, lng: 77.5638, timeFromStart: 6 },
      { ...PRESIDENCY, timeFromStart: 10 }
    ]
  },
  {
    id: "PU-113",
    name: "Presidency University to Hebbal",
    color: "#3b82f6",
    stops: [
      { ...PRESIDENCY, timeFromStart: 0 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 4 },
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 16 },
      { name: "Hebbal", lat: 13.0352, lng: 77.597, timeFromStart: 28 }
    ]
  },
  {
    id: "PU-114",
    name: "Presidency University to Majestic",
    color: "#10b981",
    stops: [
      { ...PRESIDENCY, timeFromStart: 0 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 4 },
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 16 },
      { name: "Hebbal", lat: 13.0352, lng: 77.597, timeFromStart: 28 },
      { name: "Mekhri Circle", lat: 13.0215, lng: 77.5946, timeFromStart: 34 },
      { name: "Majestic", lat: 12.9763, lng: 77.5712, timeFromStart: 46 }
    ]
  },
  {
    id: "PU-115",
    name: "Presidency University Circular",
    color: "#e11d48",
    stops: [
      { ...PRESIDENCY, timeFromStart: 0 },
      { name: "Rajanukunte", lat: 13.1686, lng: 77.5601, timeFromStart: 4 },
      { name: "Avalahalli", lat: 13.1492, lng: 77.5764, timeFromStart: 10 },
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963, timeFromStart: 20 },
      { name: "Kogilu Cross", lat: 13.1284, lng: 77.6015, timeFromStart: 28 },
      { ...PRESIDENCY, timeFromStart: 38 }
    ]
  }
];

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

export function findMatchingRoutes(sourceLat: number, sourceLng: number, destLat: number, destLng: number, maxDistanceKm = 5) {
  const matchingRoutes = [];

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
}
