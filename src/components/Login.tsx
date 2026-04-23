import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, User, Shield, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { loginAdmin, loginStaff } = useAuth();
  const [mode, setMode] = useState<'staff' | 'admin'>('staff');
  const [identifier, setIdentifier] = useState(''); // Email or Staff ID
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'admin') {
        await loginAdmin(identifier, password);
      } else {
        await loginStaff(identifier, password);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex selection:bg-brand-accent/20 bg-white">
      {/* Left Panel: Sign-in Section */}
      <div className="flex-1 flex flex-col justify-center bg-bg-main relative px-8 sm:px-16 md:px-24 lg:px-32 xl:px-40 overflow-hidden">
        {/* Dynamic Background Blurs */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-brand-accent/5 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[10%] w-[50%] h-[50%] bg-brand-primary/5 blur-[100px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-md w-full"
        >
          {/* Logo & Header */}
          <div className="mb-12">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-brand-primary/20"
            >
              <LogIn className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-4xl font-black text-brand-primary tracking-tight mb-3">AttendFlow AI</h1>
            <p className="text-text-tertiary text-sm font-medium leading-relaxed max-w-sm">
              The neural engine for modern workforce coordination. Log in to access your secure workspace terminal.
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex p-1.5 bg-white rounded-2xl mb-10 border border-border-subtle shadow-sm">
            <button
              onClick={() => setMode('staff')}
              className={`flex-1 flex items-center justify-center gap-3 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                mode === 'staff' 
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-main'
              }`}
            >
              <User className="w-4 h-4" />
              Staff
            </button>
            <button
              onClick={() => setMode('admin')}
              className={`flex-1 flex items-center justify-center gap-3 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                mode === 'admin' 
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-main'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em] ml-1">
                {mode === 'staff' ? 'Email Address' : 'Command Email'}
              </label>
              <input
                type="email"
                required
                className="w-full px-6 py-4.5 rounded-2xl bg-white border border-border-subtle focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all duration-300 text-sm font-semibold placeholder:text-text-tertiary/40 shadow-sm"
                placeholder={mode === 'staff' ? 'your-email@gmail.com' : 'admin@attendflow.ai'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em] ml-1">
                Security Key
              </label>
              <input
                type="password"
                required
                className="w-full px-6 py-4.5 rounded-2xl bg-white border border-border-subtle focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent outline-none transition-all duration-300 text-sm font-semibold placeholder:text-text-tertiary/40 shadow-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 text-brand-danger bg-brand-danger/5 border border-brand-danger/10 p-4.5 rounded-2xl text-xs font-bold italic overflow-hidden shadow-sm"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-primary hover:bg-brand-accent disabled:bg-brand-primary/50 text-white font-black py-5 rounded-[1.25rem] transition-all duration-300 shadow-2xl shadow-brand-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-sm uppercase tracking-[0.2em]">Authorize Access</span>
                  <LogIn className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Branding */}
          <div className="mt-16 flex items-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500 cursor-default">
             <div className="w-12 h-px bg-brand-primary" />
             <span className="text-[10px] uppercase tracking-[0.5em] font-black text-brand-primary whitespace-nowrap">Secure Terminal Ver 2.4.0</span>
          </div>
        </motion.div>
      </div>

      {/* Right Panel: Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-brand-primary items-center justify-center overflow-hidden">
        {/* Abstract Background with CSS only */}
        <div className="absolute inset-0 z-0 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/95 via-brand-primary/40 to-brand-accent/5" />
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-brand-accent/10 blur-[120px] rounded-full" />
        </div>

        {/* Hero Content */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="relative z-10 p-20 max-w-2xl text-white"
        >
           <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-px bg-brand-accent" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-accent">Platform Dynamics</span>
           </div>
           <h2 className="text-6xl font-black leading-[1.05] tracking-tight mb-8">
             Intelligent <br />
             <span className="text-brand-accent italic">Workforce</span> <br />
             Coordination.
           </h2>
           <p className="text-lg font-medium text-white/70 leading-relaxed mb-12 max-w-lg">
             Monitor, manage, and scale your operations with AI-driven biometric verification and real-time synchronization.
           </p>
           
           <div className="grid grid-cols-2 gap-10">
              <div>
                <p className="text-2xl font-black mb-1">99.98%</p>
                <p className="text-[10px] uppercase font-black tracking-widest text-white/40">Uptime Assurance</p>
              </div>
              <div>
                <p className="text-2xl font-black mb-1">10k+</p>
                <p className="text-[10px] uppercase font-black tracking-widest text-white/40">Active Nodes</p>
              </div>
           </div>
        </motion.div>

        {/* Bottom Accent */}
        <div className="absolute bottom-12 right-12 z-10 flex items-center gap-4 text-white/30">
           <span className="text-[10px] uppercase tracking-widest font-bold">Neural Engine Operational</span>
           <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
        </div>
      </div>
    </div>
  );
};
