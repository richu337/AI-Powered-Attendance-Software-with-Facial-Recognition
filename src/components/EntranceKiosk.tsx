import React from 'react';
import { QRAttendanceManager } from './QRAttendanceManager';
import { BarChart3, Smartphone, ShieldCheck, MapPin } from 'lucide-react';

export const EntranceKiosk: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 sm:p-12">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-primary/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-brand-accent/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center space-y-12">
        {/* Company Header */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-brand-primary/40 border border-white/10">
            <BarChart3 className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">AttendFlow AI</h1>
            <p className="text-slate-400 font-bold tracking-[0.3em] uppercase text-xs mt-1">Digital Identity Terminal</p>
          </div>
        </div>

        {/* The Main QR Terminal */}
        <div className="transform hover:scale-[1.02] transition-transform duration-500">
           <QRAttendanceManager />
        </div>

        {/* Instructions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
           <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
              <Smartphone className="w-6 h-6 text-brand-accent mx-auto mb-3" />
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-wider">Step 1</p>
              <p className="text-xs text-white/70 font-medium">Open Staff App</p>
           </div>
           <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
              <ShieldCheck className="w-6 h-6 text-brand-accent mx-auto mb-3" />
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-wider">Step 2</p>
              <p className="text-xs text-white/70 font-medium">Scan Live QR</p>
           </div>
           <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
              <MapPin className="w-6 h-6 text-brand-accent mx-auto mb-3" />
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-wider">Step 3</p>
              <p className="text-xs text-white/70 font-medium">Verified Location</p>
           </div>
        </div>

        <div className="pt-8 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
           System operational • Encrypted Connection • Real-time Sync
        </div>
      </div>
    </div>
  );
};
