"use client";

import { Gauge, Users, Waves } from "lucide-react";
import { ShowcasePageShell } from "@/components/ShowcasePageShell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const crowdRows = [
  { bus: "PU-102", route: "Hebbal to Presidency", load: 72 },
  { bus: "PU-103", route: "Yelahanka to Presidency", load: 58 },
  { bus: "PU-109", route: "KR Puram to Presidency", load: 81 },
  { bus: "PU-112", route: "Campus Shuttle", load: 36 },
];

export default function BusCrowdPage() {
  return (
    <ShowcasePageShell
      title="Bus Capacity"
      eyebrow="Frontend Demo Page"
      description="A predictive occupancy page showing crowd level, likely seat availability, and rush-hour suggestions for students."
    >
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <Card className="rounded-[28px] p-6">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-black text-zinc-900">Peak Hour Insight</h3>
            </div>
            <p className="mt-4 text-sm text-zinc-600">Morning rush between 6:45 AM and 7:25 AM is the highest load window for Presidency routes.</p>
          </Card>

          <Card className="rounded-[28px] p-6">
            <div className="flex items-center gap-3">
              <Waves className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-black text-zinc-900">Recommendation</h3>
            </div>
            <p className="mt-4 text-sm text-zinc-600">If your stop has two route options, the app can suggest the less crowded bus automatically.</p>
          </Card>
        </div>

        <Card className="rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-black text-zinc-900">Live Occupancy Estimate</h3>
          </div>

          <div className="mt-5 space-y-4">
            {crowdRows.map((row) => (
              <div key={row.bus} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-zinc-900">{row.bus}</p>
                    <p className="text-xs text-zinc-500">{row.route}</p>
                  </div>
                  <span className="text-sm font-black text-zinc-800">{row.load}% full</span>
                </div>
                <Progress value={row.load} className="h-3" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </ShowcasePageShell>
  );
}
