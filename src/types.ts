export type UserRole = 'admin' | 'staff';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  staffId?: string;
}

export type SalaryType = 'Monthly' | 'Daily' | 'Hourly';

export interface Staff {
  id: string; // Internal UUID
  staffId: string; // Human readable ID (e.g. S-001)
  fullName: string;
  phoneNumber: string;
  email: string;
  role: string;
  joiningDate: string;
  salaryType: SalaryType;
  salaryAmount: number;
  workShift: string;
  userId?: string;
  isAdmin?: boolean;
  pin?: string; // For clocking in without Google
  password?: string; // For direct login with Staff ID
  faceEmbedding?: number[]; // For Python face recognition
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Half Day' | 'Leave';

export interface Attendance {
  id: string;
  staffId: string; // Human readable ID or Internal ID link
  staffName: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  aiVerified?: boolean;
  faceMatchScore?: number; // Score from Python
  overtimeMinutes?: number;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  minHoursForFullDay: number;
}

export type LeaveType = 'Sick' | 'Casual' | 'Emergency' | 'Other';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  rejectionReason?: string;
  status: LeaveStatus;
  appliedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  details?: string;
  type: 'leave_request' | 'leave_status_update';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface Payroll {
  id: string;
  staffId: string;
  staffName: string;
  month: string;
  workingDays: number;
  presentDays: number;
  leavesTaken: number;
  finalSalary: number;
  bonus: number;
  deductions: number;
  status: 'Paid' | 'Pending';
  generatedAt: string;
}
