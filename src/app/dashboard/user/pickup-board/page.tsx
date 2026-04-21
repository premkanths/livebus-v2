"use client";

import { Clock3, MapPin, Users } from "lucide-react";
import { ShowcasePageShell } from "@/components/ShowcasePageShell";
import { Card } from "@/components/ui/card";

const pickupRows = [
  ["Hebbal", "6:45 AM", "18 students", "Bus PU-102"],
  ["Yelahanka", "7:05 AM", "22 students", "Bus PU-103"],
  ["Jakkur", "7:00 AM", "14 students", "Bus PU-104"],
  ["Manyata Tech Park", "6:50 AM", "11 students", "Bus PU-111"],
  ["KR Puram", "6:35 AM", "16 students", "Bus PU-109"],
];

export default function PickupBoardPage() {
  return (
    <ShowcasePageShell
      title="Pickup Board"
      eyebrow="Frontend Demo Page"
      description="A live-style pickup operations board showing stop roster, planned bus, expected boarding count, and student-facing reporting."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[28px] p-6">
          <h3 className="text-lg font-black text-zinc-900">Morning Boarding Summary</h3>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-[0.18em]">Campus Destination</span>
              </div>
              <p className="mt-2 text-xl font-black text-zinc-900">Presidency University Main Gate</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Stops</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">15</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Expected Riders</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">214</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-[28px] p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-zinc-900">Pickup Timeline Board</h3>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Auto assigned</span>
          </div>
          <div className="mt-5 space-y-3">
            {pickupRows.map(([stop, time, count, bus]) => (
              <div key={stop} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-zinc-900">{stop}</p>
                    <p className="mt-1 text-xs font-bold text-zinc-500">{bus}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-amber-600">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span className="text-xs font-black">{time}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1 text-zinc-500">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">{count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </ShowcasePageShell>
  );
}
