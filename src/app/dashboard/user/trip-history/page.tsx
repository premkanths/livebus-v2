"use client";

import { BarChart3, CalendarDays, Clock3, History } from "lucide-react";
import { ShowcasePageShell } from "@/components/ShowcasePageShell";
import { Card } from "@/components/ui/card";

const trips = [
  ["Apr 17", "Hebbal to Presidency", "On time", "7:42 AM"],
  ["Apr 16", "Yelahanka to Presidency", "3 min late", "7:51 AM"],
  ["Apr 15", "Presidency to Majestic", "On time", "4:38 PM"],
  ["Apr 14", "KR Puram to Presidency", "5 min late", "8:02 AM"],
];

export default function TripHistoryPage() {
  return (
    <ShowcasePageShell
      title="Trip History"
      eyebrow="Frontend Demo Page"
      description="A student history view for past rides, boarding attendance, punctuality, and route usage trends."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <Card className="rounded-[28px] p-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-black text-zinc-900">Monthly Summary</h3>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Trips Taken</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">38</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Punctuality</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">92%</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] p-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-black text-zinc-900">Attendance Link</h3>
            </div>
            <p className="mt-4 text-sm text-zinc-600">
              Boarding scan can be tied to morning attendance validation for transport-managed students.
            </p>
          </Card>
        </div>

        <Card className="rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-black text-zinc-900">Recent Trips</h3>
          </div>
          <div className="mt-5 space-y-3">
            {trips.map(([date, route, status, time]) => (
              <div key={`${date}-${route}`} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-zinc-900">{route}</p>
                    <p className="mt-1 text-xs text-zinc-500">{date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-zinc-700">{status}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-zinc-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">{time}</span>
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
