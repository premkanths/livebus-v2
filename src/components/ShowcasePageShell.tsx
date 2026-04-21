"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/RequireRole";
import { showcaseFeatures } from "@/lib/showcase-features";

interface ShowcasePageShellProps {
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
}

export function ShowcasePageShell({
  title,
  eyebrow,
  description,
  children,
}: ShowcasePageShellProps) {
  return (
    <RequireRole allowedRoles={['user']}>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
        <DashboardHeader title={title} />

        <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
          <div className="mb-6 rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-600">
                  {eyebrow}
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
                  {title}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                  {description}
                </p>
              </div>

              <Button asChild variant="outline" className="rounded-2xl bg-white">
                <Link href="/dashboard/user">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </div>

          <div className="mb-6 flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {showcaseFeatures.map((feature) => {
              const isActive = feature.title === title;
              return (
                <Link
                  key={feature.href}
                  href={feature.href}
                  className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg"
                      : "border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
                  }`}
                >
                  {feature.title}
                </Link>
              );
            })}
          </div>

          <div className="space-y-6">{children}</div>
        </main>
      </div>
    </RequireRole>
  );
}
