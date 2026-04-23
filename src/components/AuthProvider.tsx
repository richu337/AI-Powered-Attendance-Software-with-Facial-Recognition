import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  loginAdmin: (email: string, pass: string) => Promise<void>;
  loginStaff: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  loginAdmin: async () => {},
  loginStaff: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Persistence for staff sessions
  useEffect(() => {
    const savedStaffProfile = localStorage.getItem('staff_profile');
    if (savedStaffProfile) {
      setProfile(JSON.parse(savedStaffProfile));
      setLoading(false);
    }
  }, []);

  const loginAdmin = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  const loginStaff = async (email: string, pass: string) => {
    // Check the staff table by email
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('email', email)
      .eq('password', pass)
      .single();

    if (error || !data) {
      throw new Error('Invalid Email or Password');
    }

    const staffProfile: UserProfile = {
      uid: data.id,
      email: data.email || '',
      displayName: data.full_name,
      role: data.is_admin ? 'admin' : 'staff',
      staffId: data.staff_id,
    };

    setProfile(staffProfile);
    localStorage.setItem('staff_profile', JSON.stringify(staffProfile));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    localStorage.removeItem('staff_profile');
  };

  useEffect(() => {
    // 1. Check current supabase session (Admin)
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) handleAuthChange(session);
      else if (!localStorage.getItem('staff_profile')) setLoading(false);
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
      // FORCE ADMIN FOR SPECIFIC EMAIL
      const isMasterAdmin = currentUser.email?.toLowerCase().trim() === 'rayhanjaleel904@gmail.com';
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (!profileData && !error) {
        // Create new profile
        const isAdminEmail = currentUser.email?.toLowerCase().trim() === 'rayhanjaleel904@gmail.com';
        
        // Try to link with staff record by email if not exists
        let staffId: string | undefined;
        let isElevatedAdmin = false;

        if (!isAdminEmail && currentUser.email) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('id, staff_id, is_admin')
            .eq('email', currentUser.email.toLowerCase().trim())
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

  const isAdmin = profile?.role === 'admin' || 
                  profile?.email?.toLowerCase().trim() === 'rayhanjaleel904@gmail.com' ||
                  user?.email?.toLowerCase().trim() === 'rayhanjaleel904@gmail.com';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, loginAdmin, loginStaff, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
