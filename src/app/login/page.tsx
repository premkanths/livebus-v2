"use client";

import { useEffect, useState } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Bus, MapPin, Loader2, Chrome } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';

function dashboardPathForRole(role?: 'admin' | 'driver' | 'user') {
  if (role === 'admin') return '/dashboard/admin';
  if (role === 'driver') return '/dashboard/driver';
  return '/dashboard/user';
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'driver'>('user');
  const [name, setName] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && profile) {
      router.replace(dashboardPathForRole(profile.role));
    }
  }, [authLoading, profile, router, user]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // If new user via Google, default to passenger role
        await setDoc(userDocRef, {
          email: user.email,
          role: 'user',
          displayName: user.displayName,
          createdAt: new Date().toISOString()
        });
        router.push('/dashboard/user');
      } else {
        const userData = userDoc.data();
        router.push(userData.role === 'admin' ? '/dashboard/admin' : userData.role === 'driver' ? '/dashboard/driver' : '/dashboard/user');
      }
    } catch (error: any) {
      toast({
        title: "Google Login Failed",
        description: error.message || "Could not sign in with Google.",
        variant: "destructive"
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        router.push(userData.role === 'admin' ? '/dashboard/admin' : userData.role === 'driver' ? '/dashboard/driver' : '/dashboard/user');
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(db, 'users', user.uid), {
        email,
        role,
        displayName: name,
        createdAt: new Date().toISOString()
      });

      router.push(role === 'driver' ? '/dashboard/driver' : '/dashboard/user');
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message || "Could not create account.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center mb-3">
          <div className="bg-primary p-3 rounded-2xl shadow-lg transform rotate-3">
            <Bus className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">LiveBus</h1>
        <p className="text-muted-foreground mt-2">Real-time public transit tracking</p>
      </div>

      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none bg-muted/50 p-1">
            <TabsTrigger value="login" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Login</TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="space-y-4">
            <form onSubmit={handleLogin}>
              <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button className="w-full h-11" type="submit" disabled={loading || googleLoading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Sign In"}
                </Button>
                
                <div className="relative w-full flex items-center justify-center py-2">
                  <Separator className="absolute w-full" />
                  <span className="relative bg-card px-2 text-xs text-muted-foreground uppercase">Or continue with</span>
                </div>

                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-11" 
                  onClick={handleGoogleLogin} 
                  disabled={loading || googleLoading}
                >
                  {googleLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Chrome className="w-4 h-4 mr-2" />}
                  Google
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp}>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>Join LiveBus to start tracking or driving.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input 
                    id="signup-name" 
                    type="text" 
                    placeholder="John Doe" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input 
                    id="signup-email" 
                    type="email" 
                    placeholder="name@example.com" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input 
                    id="signup-password" 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <Label>I am a:</Label>
                  <RadioGroup value={role} onValueChange={(v: 'user' | 'driver') => setRole(v)} className="flex flex-col gap-3">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-start justify-center space-y-2 bg-muted/30 p-3 rounded-lg flex-1 border border-transparent has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all cursor-pointer">
                        <Label htmlFor="r-user" className="flex items-center cursor-pointer w-full text-foreground/80">
                          <MapPin className="w-4 h-4 mr-2 text-primary" /> Passenger
                        </Label>
                        <RadioGroupItem value="user" id="r-user" />
                      </div>
                      <div className="flex flex-col items-start justify-center space-y-2 bg-muted/30 p-3 rounded-lg flex-1 border border-transparent has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all cursor-pointer">
                        <Label htmlFor="r-driver" className="flex items-center cursor-pointer w-full text-foreground/80">
                          <Bus className="w-4 h-4 mr-2 text-primary" /> Driver
                        </Label>
                        <RadioGroupItem value="driver" id="r-driver" />
                      </div>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Admin access is assigned manually after account creation for security.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full h-11" type="submit" disabled={loading || googleLoading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Create Account"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
      <div className="mt-8 text-center text-sm text-muted-foreground max-w-xs">
        <p>A simple and reliable way to view public service bus locations in real-time.</p>
      </div>
    </div>
  );
}
