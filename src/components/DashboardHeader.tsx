"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bus, LogOut, User, Shield, Activity, LayoutDashboard } from "lucide-react";
import Link from "next/link";

interface DashboardHeaderProps {
  title: string;
  showSearchTab?: boolean;
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const { user, profile, signOut } = useAuth();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const roleLabel = profile?.role === 'admin' ? 'Founder / Admin' : profile?.role === 'driver' ? 'Driver' : 'Passenger';
  const roleIcon = profile?.role === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : profile?.role === 'driver' ? <Bus className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />;

  return (
    <header className="bg-primary text-secondary flex justify-between items-center px-4 py-3 shadow-md z-50">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-1.5 rounded-lg">
          <Bus className="w-6 h-6 text-white" />
        </div>
        <h1 className="font-bold text-xl tracking-tight hidden sm:block">{title}</h1>
        <h1 className="font-bold text-xl tracking-tight sm:hidden">LiveBus</h1>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-white/10 p-0 overflow-hidden border border-white/20 shadow-sm">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-secondary text-primary font-bold">
                  {getInitials(profile?.displayName || user?.email)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-bold leading-none text-zinc-900">
                  {profile?.displayName || "User"}
                </p>
                <p className="text-xs leading-none text-zinc-500">
                  {user?.email}
                </p>
                <div className="flex items-center pt-2">
                  <div className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {roleIcon}
                    {roleLabel}
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={profile?.role === 'admin' ? '/dashboard/admin' : profile?.role === 'driver' ? '/dashboard/driver' : '/dashboard/user'} className="flex items-center">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>My Dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-600 focus:text-red-600 cursor-pointer font-medium"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
