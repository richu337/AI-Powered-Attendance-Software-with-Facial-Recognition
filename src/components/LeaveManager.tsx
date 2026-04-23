import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { LeaveRequest, LeaveType, LeaveStatus, Staff } from '../types';
import { useAuth } from './AuthProvider';
import { Palmtree, Plus, Clock, CheckCircle2, XCircle, Search, Calendar, User as UserIcon, X } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const LeaveManager: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [myStaffRecord, setMyStaffRecord] = useState<Staff | null>(null);

  const [form, setForm] = useState({
    leaveType: 'Sick' as LeaveType,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
  });

  const safeFormat = (dateStr: string, formatStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = parseISO(dateStr);
      return isValid(d) ? format(d, formatStr) : 'N/A';
    } catch {
      return 'N/A';
    }
  };

  useEffect(() => {
    if (!profile) return;
    fetchLeaves();
    fetchMyStaffRecord();

    const leaveSubscription = supabase
      .channel('leave_changes')
      .on('postgres_changes' as any, { event: '*', table: 'leaves' }, () => {
        fetchLeaves();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leaveSubscription);
    };
  }, [profile, isAdmin]);

  const fetchLeaves = async () => {
    let query = supabase.from('leaves').select('*').order('applied_at', { ascending: false });
    
    if (!isAdmin) {
      query = query.eq('staff_id', profile?.staffId || 'none');
    }

    const { data } = await query;
    if (data) {
      setLeaves(data.map(m => ({
        id: m.id,
        staffId: m.staff_id,
        staffName: m.staff_name,
        leaveType: m.leave_type,
        startDate: m.start_date,
        endDate: m.end_date,
        reason: m.reason,
        status: m.status,
        appliedAt: m.applied_at,
        rejectionReason: m.rejection_reason
      })));
    }
    setLoading(false);
  };

  const fetchMyStaffRecord = async () => {
    if (!isAdmin && profile?.staffId) {
      const { data } = await supabase.from('staff').select('*').eq('staff_id', profile.staffId).single();
      if (data) {
        setMyStaffRecord({
          id: data.id,
          staffId: data.staff_id,
          fullName: data.full_name,
          email: data.email,
          phoneNumber: data.phone_number,
          role: data.role,
          joiningDate: data.joining_date,
          salaryType: data.salary_type,
          salaryAmount: data.salary_amount,
          workShift: data.work_shift,
          isAdmin: data.is_admin,
          pin: data.pin
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.staffId && !isAdmin) return;
    
    try {
      const payload = {
        staff_id: profile?.staffId,
        staff_name: myStaffRecord?.fullName || profile?.displayName,
        leave_type: form.leaveType,
        start_date: form.startDate,
        end_date: form.endDate,
        reason: form.reason,
        status: 'Pending',
        applied_at: new Date().toISOString(),
      };

      await supabase.from('leaves').insert([payload]);

      // Notify Admins
      const { data: admins } = await supabase.from('staff').select('user_id').eq('is_admin', true);
      if (admins) {
        const notifications = admins
          .filter(a => a.user_id)
          .map(admin => ({
            user_id: admin.user_id,
            message: `New Leave Request from ${myStaffRecord?.fullName || profile?.displayName}`,
            details: `${form.leaveType} Leave: ${form.startDate} to ${form.endDate}`,
            type: 'leave_request',
            read: false,
            created_at: new Date().toISOString(),
            link: '/leaves'
          }));
        
        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications);
        }
      }

      setIsModalOpen(false);
      setForm({
        leaveType: 'Sick',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        reason: '',
      });
      fetchLeaves();
    } catch (error) {
      console.error('Error submitting leave:', error);
    }
  };

  const handleAction = async (id: string, status: LeaveStatus, reason?: string) => {
    try {
      const updateData: any = { status };
      if (reason) updateData.rejection_reason = reason;
      
      await supabase.from('leaves').update(updateData).eq('id', id);

      // Notify staff member
      const leave = leaves.find(l => l.id === id);
      if (leave && leave.staffId) {
        const { data: staff } = await supabase.from('staff').select('user_id').eq('staff_id', leave.staffId).single();
        if (staff?.user_id) {
          await supabase.from('notifications').insert([{
            user_id: staff.user_id,
            message: `Your leave request was ${status.toLowerCase()}`,
            details: reason ? `Reason: ${reason}` : `Your ${leave.leaveType} leave has been ${status.toLowerCase()}.`,
            type: 'leave_status_update',
            read: false,
            created_at: new Date().toISOString(),
            link: '/leaves'
          }]);
        }
      }

      setIsRejectModalOpen(false);
      setSelectedLeaveId(null);
      setRejectionReason('');
      fetchLeaves();
    } catch (error) {
      console.error('Error updating leave status:', error);
    }
  };

  const StatusBadge = ({ status }: { status: LeaveStatus }) => {
    const colors = {
      'Pending': 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
      'Approved': 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]',
      'Rejected': 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
    }[status] || 'bg-gray-100 text-gray-600';

    return (
      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border", colors)}>
        {status}
      </span>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Leave Management</h1>
          <p className="text-sm text-text-muted mt-1">
            {isAdmin ? 'Review and manage staff leave requests.' : 'Request and track your time off.'}
          </p>
        </div>
        {!isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-black transition-all active:scale-95 text-sm"
          >
            <Plus className="w-4 h-4" /> Request Leave
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {leaves.map((leave, idx) => (
          <motion.div 
            layout
            key={leave.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white p-5 rounded-xl border border-border-main shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-border-main flex-shrink-0 text-brand-indigo">
                <Palmtree className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-text-main">{leave.leaveType} Leave</h3>
                  <StatusBadge status={leave.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted font-medium">
                  {isAdmin && (
                    <span className="flex items-center gap-1 text-brand-indigo">
                      <UserIcon className="w-3 h-3" /> {leave.staffName}
                    </span>
                  )}
                  <span className="flex items-center gap-1 uppercase tracking-wider">
                    <Calendar className="w-3 h-3" /> {safeFormat(leave.startDate, 'MMM dd')} - {safeFormat(leave.endDate, 'MMM dd, yyyy')}
                  </span>
                </div>
                <p className="text-text-muted text-[13px] mt-1">"{leave.reason}"</p>
                {leave.rejectionReason && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-[11px] font-bold text-red-800 uppercase tracking-wider">Rejection Reason</p>
                    <p className="text-xs text-red-700">{leave.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>

            {isAdmin && leave.status === 'Pending' && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleAction(leave.id, 'Approved')}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-indigo text-white rounded-lg font-bold hover:opacity-90 transition-all text-xs"
                >
                  Approve
                </button>
                <button 
                  onClick={() => {
                    setSelectedLeaveId(leave.id);
                    setIsRejectModalOpen(true);
                  }}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white text-text-main rounded-lg font-bold hover:bg-gray-50 transition-all border border-border-main text-xs"
                >
                  Reject
                </button>
              </div>
            )}
          </motion.div>
        ))}
        {leaves.length === 0 && !loading && (
          <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl p-12 text-center text-gray-500">
            No leave requests found.
          </div>
        )}
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
              className="bg-white w-full max-w-lg rounded-xl shadow-2xl relative z-10 overflow-hidden border border-border-main"
            >
              <div className="p-6 border-b border-border-main flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-text-main">Request Leave</h2>
                  <p className="text-sm text-text-muted">Submit your request for approval.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-text-muted hover:bg-gray-50 rounded-lg transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5 flex flex-col">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Leave Type</label>
                  <select 
                    value={form.leaveType}
                    onChange={(e) => setForm({...form, leaveType: e.target.value as LeaveType})}
                    className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                  >
                    <option value="Sick">Sick Leave</option>
                    <option value="Casual">Casual Leave</option>
                    <option value="Emergency">Emergency Leave</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Start Date</label>
                    <input 
                      required
                      type="date" 
                      value={form.startDate}
                      onChange={(e) => setForm({...form, startDate: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">End Date</label>
                    <input 
                      required
                      type="date" 
                      value={form.endDate}
                      onChange={(e) => setForm({...form, endDate: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Reason</label>
                  <textarea 
                    required
                    placeholder="Provide a brief reason for your leave..."
                    value={form.reason}
                    onChange={(e) => setForm({...form, reason: e.target.value})}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none resize-none"
                  />
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
                    Submit Request
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRejectModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-xl shadow-2xl relative z-10 overflow-hidden border border-border-main"
            >
              <div className="p-6 border-b border-border-main flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-text-main">Reject Request</h2>
                  <p className="text-sm text-text-muted">Explain why the leave is rejected.</p>
                </div>
                <button onClick={() => setIsRejectModalOpen(false)} className="p-2 text-text-muted hover:bg-gray-50 rounded-lg transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Rejection Reason</label>
                  <textarea 
                    required
                    placeholder="Enter reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-white border border-border-main rounded-lg text-sm focus:ring-1 focus:ring-brand-indigo outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsRejectModalOpen(false)}
                    className="flex-1 py-2.5 border border-border-main text-text-main rounded-lg font-bold hover:bg-gray-50 transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!rejectionReason.trim()}
                    onClick={() => selectedLeaveId && handleAction(selectedLeaveId, 'Rejected', rejectionReason)}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold shadow-sm hover:opacity-90 transition-all text-sm disabled:opacity-50"
                  >
                    Confirm Rejection
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
