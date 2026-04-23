
import type {Metadata} from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { RouteProvider } from '@/context/RouteContext';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'LiveBus - Live Bus Tracking',
  description: 'Track your local buses in real-time with LiveBus.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <AuthProvider>
          <RouteProvider>
            {children}
            <Toaster />
          </RouteProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
