"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { showcaseFeatures } from "@/lib/showcase-features";

interface FeatureShowcaseGridProps {
  compact?: boolean;
  embedded?: boolean;
}

export function FeatureShowcaseGrid({ compact = false, embedded = false }: FeatureShowcaseGridProps) {
  return (
    <section className={`${compact ? "p-4" : "p-6"} ${embedded ? "" : "border-b bg-white"}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">
            Showcase Features
          </h3>
          <p className="mt-1 text-sm font-bold text-zinc-800">
            Extra demo pages for placements and project presentation
          </p>
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
        {showcaseFeatures.map((feature) => {
          const Icon = feature.icon;

          return (
            <Link
              key={feature.href}
              href={feature.href}
              className="group rounded-3xl border border-zinc-200 bg-zinc-50 p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.accent} text-white shadow-md`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>

              <h4 className="mt-4 text-sm font-black text-zinc-900">{feature.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {feature.description}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
