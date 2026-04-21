"use client";

import { CreditCard, QrCode, RefreshCcw, ShieldCheck } from "lucide-react";
import { ShowcasePageShell } from "@/components/ShowcasePageShell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function SmartPassPage() {
  return (
    <ShowcasePageShell
      title="Smart Bus Pass"
      eyebrow="Frontend Demo Page"
      description="A digital student transit pass for Presidency University with QR boarding, semester status, verification, and renewal workflow."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden rounded-[32px] border-0 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#38bdf8_100%)] p-6 text-white shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-100/80">
                Presidency University Transit
              </p>
              <h2 className="mt-3 text-3xl font-black">Student Smart Pass</h2>
            </div>
            <CreditCard className="h-8 w-8 text-white/80" />
          </div>

          <div className="mt-8 grid gap-4 rounded-[28px] bg-white/10 p-5 backdrop-blur md:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100/70">Student</p>
              <p className="mt-2 text-xl font-black">Harshith R</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100/70">Pass Type</p>
              <p className="mt-2 text-xl font-black">Semester Transport</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100/70">Primary Route</p>
              <p className="mt-2 text-xl font-black">PU-102 Hebbal to Presidency</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100/70">Validity</p>
              <p className="mt-2 text-xl font-black">Until Dec 20, 2026</p>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-white/20 bg-white/10 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100/70">Boarding QR</p>
                <p className="mt-2 text-sm font-bold text-white/90">Scan at entry for auto attendance and trip logging.</p>
              </div>
              <div className="rounded-3xl bg-white p-4 text-zinc-900 shadow-xl">
                <QrCode className="h-16 w-16" />
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-black text-zinc-900">Verification Status</h3>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-700">University ID verified</p>
                <p className="mt-1 text-xs text-emerald-700/80">Linked to Presidency ERP student number and registered route.</p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-black text-blue-700">Fee status: Active</p>
                <p className="mt-1 text-xs text-blue-700/80">Transport fee paid for current semester.</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] p-6">
            <div className="flex items-center gap-3">
              <RefreshCcw className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-black text-zinc-900">Renewal Window</h3>
            </div>
            <p className="mt-4 text-sm text-zinc-600">Renewal opens 18 days before expiry. Students can reselect pickup stop and preferred shift.</p>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-zinc-500">
                <span>Semester progress</span>
                <span>68%</span>
              </div>
              <Progress value={68} className="h-3" />
            </div>
          </Card>
        </div>
      </div>
    </ShowcasePageShell>
  );
}
