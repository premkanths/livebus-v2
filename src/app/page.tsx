
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile) {
        const dashboardPath =
          profile.role === 'admin'
            ? '/dashboard/admin'
            : profile.role === 'driver'
              ? '/dashboard/driver'
              : '/dashboard/user';
        router.push(dashboardPath);
      }
    }
  }, [user, profile, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Loading LiveBus...</p>
      </div>
    </div>
  );
}
