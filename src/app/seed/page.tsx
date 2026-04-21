"use client";

import { db } from "@/lib/firebase";
import { doc, setDoc, writeBatch } from "firebase/firestore";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { routes as routesData } from "@/lib/routes";
import { createDemoFleetConfigs } from "@/lib/demo-buses";

export default function SeedPage() {
  const [seeding, setSeeding] = useState(false);
  const [complete, setComplete] = useState(false);
  const [summary, setSummary] = useState<{ routes: number; buses: number } | null>(null);

  const seedDB = async () => {
    setSeeding(true);
    try {
      const demoFleet = createDemoFleetConfigs(routesData, 6);
      const routePromises = routesData.map((route) => setDoc(doc(db, "routes", route.id), route));
      const batch = writeBatch(db);

      demoFleet.forEach((bus) => {
        batch.set(doc(db, "demoBuses", bus.id), bus);
      });

      await Promise.all([...routePromises, batch.commit()]);
      setSummary({ routes: routesData.length, buses: demoFleet.length });
      setComplete(true);
    } catch (e: any) {
      alert("Error seeding: " + e.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 flex-col">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 text-center shadow-xl">
        <h1 className="mb-4 text-2xl font-bold">Firebase Demo Seeder</h1>
        <p className="mb-8 text-zinc-600">
          This will load the built-in Bangalore bus routes and create an automatic demo fleet so the app already looks live for your presentation.
        </p>

        {complete ? (
          <div className="rounded-lg bg-green-100 p-4 font-bold text-green-800">
            Demo data created successfully.
            <p className="mt-2 text-sm font-normal text-green-700">
              {summary
                ? `${summary.routes} Bangalore routes and ${summary.buses} moving demo buses are ready.`
                : "Your demo fleet is ready."}
            </p>
          </div>
        ) : (
          <Button onClick={seedDB} disabled={seeding} className="h-14 w-full text-lg font-bold">
            {seeding ? "Creating Routes and Demo Fleet..." : "SEED ROUTES + DEMO BUSES"}
          </Button>
        )}
      </div>
    </div>
  );
}
