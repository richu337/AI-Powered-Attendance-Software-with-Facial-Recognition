import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    // 1. Check current session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      handleAuthChange(session);
    };

    getInitialSession();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthChange(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthChange = async (session: Session | null) => {
    const currentUser = session?.user || null;
    setUser(currentUser);

    if (currentUser) {
      // Fetch or create profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (!profileData && !error) {
        // Create new profile
        const isAdminEmail = currentUser.email === 'rayhanjaleel904@gmail.com';
        
        // Try to link with staff record by email if not exists
        let staffId: string | undefined;
        let isElevatedAdmin = false;

        if (!isAdminEmail && currentUser.email) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('id, staff_id, is_admin')
            .eq('email', currentUser.email)
            .single();

          if (staffData) {
            staffId = staffData.staff_id;
            isElevatedAdmin = staffData.is_admin;
          }
        }

        const newProfile: UserProfile = {
          uid: currentUser.id,
          email: currentUser.email || '',
          displayName: currentUser.user_metadata?.full_name || 'New User',
          role: (isAdminEmail || isElevatedAdmin) ? 'admin' : 'staff',
          staffId: staffId,
        };

        await supabase.from('profiles').insert([
          {
            id: newProfile.uid,
            email: newProfile.email,
            display_name: newProfile.displayName,
            role: newProfile.role,
            staff_id: newProfile.staffId
          }
        ]);
        
        setProfile(newProfile);
      } else if (profileData) {
        setProfile({
          uid: profileData.id,
          email: profileData.email,
          displayName: profileData.display_name,
          role: profileData.role,
          staffId: profileData.staff_id
        });
      }
      setLoading(false);
    } else {
      setProfile(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin: profile?.role === 'admin', loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
