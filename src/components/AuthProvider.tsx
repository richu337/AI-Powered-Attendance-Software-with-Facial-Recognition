import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // Check if it's the admin email
          const isAdminEmail = user.email === 'rayhanjaleel904@gmail.com';
          
          let staffId: string | undefined;
          let isElevatedAdmin = false;
          
          // If not root admin, try to link with a staff record by email
          if (!isAdminEmail && user.email) {
            const staffRef = collection(db, 'staff');
            const q = query(staffRef, where('email', '==', user.email));
            const staffSnap = await getDocs(q);
            
            if (!staffSnap.empty) {
              const staffDoc = staffSnap.docs[0];
              staffId = staffDoc.id;
              isElevatedAdmin = !!staffDoc.data().isAdmin;
              // Link the staff record with the user ID for future reference
              await setDoc(doc(db, 'staff', staffId), { userId: user.uid }, { merge: true });
            }
          }

          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'New User',
            role: (isAdminEmail || isElevatedAdmin) ? 'admin' : 'staff',
            staffId: staffId,
          };
          
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        }

        const unsubscribeProfile = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
          }
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin: profile?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};
