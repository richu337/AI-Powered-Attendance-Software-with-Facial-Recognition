/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { StaffManager } from './components/StaffManager';
import { AttendanceManager } from './components/AttendanceManager';
import { LeaveManager } from './components/LeaveManager';
import { PayrollManager } from './components/PayrollManager';
import { NotificationManager } from './components/NotificationManager';
import { SettingsManager } from './components/SettingsManager';
import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/attendance" element={<AttendanceManager />} />
        <Route path="/leaves" element={<LeaveManager />} />
        <Route path="/notifications" element={<NotificationManager />} />
        
        {/* Admin Only Routes */}
        {isAdmin && (
          <>
            <Route path="/staff" element={<StaffManager />} />
            <Route path="/settings" element={<SettingsManager />} />
          </>
        )}

        {/* Global Payroll (Content depends on role) */}
        <Route path="/payroll" element={<PayrollManager />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
