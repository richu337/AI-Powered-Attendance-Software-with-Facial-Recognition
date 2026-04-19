import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { supabase } from '../supabase';
import { 
  BarChart3, 
  Users, 
  CalendarCheck, 
  Palmtree, 
  CreditCard, 
  LogOut, 
  Menu, 
  X,
  Bell,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, isAdmin, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const navigate = useNavigate();

  const fetchUnreadCount = async () => {
    if (!profile?.uid) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.uid)
      .eq('read', false);
    setUnreadCount(count || 0);
  };

  React.useEffect(() => {
    if (!profile?.uid) return;
    fetchUnreadCount();

    const notifSubscription = supabase
      .channel('layout_notifs')
      .on('postgres_changes' as any, { event: '*', table: 'notifications', filter: `user_id=eq.${profile.uid}` }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notifSubscription);
    };
  }, [profile]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', icon: <BarChart3 className="w-5 h-5" />, path: '/', always: true },
    { name: 'Staff', icon: <Users className="w-5 h-5" />, path: '/staff', adminOnly: true },
    { name: 'Attendance', icon: <CalendarCheck className="w-5 h-5" />, path: '/attendance', always: true },
    { name: 'Leaves', icon: <Palmtree className="w-5 h-5" />, path: '/leaves', always: true },
    { name: 'Notifications', icon: <Bell className="w-5 h-5" />, path: '/notifications', always: true, badge: unreadCount > 0 ? unreadCount : null },
    { name: 'Payroll', icon: <CreditCard className="w-5 h-5" />, path: '/payroll', adminOnly: true },
    { name: 'My Salary', icon: <CreditCard className="w-5 h-5" />, path: '/payroll', staffOnly: true },
    { name: 'Settings', icon: <Settings className="w-5 h-5" />, path: '/settings', adminOnly: true },
  ];

  const filteredNav = navItems.filter(item => {
    if (item.always) return true;
    if (item.adminOnly) return isAdmin;
    if (item.staffOnly) return !isAdmin;
    return false;
  });

  return (
    <div className="min-h-screen bg-surface-main flex font-sans">
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-3 bg-white rounded-xl shadow-lg border border-border-main"
        >
          {isSidebarOpen ? <X className="w-6 h-6 text-text-main" /> : <Menu className="w-6 h-6 text-text-main" />}
        </button>
      </div>

      <AnimatePresence>
        {(isSidebarOpen || window.innerWidth >= 1024) && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={cn(
              "fixed lg:static inset-y-0 left-0 w-60 bg-sidebar-bg text-white z-40 transition-all shadow-xl lg:shadow-none flex flex-col",
              isSidebarOpen ? "block" : "hidden lg:flex"
            )}
          >
            <div className="p-6 pb-8 flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight text-brand-indigo">AttendFlow AI</span>
            </div>

            <nav className="flex-1 space-y-1">
              <div className="px-6 py-2">
                <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Main Navigation</p>
              </div>
              {filteredNav.map((item) => (
                <NavLink
                  key={item.path + item.name}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-6 py-3.5 transition-all text-sm font-medium",
                    isActive 
                      ? "bg-sidebar-active text-white border-r-3 border-brand-indigo" 
                      : "text-[#9CA3AF] hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="opacity-80">{item.icon}</span>
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="bg-brand-indigo text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-white/5">
              <div className="mb-4 flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <div className="w-8 h-8 bg-brand-indigo/20 rounded-full flex items-center justify-center text-brand-indigo font-bold text-xs uppercase">
                  {profile?.displayName?.charAt(0) || 'U'}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-white truncate">{profile?.displayName}</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">
                    {profile?.role} Mode
                  </p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-6 py-3 text-red-400 hover:bg-red-900/10 rounded-xl transition-all font-semibold text-sm"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="fixed lg:static top-0 left-0 right-0 h-16 bg-white border-b border-border-main flex items-center justify-between px-8 z-30">
          <div className="font-semibold text-lg">
            {navItems.find(n => window.location.pathname === n.path)?.name || 'Overview'}
          </div>
          <div className="flex items-center gap-4">
            <NavLink 
              to="/notifications" 
              className={cn(
                "p-2 rounded-lg transition-all relative",
                unreadCount > 0 ? "text-brand-indigo bg-indigo-50" : "text-text-muted hover:bg-gray-50"
              )}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
              )}
            </NavLink>
            <span className="px-3 py-1 bg-indigo-50 text-brand-indigo text-xs font-bold rounded-full border border-indigo-100 uppercase tracking-wider">
              {profile?.role} Mode
            </span>
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-text-muted font-bold text-xs">
              {profile?.displayName?.split(' ').map(n => n[0]).join('')}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 pt-24 lg:pt-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
