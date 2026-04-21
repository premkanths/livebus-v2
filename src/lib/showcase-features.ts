import {
  BellRing,
  BusFront,
  CreditCard,
  History,
  ShieldAlert,
  Users,
} from "lucide-react";

export const showcaseFeatures = [
  {
    href: "/dashboard/user/smart-pass",
    title: "Smart Pass",
    description: "Digital ID, QR access, semester validity, and renewal flow.",
    icon: CreditCard,
    accent: "from-blue-500 to-cyan-500",
  },
  {
    href: "/dashboard/user/pickup-board",
    title: "Pickup Board",
    description: "Student pickup roster, stop timing board, and boarding windows.",
    icon: BusFront,
    accent: "from-emerald-500 to-lime-500",
  },
  {
    href: "/dashboard/user/alerts-center",
    title: "Alerts Center",
    description: "Arrival alerts, delay notices, route changes, and class-day reminders.",
    icon: BellRing,
    accent: "from-amber-500 to-orange-500",
  },
  {
    href: "/dashboard/user/safety",
    title: "SOS & Safety",
    description: "Emergency contacts, live bus sharing, and guardian alert workflow.",
    icon: ShieldAlert,
    accent: "from-rose-500 to-red-500",
  },
  {
    href: "/dashboard/user/trip-history",
    title: "Trip History",
    description: "Past rides, attendance logs, punctuality score, and route trends.",
    icon: History,
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    href: "/dashboard/user/bus-crowd",
    title: "Bus Crowd",
    description: "Occupancy estimate, seat availability, and rush-hour capacity view.",
    icon: Users,
    accent: "from-sky-500 to-indigo-500",
  },
];
