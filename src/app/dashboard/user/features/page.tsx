"use client";

import React from "react";
import { FeatureShowcaseGrid } from "@/components/FeatureShowcaseGrid";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-outfit">
      <DashboardHeader title="Project Showcase" />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 mb-6 group transition-all hover:bg-blue-100">
            <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-blue-700">Capabilities Showcase</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black text-zinc-900 tracking-tight mb-6 leading-[1.1]">
            Advanced Intelligent <br />
            <span className="text-blue-600 bg-clip-text">Transit Features</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg text-zinc-500 font-medium leading-relaxed">
            Explore the specialized modules designed for the LiveBus Tracker. 
            From biometric authentication to live safety sharing, these features 
            represent the future of campus transit systems.
          </p>
        </div>

        {/* Features Grid */}
        <div className="bg-white rounded-[48px] p-8 md:p-12 shadow-2xl shadow-blue-100/50 border border-zinc-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/50 blur-[100px] -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-50/50 blur-[100px] -ml-48 -mb-48" />
          
          <div className="relative z-10">
            <FeatureShowcaseGrid />
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-16 flex flex-col items-center justify-center gap-6">
          <div className="h-px w-24 bg-zinc-200" />
          <Link href="/dashboard/user">
            <Button variant="ghost" className="rounded-2xl gap-2 font-bold hover:bg-white text-zinc-500 hover:text-blue-600 transition-all">
              <ArrowLeft className="w-4 h-4" />
              Back to Live Tracking
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer Decoration */}
      <footer className="py-12 text-center text-zinc-400 text-xs font-bold uppercase tracking-[0.2em]">
        Thesis Project &copy; 2026 | LiveBus Tracker
      </footer>
    </div>
  );
}
