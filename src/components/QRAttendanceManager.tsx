import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { QRCodeCanvas } from 'qrcode.react';
import { RefreshCw, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const QRAttendanceManager: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const rotateToken = useCallback(async () => {
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiry = new Date();
    expiry.setSeconds(expiry.getSeconds() + 35); // 35 seconds for buffer

    try {
      const { error } = await supabase
        .from('qr_sessions')
        .upsert({ 
          id: 'active_session', 
          token: newToken, 
          expires_at: expiry.toISOString() 
        }, { onConflict: 'id' });

      if (error) throw error;
      
      setToken(newToken);
      setExpiresAt(expiry);
    } catch (err) {
      console.error('Failed to rotate QR token:', err);
    }
  }, []);

  useEffect(() => {
    rotateToken().then(() => setLoading(false));
    
    // Rotate every 30 seconds
    const rotationInterval = setInterval(rotateToken, 30000);
    
    return () => clearInterval(rotationInterval);
  }, [rotateToken]);

  useEffect(() => {
    if (!expiresAt) return;

    const timer = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeLeft(diff);
      
      if (diff === 0) {
        // Just rotated by the other interval, but good for UI
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const qrData = JSON.stringify({
    session_id: 'ATT_LIVE',
    token: token,
    ts: Date.now()
  });

  return (
    <div className="bg-white rounded-2xl border border-border-main p-8 shadow-sm text-center">
      <div className="flex items-center justify-center gap-2 mb-6">
        <ShieldCheck className="w-5 h-5 text-brand-success" />
        <h2 className="text-sm font-black uppercase tracking-widest text-text-main">Secure Dynamic Attendance QR</h2>
      </div>

      <div className="relative inline-block p-6 bg-white rounded-3xl border-4 border-brand-primary/5 shadow-2xl mb-8 group">
        {loading ? (
          <div className="w-64 h-64 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-brand-indigo animate-spin" />
          </div>
        ) : (
          <QRCodeCanvas 
            value={qrData} 
            size={256}
            level="H"
            includeMargin={false}
            className="rounded-xl shadow-inner"
          />
        )}
        
        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-primary rounded-tl-3xl -translate-x-2 -translate-y-2" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-primary rounded-tr-3xl translate-x-2 -translate-y-2" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-primary rounded-bl-3xl -translate-x-2 translate-y-2" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-primary rounded-br-3xl translate-x-2 translate-y-2" />
      </div>

      <div className="max-w-xs mx-auto space-y-4">
        <div className="flex items-center justify-center gap-3 py-3 px-4 bg-gray-50 rounded-xl border border-border-main">
          <Clock className="w-4 h-4 text-brand-indigo" />
          <div className="flex-1 text-left">
            <div className="text-[10px] uppercase font-black text-text-tertiary">Token Rotation</div>
            <div className="text-sm font-bold text-text-main">
              Refresh in <span className="text-brand-indigo tabular-nums">{timeLeft}s</span>
            </div>
          </div>
          <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
             <motion.div 
               animate={{ width: `${(timeLeft / 30) * 100}%` }}
               className="h-full bg-brand-indigo"
             />
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-xl border border-brand-indigo/10 text-left">
          <AlertCircle className="w-5 h-5 text-brand-indigo flex-shrink-0" />
          <p className="text-[11px] text-brand-indigo/80 font-medium leading-relaxed">
            Staff must scan this code using their mobile app to mark attendance. The code changes every 30 seconds for security.
          </p>
        </div>
      </div>
    </div>
  );
};
