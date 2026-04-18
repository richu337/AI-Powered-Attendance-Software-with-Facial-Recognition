import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { Payroll, Staff, Attendance } from '../types';
import { useAuth } from './AuthProvider';
import { CreditCard, Plus, Search, CheckCircle2, AlertCircle, Download, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const PayrollManager: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [payrollList, setPayrollList] = useState<Payroll[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

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
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snap) => {
      setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff)));
    });

    const payrollRef = collection(db, 'payroll');
    const q = isAdmin 
      ? query(payrollRef, where('month', '==', selectedMonth))
      : query(payrollRef, where('staffId', '==', profile?.staffId || 'none'), where('month', '==', selectedMonth));

    const unsubPayroll = onSnapshot(q, (snap) => {
      setPayrollList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payroll)));
      setLoading(false);
    });

    return () => {
      unsubStaff();
      unsubPayroll();
    };
  }, [profile, isAdmin, selectedMonth]);

  const generatePayroll = async () => {
    if (!isAdmin) return;
    setIsGenerating(true);
    
    try {
      const baseDate = parseISO(selectedMonth + "-01");
      if (!isValid(baseDate)) throw new Error('Invalid month');
      
      const start = format(startOfMonth(baseDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(baseDate), 'yyyy-MM-dd');

      for (const staff of staffList) {
        // ... (existing find check)
        const existing = payrollList.find(p => p.staffId === staff.id);
        if (existing) continue;

        // ...
        const atSnap = await getDocs(query(
          collection(db, 'attendance'), 
          where('staffId', '==', staff.id),
          where('date', '>=', start),
          where('date', '<=', end)
        ));

        const attendances = atSnap.docs.map(d => d.data() as Attendance);
        const presentDays = attendances.filter(a => a.status === 'Present').length;
        const halfDays = attendances.filter(a => a.status === 'Half Day').length;
        const leaveDays = attendances.filter(a => a.status === 'Leave').length;
        
        const effectiveDays = presentDays + (halfDays * 0.5);
        
        const totalWorkDaysInMonth = eachDayOfInterval({
          start: startOfMonth(baseDate),
          end: endOfMonth(baseDate)
        }).filter(d => d.getDay() !== 0).length; // Excluding Sundays

        let finalSalary = staff.salaryAmount;
        if (staff.salaryType === 'Monthly') {
           // Pro-rata if they missed days (simplified)
           if (effectiveDays < totalWorkDaysInMonth) {
             finalSalary = Math.round((staff.salaryAmount / totalWorkDaysInMonth) * effectiveDays);
           }
        } else if (staff.salaryType === 'Daily') {
          finalSalary = staff.salaryAmount * effectiveDays;
        }

        await addDoc(collection(db, 'payroll'), {
          staffId: staff.id,
          staffName: staff.fullName,
          month: selectedMonth,
          workingDays: totalWorkDaysInMonth,
          presentDays: effectiveDays,
          leavesTaken: leaveDays,
          finalSalary,
          bonus: 0,
          deductions: 0,
          status: 'Pending',
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error generating payroll:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const markAsPaid = async (id: string) => {
    await updateDoc(doc(db, 'payroll', id), { status: 'Paid' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{isAdmin ? 'Payroll System' : 'My Salary Slips'}</h1>
          <p className="text-sm text-text-muted mt-1">Manage payments and view history.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 bg-white border border-border-main rounded-lg shadow-sm focus:ring-1 focus:ring-brand-indigo font-semibold text-sm outline-none"
          />
          {isAdmin && (
            <button 
              onClick={generatePayroll}
              disabled={isGenerating}
              className="px-5 py-2.5 bg-brand-indigo text-white rounded-lg font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 text-sm"
            >
              <Plus className="w-4 h-4" /> {isGenerating ? 'Processing...' : 'Run Payroll'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {payrollList.map((pay) => (
          <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            key={pay.id}
            className="bg-white p-6 rounded-xl border border-border-main shadow-sm relative group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand-indigo" />
              </div>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border",
                pay.status === 'Paid' 
                  ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]" 
                  : "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
              )}>
                {pay.status}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-text-main mb-1">{pay.staffName}</h3>
            <p className="text-xs text-text-muted mb-6 flex items-center gap-2 font-medium">
              <CreditCard className="w-3.5 h-3.5" /> Salary Period • {safeFormat(pay.month, 'MMMM yyyy')}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 bg-surface-main rounded-lg border border-border-main">
                <p className="text-[10px] text-text-muted font-bold uppercase mb-1 tracking-tight">Present</p>
                <p className="text-base font-bold text-text-main">{pay.presentDays} <span className="text-[10px] text-text-muted font-normal">Days</span></p>
              </div>
              <div className="p-3 bg-surface-main rounded-lg border border-border-main text-right">
                <p className="text-[10px] text-text-muted font-bold uppercase mb-1 tracking-tight">Net Salary</p>
                <p className="text-base font-bold text-brand-indigo">${pay.finalSalary}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {isAdmin && pay.status === 'Pending' && (
                <button 
                  onClick={() => markAsPaid(pay.id)}
                  className="flex-1 py-2 bg-brand-indigo text-white rounded-lg font-bold hover:opacity-90 transition-all text-xs"
                >
                  Confirm Paid
                </button>
              )}
              <button className="flex-1 py-2 bg-white text-text-main border border-border-main rounded-lg font-bold hover:bg-gray-50 transition-all text-xs">
                Get PDF
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {payrollList.length === 0 && !loading && (
        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No payroll records found</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            {isAdmin 
              ? 'Select a month and click generate to process the team payments based on their attendance.'
              : 'No payslips are available for the selected month.'
            }
          </p>
        </div>
      )}
    </div>
  );
};
