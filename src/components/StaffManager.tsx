import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Staff, SalaryType, Shift } from '../types';
import { Plus, Search, MoreVertical, Edit2, Trash2, X, Check, Shield, Key, Camera, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import Webcam from 'react-webcam';
import { getFaceEmbedding } from '../lib/face-recognition';

export const StaffManager: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [selectedStaffFace, setSelectedStaffFace] = useState<Staff | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const webcamRef = React.useRef<Webcam>(null);

  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const initialForm = {
    fullName: '',
    phoneNumber: '',
    email: '',
    role: '',
    joiningDate: format(new Date(), 'yyyy-MM-dd'),
    salaryType: 'Monthly' as SalaryType,
    salaryAmount: 0,
    workShift: 'Full Day',
    isAdmin: false,
    pin: '',
    password: '',
  };

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    fetchStaff();
    fetchShifts();

    // Set up real-time listener
    const staffSubscription = supabase
      .channel('staff_changes')
      .on('postgres_changes' as any, { event: '*', table: 'staff' }, () => {
        fetchStaff();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(staffSubscription);
    };
  }, []);

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setStaffList(data.map(m => ({
        id: m.id,
        staffId: m.staff_id,
        fullName: m.full_name,
        email: m.email,
        phoneNumber: m.phone_number,
        role: m.role,
        joiningDate: m.joining_date,
        salaryType: m.salary_type,
        salaryAmount: m.salary_amount,
        workShift: m.work_shift,
        isAdmin: m.is_admin,
        pin: m.pin,
        password: m.password || ''
      })));
    }
    setLoading(false);
  };

  const fetchShifts = async () => {
    const { data } = await supabase.from('shifts').select('*');
    if (data) setShifts(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      staff_id: form.email,
      full_name: form.fullName,
      phone_number: form.phoneNumber,
      email: form.email || null,
      role: form.role,
      joining_date: form.joiningDate,
      salary_type: form.salaryType,
      salary_amount: form.salaryAmount,
      work_shift: form.workShift,
      is_admin: form.isAdmin,
      pin: form.pin || null,
      password: form.password || null,
    };

    try {
      if (editingStaff) {
        await supabase.from('staff').update(payload).eq('id', editingStaff.id);
      } else {
        await supabase.from('staff').insert([payload]);
      }
      setIsModalOpen(false);
      setEditingStaff(null);
      setForm(initialForm);
      fetchStaff();
    } catch (error) {
      console.error('Error saving staff:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this staff member?')) {
      await supabase.from('staff').delete().eq('id', id);
      fetchStaff();
    }
  };

  const generateId = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    setForm({ ...form, staffId: `S-${num}` });
  };

  const handleRegisterFace = async () => {
    if (!webcamRef.current || !selectedStaffFace) return;
    
    setIsEnrolling(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Could not capture image");
      
      const embedding = await getFaceEmbedding(imageSrc);
      
      if (!embedding) {
        alert("No face detected. Please ensure your face is clearly visible and within the frame.");
        return;
      }
      
      // Convert Float32Array to regular array for Supabase vector column
      const embeddingArray = Array.from(embedding);
      
      const { error } = await supabase
        .from('staff')
        .update({ face_embedding: embeddingArray })
        .eq('id', selectedStaffFace.id);
        
      if (error) throw error;
      
      alert(`Success! Facial biometric fingerprint has been successfully registered for ${selectedStaffFace.fullName}.`);
      setIsFaceModalOpen(false);
      fetchStaff();
    } catch (error) {
      console.error("Error registering face:", error);
      alert("AI Registration failed. Please try again in better lighting.");
    } finally {
      setIsEnrolling(false);
    }
  };

  const filteredStaff = staffList.filter(s => 
    s.fullName.toLowerCase().includes(search.toLowerCase()) || 
    (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Staff Members</h1>
          <p className="text-sm text-text-muted mt-1">Manage your team and their details.</p>
        </div>
        <button 
          onClick={() => { setEditingStaff(null); setForm(initialForm); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-brand-indigo text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:opacity-90 transition-all active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border-main shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border-main flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search staff, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none transition-all placeholder:text-text-muted"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-text-muted text-[11px] uppercase tracking-wider">
                <th className="px-6 py-3 font-bold border-b border-border-main">Staff Member</th>
                <th className="px-6 py-3 font-bold border-b border-border-main">Position</th>
                <th className="px-6 py-3 font-bold border-b border-border-main">Joining Date</th>
                <th className="px-6 py-3 font-bold border-b border-border-main">Salary</th>
                <th className="px-6 py-3 font-bold border-b border-border-main">Work Shift</th>
                <th className="px-6 py-3 font-bold border-b border-border-main text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {filteredStaff.map((staff, idx) => (
                <motion.tr 
                  key={staff.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="hover:bg-gray-50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-brand-indigo font-bold text-xs uppercase relative">
                        {staff.fullName.charAt(0)}
                        {staff.isAdmin && (
                          <div className="absolute -top-1 -right-1 bg-brand-indigo text-white p-0.5 rounded-full border border-white shadow-sm">
                            <Shield className="w-2 h-2" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-text-main">{staff.fullName}</p>
                        <p className="text-[11px] text-text-muted">{staff.email || 'No Email'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-indigo-50 text-brand-indigo rounded-full text-[11px] font-bold uppercase tracking-wider">
                      {staff.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-text-muted">{staff.joiningDate}</td>
                  <td className="px-6 py-4 text-xs">
                    <p className="font-semibold text-text-main">${staff.salaryAmount}</p>
                    <p className="text-[10px] text-text-muted uppercase font-bold">{staff.salaryType}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-text-muted">{staff.workShift}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        title="Manage Biometrics"
                        onClick={() => { setSelectedStaffFace(staff); setIsFaceModalOpen(true); }}
                        className={cn(
                          "p-1.5 rounded transition-all",
                          staff.faceEmbedding ? "text-brand-success hover:bg-green-50" : "text-text-muted hover:text-brand-indigo hover:bg-indigo-50"
                        )}
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setEditingStaff(staff); setForm(staff); setIsModalOpen(true); }}
                        className="p-1.5 text-text-muted hover:text-brand-indigo hover:bg-indigo-50 rounded transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(staff.id)}
                        className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredStaff.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No staff members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] border border-border-main"
            >
              <div className="p-6 border-b border-border-main flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-text-main">{editingStaff ? 'Edit Staff Member' : 'Add New Staff'}</h2>
                  <p className="text-sm text-text-muted">Enter employee information below.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-text-muted hover:bg-gray-50 rounded-lg transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Login Password</label>
                    <div className="relative">
                       <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                       <input 
                         required={!editingStaff}
                         type="text" 
                         placeholder="Login password"
                         value={form.password}
                         onChange={(e) => setForm({...form, password: e.target.value})}
                         className="w-full pl-10 pr-4 py-2.5 bg-white border border-border-main rounded-lg text-sm font-semibold outline-none"
                       />
                    </div>
                    <p className="text-[10px] text-text-muted italic">Provided to staff for logging into their account.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Security PIN (Attendance)</label>
                    <div className="relative">
                       <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                       <input 
                         type="text" 
                         maxLength={4}
                         placeholder="4-digit PIN"
                         value={form.pin}
                         onChange={(e) => setForm({...form, pin: e.target.value.replace(/\D/g, '')})}
                         className="w-full pl-10 pr-4 py-2.5 bg-white border border-border-main rounded-lg text-sm font-bold tracking-widest outline-none"
                       />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Full Name</label>
                    <input 
                      required
                      type="text" 
                      value={form.fullName}
                      onChange={(e) => setForm({...form, fullName: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Email Address (Login ID)</label>
                    <input 
                      type="email" 
                      required
                      value={form.email}
                      onChange={(e) => setForm({...form, email: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                    <p className="text-[10px] text-text-muted italic">Used by staff to log into their workspace.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Phone Number</label>
                    <input 
                      type="text" 
                      value={form.phoneNumber}
                      onChange={(e) => setForm({...form, phoneNumber: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Position / Role</label>
                    <input 
                      required
                      type="text" 
                      value={form.role}
                      onChange={(e) => setForm({...form, role: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Salary Type</label>
                    <select 
                      value={form.salaryType}
                      onChange={(e) => setForm({...form, salaryType: e.target.value as SalaryType})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Daily">Daily</option>
                      <option value="Hourly">Hourly</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Salary Amount</label>
                    <input 
                      required
                      type="number" 
                      value={form.salaryAmount}
                      onChange={(e) => setForm({...form, salaryAmount: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Joining Date</label>
                    <input 
                      required
                      type="date" 
                      value={form.joiningDate}
                      onChange={(e) => setForm({...form, joiningDate: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs text-text-muted">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Work Shift</label>
                    <select 
                      value={form.workShift}
                      onChange={(e) => setForm({...form, workShift: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    >
                      <option value="">Select Shift</option>
                      {shifts.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.start_time}-{s.end_time})</option>
                      ))}
                      {!shifts.length && (
                        <>
                          <option value="Full Day">Full Day</option>
                          <option value="Half Day">Half Day</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="flex items-center gap-3 p-4 bg-surface-main rounded-lg border border-border-main cursor-pointer hover:bg-gray-50 transition-all">
                      <input 
                        type="checkbox" 
                        checked={form.isAdmin}
                        onChange={(e) => setForm({...form, isAdmin: e.target.checked})}
                        className="w-4 h-4 text-brand-indigo focus:ring-brand-indigo border-border-main rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-text-main">Grant Administrative Access</p>
                        <p className="text-xs text-text-muted">Allows this staff member to manage the entire application.</p>
                      </div>
                      <Shield className={cn("w-5 h-5 transition-colors", form.isAdmin ? "text-brand-indigo" : "text-text-muted")} />
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 border border-border-main text-text-main rounded-lg font-bold hover:bg-gray-50 transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-2.5 bg-brand-indigo text-white rounded-lg font-bold shadow-sm hover:opacity-90 transition-all text-sm"
                  >
                    {editingStaff ? 'Update Staff Member' : 'Save Staff Details'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Face Registration Modal */}
      <AnimatePresence>
        {isFaceModalOpen && selectedStaffFace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFaceModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 overflow-hidden border border-white/20 flex flex-col"
            >
              <div className="p-8 border-b border-border-main flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-text-main">Biometric Enrollment</h2>
                  <p className="text-xs text-text-tertiary font-medium uppercase tracking-widest mt-1">Registering: {selectedStaffFace.fullName}</p>
                </div>
                <button onClick={() => setIsFaceModalOpen(false)} className="p-2 text-text-muted hover:bg-gray-100 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center gap-8">
                <div className="relative w-64 h-64 bg-slate-900 rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-indigo-500/20">
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
                    
                    {/* Viewfinder Overlay */}
                    <div className="absolute inset-0 border-[30px] border-slate-900/40 pointer-events-none" />
                    <div className="absolute inset-x-12 inset-y-12 border-2 border-white/10 rounded-full border-dashed" />
                    
                    <motion.div 
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute h-[1px] w-full bg-brand-indigo/50 shadow-[0_0_15px_#6366f1] z-10"
                    />

                    {/* Dashboard Corners */}
                    <div className="absolute top-6 left-6 w-5 h-5 border-t-2 border-l-2 border-brand-indigo rounded-sm" />
                    <div className="absolute top-6 right-6 w-5 h-5 border-t-2 border-r-2 border-brand-indigo rounded-sm" />
                    <div className="absolute bottom-6 left-6 w-5 h-5 border-b-2 border-l-2 border-brand-indigo rounded-sm" />
                    <div className="absolute bottom-6 right-6 w-5 h-5 border-b-2 border-r-2 border-brand-indigo rounded-sm" />
                </div>

                <div className="text-center space-y-2 px-4">
                  <h3 className="text-sm font-bold text-text-main">AI Nodal Point Analysis</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Position your face within the frame. Our AI will extract 128 unique biometric markers to generate your neural fingerprint.
                  </p>
                </div>

                <div className="w-full flex gap-3">
                  <button 
                    onClick={() => setIsFaceModalOpen(false)}
                    className="flex-1 py-3.5 rounded-xl font-bold text-xs text-text-muted border border-border-main hover:bg-gray-50 transition-all uppercase tracking-widest"
                  >
                    Dismiss
                  </button>
                  <button 
                    disabled={isEnrolling}
                    onClick={handleRegisterFace}
                    className={cn(
                      "flex-[2] py-3.5 rounded-xl font-bold text-xs shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest active:scale-[0.98]",
                      isEnrolling ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-brand-indigo text-white hover:bg-indigo-700 shadow-indigo-500/20"
                    )}
                  >
                    {isEnrolling ? (
                      <><Clock className="w-4 h-4 animate-spin" /> Analyzing...</>
                    ) : (
                      <><Check className="w-4 h-4" /> Finalize Print</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
