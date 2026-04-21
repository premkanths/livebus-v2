
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface UserProfile {
  uid: string;
  email: string | null;
  role: 'driver' | 'user' | 'admin';
  displayName?: string;
  assignedRouteId?: string;
  vehicleNumber?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

function normalizeRole(role?: string): 'driver' | 'user' | 'admin' {
  const normalized = role?.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'driver') return normalized;
  return 'user';
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: normalizeRole(data.role),
              displayName: data.displayName || firebaseUser.displayName,
              assignedRouteId: data.assignedRouteId?.trim()?.toUpperCase() || '',
              vehicleNumber: data.vehicleNumber?.trim()?.toUpperCase() || '',
            });
          } else {
            setProfile(null);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (profile?.role === 'driver' && user) {
      try {
        await setDoc(doc(db, 'buses', user.uid), {
          status: 'inactive',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (error) {
        console.error('Error marking driver inactive during sign out:', error);
      }
    }

    await auth.signOut();
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
