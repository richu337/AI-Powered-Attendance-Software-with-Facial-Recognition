import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Shift } from '../types';
import { useAuth } from './AuthProvider';
import { Settings, Plus, Trash2, Edit2, Clock, Check, X, Shield, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const SettingsManager: React.FC = () => {
  const { isAdmin } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  const initialForm = {
    name: '',
    startTime: '09:00',
    endTime: '17:00',
    minHoursForFullDay: 8,
  };

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!isAdmin) return;
    fetchShifts();

    const shiftSubscription = supabase
      .channel('shift_changes')
      .on('postgres_changes' as any, { event: '*', table: 'shifts' }, () => {
        fetchShifts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(shiftSubscription);
    };
  }, [isAdmin]);

  const fetchShifts = async () => {
    const { data, error } = await supabase.from('shifts').select('*');
    if (!error && data) {
      setShifts(data.map(m => ({
        id: m.id,
        name: m.name,
        startTime: m.start_time,
        endTime: m.end_time,
        minHoursForFullDay: m.min_hours_for_full_day
      })));
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      start_time: form.startTime,
      end_time: form.endTime,
      min_hours_for_full_day: form.minHoursForFullDay,
    };

    try {
      if (editingShift) {
        await supabase.from('shifts').update(payload).eq('id', editingShift.id);
      } else {
        await supabase.from('shifts').insert([payload]);
      }
      setIsModalOpen(false);
      setEditingShift(null);
      setForm(initialForm);
      fetchShifts();
    } catch (error) {
      console.error('Error saving shift:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this shift? This may affect staff associated with it.')) {
      await supabase.from('shifts').delete().eq('id', id);
      fetchShifts();
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Shield className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-text-main">Access Denied</h2>
        <p className="text-text-muted">Only administrators can access settings.</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-indigo" /> System Settings
          </h1>
          <p className="text-sm text-text-muted mt-1">Configure shifts and working hour requirements.</p>
        </div>
        <button 
          onClick={() => { setEditingShift(null); setForm(initialForm); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-brand-indigo text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:opacity-90 transition-all active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" /> Create New Shift
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-border-main shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border-main bg-[#F9FAFB]">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Company Work Shifts</h2>
            </div>
            <div className="divide-y divide-border-main">
              {shifts.map((shift, idx) => (
                <motion.div 
                  key={shift.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-brand-indigo">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-main">{shift.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {shift.startTime} - {shift.endTime}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-text-muted rounded-full font-bold uppercase tracking-tight">
                          {shift.minHoursForFullDay}h Req.
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setEditingShift(shift); setForm(shift); setIsModalOpen(true); }}
                      className="p-2 text-text-muted hover:text-brand-indigo hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(shift.id)}
                      className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
              {shifts.length === 0 && !loading && (
                <div className="p-12 text-center text-gray-500">
                  No shifts defined yet. Create your first shift to get started.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Info className="w-5 h-5" /> Automation Tip
              </h3>
              <p className="text-sm opacity-90 leading-relaxed">
                Define your working shifts to enable automatic **Overtime Calculation** and **Half-Day Status** determination.
              </p>
              <div className="mt-6 pt-6 border-t border-white/20">
                <ul className="text-xs space-y-3">
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 text-green-300 flex-shrink-0" />
                    <span>System identifies "Present" if work hours {'>'}= Min Hours.</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 text-green-300 flex-shrink-0" />
                    <span>Calculates Overtime as time spent after Shift End.</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 blur-2xl rounded-full" />
          </div>
        </div>
      </div>

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
              className="bg-white w-full max-w-lg rounded-xl shadow-2xl relative z-10 overflow-hidden border border-border-main"
            >
              <div className="p-6 border-b border-border-main flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-text-main">{editingShift ? 'Edit Shift' : 'Create Shift'}</h2>
                  <p className="text-sm text-text-muted">Define the working hours for this shift.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-text-muted hover:bg-gray-50 rounded-lg transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Shift Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Standard Morning, Night Shift"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Start Time</label>
                    <input 
                      required
                      type="time" 
                      value={form.startTime}
                      onChange={(e) => setForm({...form, startTime: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">End Time</label>
                    <input 
                      required
                      type="time" 
                      value={form.endTime}
                      onChange={(e) => setForm({...form, endTime: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Full Day Requirement (Min Hours)
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      required
                      type="number" 
                      min="1"
                      max="24"
                      value={form.minHoursForFullDay}
                      onChange={(e) => setForm({...form, minHoursForFullDay: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                    <div className="text-xs text-text-muted w-32 font-medium">
                      Hours needed to count as "Present"
                    </div>
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
                    {editingShift ? 'Update Shift' : 'Create Shift'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
