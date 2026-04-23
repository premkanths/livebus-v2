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
import { Bus, LogOut, User, Shield, LayoutDashboard, Globe, Linkedin, Github, Twitter, Instagram } from "lucide-react";
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

  const navLinks = [
    { label: "Home", href: "/dashboard/user" },
    { label: "All Buses", href: "/dashboard/user/all-buses" },
    { label: "Features", href: "/dashboard/user/features" },
    { label: "Support", href: "/dashboard/user/support" },
  ];

  const socialLinks = [
    { icon: Globe, href: "https://premkanth.netlify.app/", label: "Portfolio" },
    { icon: Linkedin, href: "https://www.linkedin.com/in/premkanth-ks-98b7a62bb", label: "LinkedIn" },
    { icon: Github, href: "https://github.com/premkanths", label: "GitHub" },
    { icon: Twitter, href: "https://x.com/Premkant_h?t=QY0K37wRJg_PbU3mNhqB1w&s=09", label: "Twitter" },
    { icon: Instagram, href: "https://instagram.com/_prem_kanth_s_", label: "Instagram" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_62%,#0ea5e9_100%)] text-white shadow-[0_12px_35px_rgba(15,23,42,0.18)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_24%)]" />
      <div className="relative flex justify-between items-center px-4 py-3 gap-6">
      <div className="flex items-center gap-3 shrink-0">
        <div className="rounded-2xl border border-white/20 bg-white/15 p-2 shadow-sm backdrop-blur">
          <Bus className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="hidden md:block text-[10px] font-black uppercase tracking-[0.24em] text-blue-100/80">
            LiveBus Tracker
          </p>
          <h1 className="font-bold text-xl tracking-tight hidden md:block">{title}</h1>
          <h1 className="font-bold text-xl tracking-tight md:hidden">LiveBus Tracker</h1>
        </div>
      </div>

      <nav className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-sm mx-auto">
        {navLinks.map((link) => (
          <Link 
            key={link.label}
            href={link.href}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white hover:text-blue-600 transition-all duration-300"
          >
            {link.label}
          </Link>
        ))}
        
        <div className="w-px h-4 bg-white/20 mx-2" />
        
        <div className="flex items-center gap-1 px-2">
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl hover:bg-white hover:text-blue-600 transition-all duration-300 group"
              title={social.label}
            >
              <social.icon className="w-4 h-4" />
            </a>
          ))}
        </div>
      </nav>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-white/10 p-0 overflow-hidden border border-white/20 bg-white/10 shadow-sm backdrop-blur">
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
      </div>
    </header>
  );
}
