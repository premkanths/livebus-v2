"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { FeatureShowcaseGrid } from "@/components/FeatureShowcaseGrid";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutGrid } from "lucide-react";

interface ShowcaseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShowcaseDrawer({ open, onOpenChange }: ShowcaseDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-[540px] p-0 border-l border-zinc-200 shadow-2xl transition-all duration-500"
      >
        <ScrollArea className="h-full w-full">
          <div className="p-6 pb-20">
            <SheetHeader className="mb-8 text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg mb-4">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <SheetTitle className="text-2xl font-black tracking-tight text-zinc-950">
                Showcase Features
              </SheetTitle>
              <SheetDescription className="mt-2 text-sm text-zinc-500 leading-relaxed">
                Explore extra demo pages and features designed for project presentation and placements. 
                These screens demonstrate advanced capabilities like smart passes, alerts, and more.
              </SheetDescription>
            </SheetHeader>

            <div className="-mx-2">
              <FeatureShowcaseGrid compact embedded />
            </div>

            <div className="mt-12 rounded-3xl bg-zinc-50 border p-6 text-center">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Presentation Tip</p>
              <p className="text-sm text-zinc-600">
                Swipe left from the edge or click the close button to return to the dashboard.
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
