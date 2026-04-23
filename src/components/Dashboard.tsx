import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from './AuthProvider';
import { supabase } from '../supabase';
import { Users, CalendarCheck, Palmtree, CreditCard, TrendingUp, Clock, Camera, Zap, X, MapPin, Navigation, Check, QrCode, Smartphone, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import Webcam from 'react-webcam';
import { getFaceEmbedding, compareEmbeddings } from '../lib/face-recognition';

const ALLOWED_RADIUS_KM = 0.5; // Fallback 500 meters

export const Dashboard: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    absentToday: 0,
    pendingLeaves: 0,
    totalPayroll: 0,
  });

  const [geofenceConfig, setGeofenceConfig] = useState({
    lat: 23.8103,
    lng: 90.4125,
    radius: 500,
  });

  const fetchGeofenceConfig = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 'geofencing').single();
    if (data) {
      setGeofenceConfig(data.value);
    }
  };

  useEffect(() => {
    fetchGeofenceConfig();
  }, []);

  const [personalStats, setPersonalStats] = useState({
    attendanceThisMonth: 0,
    pendingLeaves: 0,
    nextPayday: format(new Date(), 'MMMM yyyy'),
  });

  const [isFaceScanOpen, setIsFaceScanOpen] = useState(false);
  const [isQRScanOpen, setIsQRScanOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const webcamRef = React.useRef<Webcam>(null);
  const [announcement, setAnnouncement] = useState({ text: 'Welcome to our AI platform.', author: 'Management' });
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ text: '', author: '' });

  const fetchAnnouncement = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 'announcement').single();
    if (data) {
      setAnnouncement({ text: data.value.text, author: data.value.author });
      setAnnouncementForm({ text: data.value.text, author: data.value.author });
    }
  };

  const saveAnnouncement = async () => {
    setIsSavingAnnouncement(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ id: 'announcement', value: announcementForm }, { onConflict: 'id' });
      
      if (error) {
        if (error.code === '42501') {
          throw new Error("Permission Denied. Please run the SQL fix in your Supabase dashboard to allow settings updates.");
        }
        throw error;
      }
      
      setAnnouncement({ ...announcementForm });
      setIsEditingAnnouncement(false);
      alert("Broadcast message published successfully!");
    } catch (error: any) {
      console.error("Error saving announcement:", error);
      alert("Error: " + (error.message || "Failed to save to database"));
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c;
  };

  const handleQRScan = async (decodedText: string) => {
    setIsScanning(true);
    try {
      const data = JSON.parse(decodedText);
      if (!data.token || data.session_id !== 'ATT_LIVE') {
        throw new Error("Invalid QR Code payload.");
      }

      // 1. Verify token with backend
      const { data: session, error: sessError } = await supabase
        .from('qr_sessions')
        .select('*')
        .eq('id', 'active_session')
        .single();

      if (sessError || !session) throw new Error("Could not verify session.");
      
      const now = new Date();
      const expiry = new Date(session.expires_at);
      
      if (session.token !== data.token) {
        throw new Error("Invalid or expired session token. Please scan the current live QR.");
      }

      if (now > expiry) {
        throw new Error("QR Code has expired. Please wait for the next rotation.");
      }

      // 2. Geofencing Verification (Reuse existing logic or call handleFaceClockIn-like logic)
      const pos: GeolocationPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { data: geoData } = await supabase.from('settings').select('*').eq('id', 'geofencing').single();
      if (geoData?.value?.enabled) {
        const config = geoData.value;
        const R = 6371e3;
        const φ1 = (pos.coords.latitude * Math.PI) / 180;
        const φ2 = (config.lat * Math.PI) / 180;
        const Δφ = ((config.lat - pos.coords.latitude) * Math.PI) / 180;
        const Δλ = ((config.lng - pos.coords.longitude) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance > config.radius) {
          throw new Error(`Out of Bounds: You are ${distance.toFixed(0)}m away. Required within ${config.radius}m.`);
        }
      }

      // 3. Mark Attendance
      const today = new Date().toISOString().split('T')[0];
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('staff_id', profile?.staffId)
        .single();

      const { data: existingAtt } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', profile?.staffId)
        .eq('date', today)
        .single();

      if (existingAtt) {
        if (existingAtt.check_out) {
          throw new Error("Attendance already completed for today.");
        }
        // Clock out
        await supabase
          .from('attendance')
          .update({ check_out: timeNow, last_updated: new Date().toISOString() })
          .eq('id', existingAtt.id);
        alert("Success: Logged OUT via QR Identification.");
      } else {
        // Clock in
        await supabase
          .from('attendance')
          .insert([{
            staff_id: profile?.staffId,
            staff_name: staffData?.full_name || profile?.email,
            date: today,
            status: 'Present',
            check_in: timeNow,
            ai_verified: true,
            notes: 'Verified via Secure Dynamic QR'
          }]);
        alert("Success: Logged IN via QR Identification.");
      }

      setIsQRScanOpen(false);
    } catch (err: any) {
      alert("Verification Failed: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (isQRScanOpen) {
      html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          html5QrCode?.stop().then(() => {
            handleQRScan(decodedText);
          });
        },
        () => {} // silent on scan failure
      ).catch(err => {
        console.error("Camera error:", err);
        const msg = err.message || err;
        if (msg.includes("NotFound") || msg.includes("NotAllowed")) {
          alert("Camera Access Denied: Please allow camera permissions in your browser settings to scan the QR code.");
        } else {
          alert("Scanner Error: " + msg);
        }
        setIsQRScanOpen(false);
      });
    }

    return () => {
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [isQRScanOpen]);

  const handleFaceClockIn = async () => {
    if (!profile?.staffId || !webcamRef.current) return;
    setIsScanning(true);
    
    try {
      // 1. Check Geolocation first
      const position: GeolocationPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });

      const dist = getDistance(
        position.coords.latitude, 
        position.coords.longitude, 
        geofenceConfig.lat, 
        geofenceConfig.lng
      );

      const radiusKm = geofenceConfig.radius / 1000;

      if (dist > radiusKm) {
        alert(`Access Denied. You are ${dist.toFixed(2)}km away from the workplace. Clock-in is only permitted within ${geofenceConfig.radius}m radius.`);
        return;
      }

      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Could not access camera feed");
      
      // 2. Fetch the stored embedding for the current user
      const { data: staff, error: fetchError } = await supabase
        .from('staff')
        .select('face_embedding, full_name')
        .eq('staff_id', profile.staffId)
        .single();
        
      if (fetchError || !staff) throw new Error("Staff record not found or no biometric data registered.");
      if (!staff.face_embedding) {
        alert("No biometric data found for your profile. Please contact an Administrator to register your face.");
        return;
      }
      
      // 3. Generate embedding from current capture
      const currentEmbedding = await getFaceEmbedding(imageSrc);
      if (!currentEmbedding) {
        alert("Face not detected. Please ensure you are in a well-lit area and looking directly at the camera.");
        return;
      }
      
      // 4. Compare embeddings
      const storedEmbedding = new Float32Array(staff.face_embedding);
      const distance = compareEmbeddings(currentEmbedding, storedEmbedding);
      
      const threshold = 0.55; 
      
      if (distance > threshold) {
        alert(`Verification Failed (Distance: ${distance.toFixed(3)}). The AI could not confidently verify your identity. Please try again.`);
        return;
      }
      
      // 5. Identity Verified -> Toggle Attendance (Clock-in / Clock-out)
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = format(new Date(), 'HH:mm');
      
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', profile.staffId)
        .eq('date', today)
        .single();
      
      if (existing) {
        if (existing.check_in && !existing.check_out) {
          // CLOCK OUT
          await supabase
            .from('attendance')
            .update({
              check_out: now,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              last_updated: new Date().toISOString()
            })
            .eq('id', existing.id);
          
          alert(`Goodbye ${staff.full_name}! Identity Verified. Clock-out successful at ${now}. Location recorded.`);
        } else if (existing.check_out) {
          alert("You have already clocked out for today.");
        } else {
          alert("Attendance already marked for today!");
        }
      } else {
        // CLOCK IN
        await supabase.from('attendance').insert([{
          staff_id: profile.staffId,
          staff_name: staff.full_name,
          date: today,
          status: 'Present',
          check_in: now,
          ai_verified: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          last_updated: new Date().toISOString()
        }]);
        alert(`Welcome ${staff.full_name}! Identity Verified. Clock-in successful at ${now}. Location recorded.`);
      }
    } catch (error: any) {
      console.error("AI Face Recognition Error:", error);
      if (error.code === 1) { // User denied Geolocation
        alert("GEOLOCATION DENIED: You must allow location access to clock in/out.");
      } else {
        alert(error.message || "An unexpected error occurred during biometric analysis.");
      }
    } finally {
      setIsScanning(false);
      setIsFaceScanOpen(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    fetchAnnouncement();

    const fetchStats = async () => {
      if (isAdmin) {
        // Admin Stats
        const { count: totalStaff } = await supabase.from('staff').select('*', { count: 'exact', head: true });
        
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data: todayAttendance } = await supabase.from('attendance').select('*').eq('date', today);
        
        const present = todayAttendance?.filter(a => a.status === 'Present' || a.status === 'Half Day').length || 0;
        const absent = todayAttendance?.filter(a => a.status === 'Absent').length || 0;

        const { count: pendingLeaves } = await supabase.from('leaves').select('*', { count: 'exact', head: true }).eq('status', 'Pending');

        setStats({
          totalStaff: totalStaff || 0,
          presentToday: present,
          absentToday: absent,
          pendingLeaves: pendingLeaves || 0,
          totalPayroll: 0
        });
      } else if (profile.staffId) {
        // Staff Stats
        const startOfMonthDate = format(new Date(), 'yyyy-MM-01');
        const { count: attendanceCount } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('staff_id', profile.staffId)
          .gte('date', startOfMonthDate);

        const { count: pendingCount } = await supabase
          .from('leaves')
          .select('*', { count: 'exact', head: true })
          .eq('staff_id', profile.staffId)
          .eq('status', 'Pending');

        setPersonalStats(prev => ({
          ...prev,
          attendanceThisMonth: attendanceCount || 0,
          pendingLeaves: pendingCount || 0
        }));
      }
    };

    fetchStats();

    // Subscribe to changes
    const channels = [
      supabase.channel('dashboard_staff').on('postgres_changes' as any, { event: '*', table: 'staff' }, fetchStats).subscribe(),
      supabase.channel('dashboard_attendance').on('postgres_changes' as any, { event: '*', table: 'attendance' }, fetchStats).subscribe(),
      supabase.channel('dashboard_leaves').on('postgres_changes' as any, { event: '*', table: 'leaves' }, fetchStats).subscribe()
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [isAdmin, profile]);

  const StatCard = ({ title, value, icon, color, delay }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white p-5 rounded-2xl border border-border-subtle shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 flex items-center gap-5 group"
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
        color
      )}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary mb-0.5">{title}</p>
        <p className="text-2xl font-bold text-brand-primary tracking-tight">{value}</p>
      </div>
    </motion.div>
  );

  const saveGeofenceConfig = async () => {
    try {
      await supabase.from('settings').upsert({ id: 'geofencing', value: geofenceConfig });
      alert("Geofencing boundaries updated successfully!");
    } catch (error) {
      console.error("Error saving geofence config:", error);
    }
  };

  const pickCurrentLocationInDashboard = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeofenceConfig(prev => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }));
      },
      (err) => alert("Error: " + err.message)
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-10 py-2">
      <div className="flex-1 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isAdmin ? (
            <>
              <StatCard title="Total Staff" value={stats.totalStaff} icon={<Users className="w-5 h-5" />} color="bg-brand-primary" delay={0.1} />
              <StatCard title="Present Today" value={stats.presentToday} icon={<CalendarCheck className="w-5 h-5" />} color="bg-brand-success" delay={0.2} />
              <StatCard title="Absent Today" value={stats.absentToday} icon={<TrendingUp className="w-5 h-5" />} color="bg-brand-danger" delay={0.3} />
              <StatCard title="Pending Leaves" value={stats.pendingLeaves} icon={<Palmtree className="w-5 h-5" />} color="bg-brand-warning" delay={0.4} />
            </>
          ) : (
            <>
              <StatCard title="Attendance" value={`${personalStats.attendanceThisMonth} Days`} icon={<CalendarCheck className="w-5 h-5" />} color="bg-brand-success" delay={0.1} />
              <StatCard title="Pending" value={personalStats.pendingLeaves} icon={<Clock className="w-5 h-5" />} color="bg-brand-accent" delay={0.2} />
              <StatCard title="Next Evaluation" value={personalStats.nextPayday} icon={<CreditCard className="w-5 h-5" />} color="bg-purple-500" delay={0.3} />
              <StatCard title="Status" value="Active" icon={<Zap className="w-5 h-5" />} color="bg-brand-primary" delay={0.4} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white p-8 rounded-3xl border border-border-subtle shadow-sm"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-brand-primary">Terminal Commands</h2>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/20" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/20" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/20" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button 
                onClick={() => {
                  if (isAdmin) {
                    // Navigate to staff manager or open staff modal if needed
                    // For now, these are just quick action placeholders
                  }
                }}
                className="group p-5 bg-bg-main hover:bg-white border border-border-subtle hover:border-brand-accent rounded-2xl transition-all text-left flex items-start gap-4"
              >
                <div className="p-3 bg-brand-accent/10 text-brand-accent rounded-xl group-hover:bg-brand-accent group-hover:text-white transition-colors">
                  {isAdmin ? <Users className="w-5 h-5" /> : <Palmtree className="w-5 h-5" />}
                </div>
                <div>
                  <span className="block text-sm font-bold text-brand-primary mb-1">
                    {isAdmin ? 'Add Staff' : 'Request Leave'}
                  </span>
                  <span className="block text-[10px] text-text-tertiary uppercase font-medium">
                    {isAdmin ? 'New Record' : 'System Filing'}
                  </span>
                </div>
              </button>

              <button 
                onClick={() => {
                  if (!profile?.staffId) {
                    alert("System Notice: You are logged in as an Administrator but have not been linked to a Staff Profile. Please add yourself to the 'Staff' section first and enroll your face to use the Biometric Clock-in feature.");
                    return;
                  }
                  setIsFaceScanOpen(true);
                }}
                className="group p-5 bg-brand-primary text-white hover:bg-brand-accent border border-transparent rounded-2xl transition-all text-left flex items-start gap-4 shadow-xl shadow-brand-primary/10"
              >
                <div className="p-3 bg-white/10 rounded-xl">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-sm font-bold mb-1 italic">Face Clock-in</span>
                  <span className="block text-[10px] text-white/50 uppercase font-black tracking-wider">AI Verified • Biometric Scan</span>
                </div>
              </button>

              <button 
                onClick={() => {
                  if (!profile?.staffId) {
                    alert("System Notice: You are logged in as an Administrator but have not been linked to a Staff Profile. Please add yourself to the 'Staff' section first to use the QR Clock-in feature.");
                    return;
                  }
                  setIsQRScanOpen(true);
                }}
                className="group p-5 bg-slate-900 text-white hover:bg-slate-800 border border-transparent rounded-2xl transition-all text-left flex items-start gap-4 shadow-xl shadow-slate-950/20"
              >
                <div className="p-3 bg-white/10 rounded-xl">
                  <QrCode className="w-5 h-5 text-brand-accent" />
                </div>
                <div>
                  <span className="block text-sm font-bold mb-1">QR Clock-in</span>
                  <span className="block text-[10px] text-white/40 uppercase font-black tracking-wider">Dynamic Token • Secure Link</span>
                </div>
              </button>
            </div>
          </motion.div>

        <AnimatePresence>
          {isFaceScanOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFaceScanOpen(false)}
                className="absolute inset-0 bg-brand-primary/40 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-white/20 flex flex-col"
              >
                <div className="p-8 border-b border-border-subtle flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-brand-primary tracking-tight">AI Identity Verification</h2>
                    <p className="text-xs text-text-tertiary font-medium uppercase tracking-widest">Biometric Scan Active</p>
                  </div>
                  <button onClick={() => setIsFaceScanOpen(false)} className="p-2 text-text-tertiary hover:bg-bg-main rounded-2xl transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-10 flex flex-col items-center gap-8">
                   <div className="relative w-64 h-64 bg-slate-900 rounded-[2rem] overflow-hidden group shadow-2xl shadow-brand-accent/20">
                      <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="absolute inset-0 w-full h-full object-cover grayscale brightness-110 contrast-125"
                        mirrored={false}
                        screenshotQuality={1}
                        imageSmoothing={true}
                        forceScreenshotSourceSize={true}
                        disablePictureInPicture={true}
                        videoConstraints={{
                          width: 400,
                          height: 400,
                          facingMode: "user"
                        }}
                        onUserMedia={() => {}}
                        onUserMediaError={() => {}}
                      />
                      
                      <motion.div 
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute h-0.5 w-full bg-brand-accent shadow-[0_0_20px_#3B82F6] z-20"
                      />
                      <div className="absolute inset-0 border-[40px] border-slate-900/40 pointer-events-none z-10" />
                      
                      {/* Viewfinder Corners */}
                      <div className="absolute top-6 left-6 w-6 h-6 border-t-2 border-l-2 border-brand-accent rounded-sm z-20" />
                      <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-brand-accent rounded-sm z-20" />
                      <div className="absolute bottom-6 left-6 w-6 h-6 border-b-2 border-l-2 border-brand-accent rounded-sm z-20" />
                      <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-brand-accent rounded-sm z-20" />
                   </div>

                   <p className="text-center text-sm text-text-secondary px-6 leading-relaxed font-medium">
                      Looking directly at the camera. The AI engine is analyzing 128 nodal points for precision identity verification.
                   </p>

                   <button 
                     disabled={isScanning}
                     onClick={handleFaceClockIn}
                     className={cn(
                       "w-full py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3 text-sm active:scale-[0.98]",
                       isScanning ? "bg-bg-main text-text-tertiary cursor-not-allowed" : "bg-brand-primary text-white hover:bg-brand-accent shadow-brand-accent/20"
                     )}
                   >
                     {isScanning ? (
                       <>
                         <Clock className="w-4 h-4 animate-spin" /> Analyzing Neural Patterns...
                       </>
                     ) : (
                       <>
                         <Zap className="w-4 h-4" /> Engage AI Neural Scan
                       </>
                     )}
                   </button>
                </div>
              </motion.div>
            </div>
          )}

          {isQRScanOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsQRScanOpen(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              />
              
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-bg-main w-full max-w-xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-border-subtle"
              >
                 <div className="p-8 border-b border-border-subtle flex items-center justify-between bg-white">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-brand-primary/5 rounded-2xl">
                          <QrCode className="w-6 h-6 text-brand-primary" />
                       </div>
                       <div>
                          <h2 className="text-xl font-black text-brand-primary italic">SECURE QR SCAN</h2>
                          <p className="text-[10px] text-text-tertiary uppercase font-black tracking-widest">Attendance Identity Verification</p>
                       </div>
                    </div>
                    <button 
                      onClick={() => setIsQRScanOpen(false)}
                      className="p-3 bg-bg-main hover:bg-gray-100 rounded-2xl transition-all active:scale-90"
                    >
                      <X className="w-5 h-5 text-text-main" />
                    </button>
                 </div>

                 <div className="p-10 space-y-8">
                    <div className="relative aspect-square max-w-[320px] mx-auto rounded-[2rem] overflow-hidden bg-black shadow-2xl border-4 border-brand-primary/10">
                        <div id="qr-reader" className="w-full h-full" />
                        
                        {/* Scanning HUD Overlay */}
                        <div className="absolute inset-0 pointer-events-none z-10">
                           <div className="absolute inset-8 border-2 border-brand-accent/30 rounded-2xl border-dashed animate-pulse" />
                           <motion.div 
                             animate={{ top: ['20%', '80%', '20%'] }}
                             transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                             className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-brand-accent to-transparent shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
                           />
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-4 text-center">
                       <div className="flex items-center gap-2 px-4 py-2 bg-brand-primary/5 rounded-full">
                          <Smartphone className="w-4 h-4 text-brand-primary animate-bounce" />
                          <span className="text-[11px] font-black text-brand-primary uppercase tracking-tighter">Align QR Code within Frame</span>
                       </div>
                       <p className="text-sm text-text-secondary max-w-[280px] leading-relaxed font-medium">
                          Point your camera at the **Live Rotating QR Code** displayed on the terminal.
                       </p>
                    </div>

                    {isScanning && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-border-subtle flex flex-col items-center gap-4">
                           <RefreshCw className="w-10 h-10 text-brand-primary animate-spin" />
                           <span className="text-xs font-black text-text-main uppercase tracking-widest">Validating Token...</span>
                        </div>
                      </div>
                    )}
                 </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-brand-primary p-10 rounded-[2.5rem] shadow-2xl shadow-brand-primary/10 text-white relative overflow-hidden flex flex-col justify-center min-h-[260px] border border-white/5"
          >
            <div className="relative z-10 w-full">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                   <h2 className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-black">Broadcast</h2>
                 </div>
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        if (!isEditingAnnouncement) {
                          setAnnouncementForm({ ...announcement });
                        }
                        setIsEditingAnnouncement(!isEditingAnnouncement);
                      }}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-white transition-colors border border-white/10"
                    >
                      {isEditingAnnouncement ? 'End Session' : 'Modify'}
                    </button>
                 )}
              </div>

              {isEditingAnnouncement ? (
                 <div className="space-y-4">
                    <textarea 
                      value={announcementForm.text}
                      onChange={(e) => setAnnouncementForm({...announcementForm, text: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:ring-1 focus:ring-brand-accent outline-none text-white placeholder:text-white/20 transition-all"
                      placeholder="Enter broadcast message..."
                      rows={3}
                    />
                    <div className="flex gap-3">
                      <input 
                        type="text"
                        value={announcementForm.author}
                        onChange={(e) => setAnnouncementForm({...announcementForm, author: e.target.value})}
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-1 focus:ring-brand-accent outline-none text-white placeholder:text-white/20 transition-all"
                        placeholder="Origin Source..."
                      />
                      <button 
                        onClick={saveAnnouncement}
                        disabled={isSavingAnnouncement}
                        className={cn(
                          "px-6 rounded-2xl font-bold text-xs transition-all shadow-lg",
                          isSavingAnnouncement 
                            ? "bg-white/20 text-white/50 cursor-not-allowed" 
                            : "bg-brand-accent text-white hover:bg-blue-400 shadow-brand-accent/20"
                        )}
                      >
                        {isSavingAnnouncement ? 'Publishing...' : 'Publish'}
                      </button>
                    </div>
                 </div>
              ) : (
                 <>
                    <p className="text-2xl leading-tight font-light mb-8 italic text-white/90 font-serif">
                      "{announcement.text}"
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-white/10" />
                      <p className="text-[11px] text-white/40 font-black uppercase tracking-widest shrink-0">{announcement.author}</p>
                    </div>
                 </>
              )}
            </div>
            
            {/* Decorative Elements */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-accent/10 blur-[100px] rounded-full" />
            <div className="absolute top-0 right-0 w-32 h-32 border-t border-r border-white/5 rounded-tr-[2.5rem]" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
