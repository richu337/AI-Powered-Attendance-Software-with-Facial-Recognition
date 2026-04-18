import React from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { motion } from 'motion/react';
import { LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login Error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-main px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-12 rounded-xl shadow-sm border border-border-main text-center"
      >
        <div className="mb-10">
          <div className="w-16 h-16 bg-brand-indigo rounded-xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-text-main mb-2 tracking-tight leading-tight px-4">AI-Powered Attendance Software with Facial Recognition</h1>
          <p className="text-sm text-text-muted font-medium">Smart Staff & Attendance Management</p>
        </div>
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-border-main py-3.5 px-6 rounded-lg font-bold text-text-main hover:bg-gray-50 transition-all active:scale-95 shadow-sm text-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
          Continue with Google
        </button>
        
        <div className="mt-10 pt-8 border-t border-border-main">
          <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest">
            Secure Role-Based Access
          </p>
        </div>
      </motion.div>
    </div>
  );
};
