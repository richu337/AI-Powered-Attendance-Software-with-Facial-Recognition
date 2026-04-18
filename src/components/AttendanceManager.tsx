import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, getDocs, setDoc } from 'firebase/firestore';
import { Staff, Attendance, AttendanceStatus, Shift } from '../types';
import { useAuth } from './AuthProvider';
import { Calendar, CheckCircle2, XCircle, Clock, Save, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { format, addDays, subDays, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { DayPicker } from 'react-day-picker';
import * as Popover from '@radix-ui/react-popover';
import 'react-day-picker/dist/style.css';
import { cn } from '../lib/utils';

export const AttendanceManager: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<{staff: Staff, data: Partial<Attendance>} | null>(null);

  const safeFormat = (dateStr: string, formatStr: string) => {
    try {
      const d = parseISO(dateStr);
      return isValid(d) ? format(d, formatStr) : 'Invalid Date';
    } catch {
      return 'Invalid Date';
    }
  };

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snap) => {
      setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff)));
    });

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snap) => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
    });

    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendance'), where('date', '==', selectedDate)),
      (snap) => {
        const atMap: Record<string, Attendance> = {};
        snap.docs.forEach(d => {
          const data = d.data() as Attendance;
          atMap[data.staffId] = { ...data, id: d.id };
        });
        setAttendance(atMap);
        setLoading(false);
      }
    );

    return () => {
      unsubStaff();
      unsubShifts();
      unsubAttendance();
    };
  }, [selectedDate]);

  const calculateAutoStatus = (checkIn: string, checkOut: string, shiftName: string): { status: AttendanceStatus, overtime: number } => {
    const shift = shifts.find(s => s.name === shiftName);
    if (!shift || !checkIn || !checkOut) return { status: 'Present', overtime: 0 };

    const parseTime = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const inTime = parseTime(checkIn);
    const outTime = parseTime(checkOut);
    const shiftStart = parseTime(shift.startTime);
    const shiftEnd = parseTime(shift.endTime);
    
    const workingMinutes = outTime - inTime;
    const workingHours = workingMinutes / 60;

    // Determine status
    let status: AttendanceStatus = 'Present';
    if (workingHours < shift.minHoursForFullDay) {
      status = 'Half Day';
    }

    // Determine overtime (only if checkout is after shift end)
    let overtime = 0;
    if (outTime > shiftEnd) {
      overtime = outTime - shiftEnd;
    }

    return { status, overtime };
  };

  const handleStatusChange = async (staff: Staff, status: AttendanceStatus) => {
    if (!isAdmin) return;

    const existingId = attendance[staff.id]?.id;
    const now = format(new Date(), 'HH:mm');

    const data: any = {
      staffId: staff.id,
      staffName: staff.fullName,
      date: selectedDate,
      status,
      lastUpdated: new Date().toISOString(),
    };

    if (status === 'Present') {
      data.checkIn = attendance[staff.id]?.checkIn || shiftStartTime(staff) || now;
    }

    try {
      if (existingId) {
        await updateDoc(doc(db, 'attendance', existingId), data);
      } else {
        await addDoc(collection(db, 'attendance'), data);
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  const shiftStartTime = (staff: Staff) => {
    const s = shifts.find(sh => sh.name === staff.workShift);
    return s?.startTime;
  };

  const saveDetailedAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance || !isAdmin) return;

    const { staff, data } = editingAttendance;
    const existingId = attendance[staff.id]?.id;

    const { status, overtime } = calculateAutoStatus(data.checkIn || '', data.checkOut || '', staff.workShift);

    const finalData = {
      staffId: staff.id,
      staffName: staff.fullName,
      date: selectedDate,
      status: data.status || status,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      notes: data.notes,
      overtimeMinutes: overtime,
      lastUpdated: new Date().toISOString(),
    };

    try {
      if (existingId) {
        await updateDoc(doc(db, 'attendance', existingId), finalData);
      } else {
        await addDoc(collection(db, 'attendance'), finalData);
      }
      setIsEditModalOpen(false);
      setEditingAttendance(null);
    } catch (error) {
      console.error('Error saving detail:', error);
    }
  };

  const StatusButton = ({ staff, status, label, color, icon: Icon }: any) => {
    const isActive = attendance[staff.id]?.status === status;
    return (
      <button 
        onClick={() => handleStatusChange(staff, status)}
        disabled={!isAdmin}
        className={cn(
          "flex items-center justify-center min-w-[32px] h-8 rounded-lg text-xs font-bold transition-all border",
          isActive 
            ? cn(color, "border-transparent shadow-sm scale-105") 
            : "bg-white border-border-main text-text-muted hover:border-gray-400"
        )}
      >
        {label}
      </button>
    );
  };

  const visibleStaff = isAdmin 
    ? staffList 
    : staffList.filter(s => s.id === profile?.staffId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Daily Attendance</h1>
          <p className="text-sm text-text-muted mt-1">Track and manage daily presence.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
            className="px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 text-text-muted hover:text-brand-indigo rounded-lg border border-border-main text-xs font-bold transition-all"
          >
            Today
          </button>
          
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-border-main shadow-sm text-sm">
            <button 
              onClick={() => {
                const d = parseISO(selectedDate);
                if (isValid(d)) {
                  setSelectedDate(format(subDays(d, 1), 'yyyy-MM-dd'));
                }
              }}
              className="p-1.5 hover:bg-gray-50 rounded transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4 text-text-muted" />
            </button>
            
            <div className="relative border-x border-border-main min-w-[140px]">
              <Popover.Root open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <Popover.Trigger asChild>
                  <button 
                    className="w-full flex items-center justify-center gap-2 px-4 py-1 font-bold text-text-main hover:text-brand-indigo hover:bg-indigo-50/50 rounded transition-all outline-none"
                  >
                    <Calendar className="w-4 h-4 text-brand-indigo" />
                    {safeFormat(selectedDate, 'MMM dd, yyyy')}
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content 
                    className="z-50 bg-white p-2 rounded-xl border border-border-main shadow-2xl animate-in fade-in zoom-in duration-200"
                    sideOffset={5}
                    align="center"
                  >
                    <DayPicker
                      mode="single"
                      selected={parseISO(selectedDate)}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(format(date, 'yyyy-MM-dd'));
                          setIsCalendarOpen(false);
                        }
                      }}
                      className="m-0 border-none"
                      modifiersStyles={{
                        selected: { 
                          backgroundColor: '#4F46E5', 
                          color: 'white',
                          borderRadius: '8px'
                        },
                        today: {
                          fontWeight: 'bold',
                          color: '#4F46E5'
                        }
                      }}
                    />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>

            <button 
              onClick={() => {
                const d = parseISO(selectedDate);
                if (isValid(d)) {
                  setSelectedDate(format(addDays(d, 1), 'yyyy-MM-dd'));
                }
              }}
              className="p-1.5 hover:bg-gray-50 rounded transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border-main shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] text-text-muted text-[11px] uppercase tracking-wider">
                <th className="px-6 py-3 font-bold border-b border-border-main">Staff Member</th>
                <th className="px-6 py-3 font-bold border-b border-border-main">Attendance Status</th>
                {isAdmin && <th className="px-6 py-3 font-bold border-b border-border-main">Details</th>}
                <th className="px-6 py-3 font-bold border-b border-border-main">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {visibleStaff.map((staff) => (
                <tr key={staff.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-brand-indigo font-bold text-xs uppercase">
                        {staff.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-text-main">{staff.fullName}</p>
                        </div>
                        <p className="text-[11px] text-text-muted">{staff.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <StatusButton 
                        staff={staff} 
                        status="Present" 
                        label="P" 
                        color="bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]" 
                        icon={CheckCircle2} 
                      />
                      <StatusButton 
                        staff={staff} 
                        status="Absent" 
                        label="A" 
                        color="bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]" 
                        icon={XCircle} 
                      />
                      <StatusButton 
                        staff={staff} 
                        status="Half Day" 
                        label="H" 
                        color="bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]" 
                        icon={Clock} 
                      />
                      <StatusButton 
                        staff={staff} 
                        status="Leave" 
                        label="L" 
                        color="bg-indigo-50 text-brand-indigo border-indigo-200" 
                        icon={Calendar} 
                      />
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-xs font-medium">
                      <div className="flex flex-col gap-1 text-[11px] group-hover:bg-indigo-50/50 p-1 rounded-md transition-all cursor-pointer"
                           onClick={() => {
                             if(isAdmin) {
                               setEditingAttendance({ 
                                 staff, 
                                 data: attendance[staff.id] || { checkIn: '', checkOut: '', notes: '' } 
                               });
                               setIsEditModalOpen(true);
                             }
                           }}>
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted w-8 font-bold uppercase transition-colors group-hover:text-brand-indigo">In:</span>
                          <span className={cn(attendance[staff.id]?.checkIn ? "text-text-main" : "text-gray-300")}>
                            {attendance[staff.id]?.checkIn || '--:--'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted w-8 font-bold uppercase transition-colors group-hover:text-brand-indigo">Out:</span>
                          <span className={cn(attendance[staff.id]?.checkOut ? "text-text-main" : "text-gray-300")}>
                            {attendance[staff.id]?.checkOut || '--:--'}
                          </span>
                        </div>
                        {attendance[staff.id]?.overtimeMinutes ? (
                          <div className="mt-1 flex items-center gap-1.5 text-brand-indigo font-bold bg-indigo-50 px-1.5 py-0.5 rounded w-fit">
                             <Clock className="w-2.5 h-2.5" /> 
                             {Math.floor(attendance[staff.id]!.overtimeMinutes! / 60)}h {attendance[staff.id]!.overtimeMinutes! % 60}m OT
                          </div>
                        ) : null}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      placeholder="Add note..."
                      disabled={!isAdmin}
                      value={attendance[staff.id]?.notes || ''}
                      onChange={async (e) => {
                        const existingId = attendance[staff.id]?.id;
                        if (existingId) {
                          await updateDoc(doc(db, 'attendance', existingId), { notes: e.target.value });
                        }
                      }}
                      className="bg-gray-50 border border-border-main rounded-md px-3 py-1.5 text-xs w-full focus:ring-1 focus:ring-brand-indigo outline-none transition-all"
                    />
                  </td>
                </tr>
              ))}
              {visibleStaff.length === 0 && !loading && (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="px-6 py-12 text-center text-gray-500">
                    No staff records found to mark.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Detail Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingAttendance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
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
                  <h2 className="text-xl font-bold text-text-main">Log Details</h2>
                  <p className="text-sm text-text-muted">{editingAttendance.staff.fullName} - {safeFormat(selectedDate, 'MMM dd')}</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-text-muted hover:bg-gray-50 rounded-lg transition-all">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={saveDetailedAttendance} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider text-center block">Check-In</label>
                    <input 
                      type="time" 
                      value={editingAttendance.data.checkIn || ''}
                      onChange={(e) => setEditingAttendance({
                        ...editingAttendance, 
                        data: {...editingAttendance.data, checkIn: e.target.value}
                      })}
                      className="w-full px-4 py-2 bg-gray-50 border border-border-main rounded-lg text-sm text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider text-center block">Check-Out</label>
                    <input 
                      type="time" 
                      value={editingAttendance.data.checkOut || ''}
                      onChange={(e) => setEditingAttendance({
                        ...editingAttendance, 
                        data: {...editingAttendance.data, checkOut: e.target.value}
                      })}
                      className="w-full px-4 py-2 bg-gray-50 border border-border-main rounded-lg text-sm text-center font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Forced Status</label>
                    <select 
                      value={editingAttendance.data.status || ''}
                      onChange={(e) => setEditingAttendance({
                        ...editingAttendance, 
                        data: {...editingAttendance.data, status: e.target.value as AttendanceStatus}
                      })}
                      className="w-full px-4 py-2 bg-gray-50 border border-border-main rounded-lg text-sm"
                    >
                      <option value="">Auto-Detect</option>
                      <option value="Present">Present</option>
                      <option value="Half Day">Half Day</option>
                      <option value="Absent">Absent</option>
                      <option value="Leave">Leave</option>
                    </select>
                    <p className="text-[10px] text-text-muted italic">Leave as Auto-Detect to use shift rules.</p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Notes</label>
                    <textarea 
                      value={editingAttendance.data.notes || ''}
                      onChange={(e) => setEditingAttendance({
                        ...editingAttendance, 
                        data: {...editingAttendance.data, notes: e.target.value}
                      })}
                      className="w-full px-4 py-2 bg-gray-50 border border-border-main rounded-lg text-sm resize-none"
                      rows={2}
                    />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-2.5 border border-border-main text-text-main rounded-lg font-bold hover:bg-gray-50 transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-2.5 bg-brand-indigo text-white rounded-lg font-bold shadow-sm hover:opacity-90 transition-all text-sm"
                  >
                    Save Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
