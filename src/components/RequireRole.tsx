"use client";

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Role = 'admin' | 'driver' | 'user';

interface RequireRoleProps {
  allowedRoles: Role[];
  children: ReactNode;
}

function dashboardPathForRole(role?: Role) {
  if (role === 'admin') return '/dashboard/admin';
  if (role === 'driver') return '/dashboard/driver';
  return '/dashboard/user';
}

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const isAllowed = !!profile && allowedRoles.includes(profile.role);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (profile && !allowedRoles.includes(profile.role)) {
      router.replace(dashboardPathForRole(profile.role));
    }
  }, [allowedRoles, loading, profile, router, user]);

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
          <p className="font-medium text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-500" />
          <h1 className="text-xl font-bold text-foreground">Redirecting</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This dashboard is not available for your account role.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
