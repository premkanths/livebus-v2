"use client";

import { BellRing, CalendarClock, Siren, TriangleAlert } from "lucide-react";
import { ShowcasePageShell } from "@/components/ShowcasePageShell";
import { Card } from "@/components/ui/card";

const alerts = [
  { title: "Bus PU-102 arriving in 6 min", tone: "emerald", note: "Hebbal stop - be ready near gate 2" },
  { title: "Rain reroute active", tone: "amber", note: "Yelahanka internal road avoided this morning" },
  { title: "Class start reminder", tone: "blue", note: "First lecture begins at 8:30 AM, campus ETA is safe" },
  { title: "Emergency test notification", tone: "rose", note: "Demo-only safety broadcast for control room" },
];

export default function AlertsCenterPage() {
  return (
    <ShowcasePageShell
      title="Notifications Center"
      eyebrow="Frontend Demo Page"
      description="A dedicated student alert system for bus arrivals, delays, weather reroutes, and campus transport operations."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-black text-zinc-900">Today’s Live Alerts</h3>
          </div>
          <div className="mt-5 space-y-3">
            {alerts.map((alert) => (
              <div key={alert.title} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-black text-zinc-900">{alert.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{alert.note}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] p-6">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-violet-600" />
              <h3 className="text-lg font-black text-zinc-900">Scheduled Alerts</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600">
              <li>Boarding reminder 10 minutes before your selected stop.</li>
              <li>Campus arrival estimate before first class.</li>
              <li>Evening return-bus queue announcement after last hour.</li>
            </ul>
          </Card>

          <Card className="rounded-[28px] p-6">
            <div className="grid gap-4">
              <div className="rounded-2xl bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <TriangleAlert className="h-4 w-4" />
                  <span className="text-sm font-black">Delay Notice Engine</span>
                </div>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <Siren className="h-4 w-4" />
                  <span className="text-sm font-black">Emergency Broadcast Flow</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </ShowcasePageShell>
  );
}
