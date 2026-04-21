"use client";

import { MapPinned, PhoneCall, ShieldCheck, Siren } from "lucide-react";
import { ShowcasePageShell } from "@/components/ShowcasePageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SafetyPage() {
  return (
    <ShowcasePageShell
      title="SOS & Safety"
      eyebrow="Frontend Demo Page"
      description="A safety-focused transport page showing guardian sharing, emergency escalation flow, and trusted campus transport support."
    >
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-[28px] border-0 bg-[linear-gradient(135deg,#991b1b_0%,#ef4444_100%)] p-6 text-white">
          <div className="flex items-center gap-3">
            <Siren className="h-6 w-6" />
            <h3 className="text-xl font-black">Emergency Support</h3>
          </div>
          <p className="mt-4 text-sm text-rose-50">
            One tap can send bus route, current coordinates, driver identity, and route number to selected guardians and the college transport office.
          </p>
          <div className="mt-6 space-y-3">
            <Button className="w-full rounded-2xl bg-white text-red-700 hover:bg-rose-50">Trigger SOS Demo</Button>
            <Button variant="outline" className="w-full rounded-2xl border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">Share live trip with guardian</Button>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-[28px] p-6">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h4 className="mt-4 text-lg font-black text-zinc-900">Trusted Driver Profile</h4>
            <p className="mt-2 text-sm text-zinc-600">Vehicle number, driver verification badge, last safety audit, and complaint-free streak.</p>
          </Card>
          <Card className="rounded-[28px] p-6">
            <MapPinned className="h-5 w-5 text-blue-600" />
            <h4 className="mt-4 text-lg font-black text-zinc-900">Live Share Route</h4>
            <p className="mt-2 text-sm text-zinc-600">Parents can follow bus movement and stop progress during morning and evening rides.</p>
          </Card>
          <Card className="rounded-[28px] p-6 md:col-span-2">
            <PhoneCall className="h-5 w-5 text-violet-600" />
            <h4 className="mt-4 text-lg font-black text-zinc-900">Escalation Chain</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-zinc-50 p-4 text-sm font-bold text-zinc-700">1. Driver / attendant</div>
              <div className="rounded-2xl bg-zinc-50 p-4 text-sm font-bold text-zinc-700">2. Transport office</div>
              <div className="rounded-2xl bg-zinc-50 p-4 text-sm font-bold text-zinc-700">3. Guardian / campus security</div>
            </div>
          </Card>
        </div>
      </div>
    </ShowcasePageShell>
  );
}
