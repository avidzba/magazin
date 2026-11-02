import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { AppUser, UserRole } from '../types';
import {
  getOrCreateUserProfile,
  loginWithEmail as authLoginWithEmail,
  loginWithGoogle as authLoginWithGoogle,
  loginAsDemo as authLoginAsDemo,
  logoutUser,
} from '../services/authService';

interface AuthContextValue {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsDemo: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync with Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const profile = await getOrCreateUserProfile(
            fbUser.uid,
            fbUser.email,
            fbUser.displayName
          );

          // Check if an explicit demo role override exists in localStorage
          const demoRole = localStorage.getItem('moysklad_demo_role') as UserRole | null;
          if (demoRole && (demoRole === 'admin' || demoRole === 'cashier')) {
            setUser({
              ...profile,
              role: demoRole,
              displayName: demoRole === 'admin' ? `${profile.displayName} (Админ)` : `${profile.displayName} (Кассир)`,
            });
          } else {
            setUser(profile);
          }
        } catch (err) {
          console.error('Failed to load user profile:', err);
          setUser({
            uid: fbUser.uid,
            email: fbUser.email || 'user@store.pos',
            displayName: fbUser.displayName || 'Сотрудник',
            role: 'cashier',
          });
        }
      } else {
        // Check if pure demo offline session is active
        const demoRole = localStorage.getItem('moysklad_demo_role') as UserRole | null;
        if (demoRole) {
          setUser({
            uid: `demo-${demoRole}`,
            email: `${demoRole}@moysklad.pos`,
            displayName: demoRole === 'admin' ? 'Демо Администратор' : 'Демо Кассир',
            role: demoRole,
          });
        } else {
          setUser(null);
        }
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    localStorage.removeItem('moysklad_demo_role');
    try {
      await authLoginWithEmail(email, pass);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    localStorage.removeItem('moysklad_demo_role');
    try {
      await authLoginWithGoogle();
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsDemo = async (role: UserRole) => {
    setIsLoading(true);
    try {
      await authLoginAsDemo(role);
      setUser({
        uid: `demo-${role}`,
        email: `${role}@moysklad.pos`,
        displayName: role === 'admin' ? 'Демо Администратор' : 'Демо Кассир',
        role,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setFirebaseUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      const updated = await getOrCreateUserProfile(
        firebaseUser.uid,
        firebaseUser.email,
        firebaseUser.displayName
      );
      setUser(updated);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isCashier = user?.role === 'cashier';

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isAdmin,
        isCashier,
        loginWithEmail,
        loginWithGoogle,
        loginAsDemo,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
