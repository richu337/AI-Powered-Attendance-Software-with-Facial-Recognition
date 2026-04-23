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
  Settings as SettingsIcon,
  ShieldAlert
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isAdmin, logout } = useAuth();
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
    { 
      name: 'Settings (Configuration)', 
      icon: <SettingsIcon className="w-5 h-5" />, 
      path: '/settings', 
      adminOnly: true
    },
  ];

  const filteredNav = navItems.filter(item => {
    if (item.name === 'Settings (Configuration)') {
      const email = profile?.email?.toLowerCase().trim() || user?.email?.toLowerCase().trim();
      return isAdmin || email === 'rayhanjaleel904@gmail.com';
    }
    
    if (item.always) return true;
    if (item.adminOnly) return isAdmin;
    if (item.staffOnly) return !isAdmin;
    return false;
  });

  return (
    <div className="min-h-screen bg-bg-main flex font-sans selection:bg-brand-accent/20">
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2.5 bg-white rounded-xl shadow-xl border border-border-subtle text-brand-primary"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {(isSidebarOpen || window.innerWidth >= 1024) && (
          <motion.aside 
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "fixed lg:static inset-y-0 left-0 w-64 bg-brand-primary text-white z-40 flex flex-col border-r border-white/5",
              isSidebarOpen ? "block" : "hidden lg:flex"
            )}
          >
            {/* Sidebar Header */}
            <div className="h-16 flex items-center px-6 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center shadow-lg shadow-brand-accent/20">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold tracking-tight text-white/95">AttendFlow AI</span>
              </div>
            </div>

            {/* Navigation Section */}
            <nav className="flex-1 py-6 overflow-y-auto px-3 space-y-0.5 custom-scrollbar">
              <div className="px-3 mb-4">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Platform</p>
              </div>
              
              {filteredNav.map((item) => (
                <NavLink
                  key={item.path + item.name}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) => cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium",
                    isActive 
                      ? "bg-white/10 text-white shadow-sm" 
                      : "text-white/50 hover:bg-white/5 hover:text-white/90"
                  )}
                >
                  <motion.span 
                    whileHover={{ scale: 1.1 }}
                    className={cn(
                      "transition-colors",
                      "group-hover:text-brand-accent"
                    )}
                  >
                    {item.icon}
                  </motion.span>
                  <span className="flex-1 tracking-tight">{item.name}</span>
                  {item.badge && (
                    <span className="bg-brand-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg shadow-brand-accent/20">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 bg-black/10 border-t border-white/5">
              <div className="mb-4 flex items-center gap-3 p-2.5 rounded-xl bg-white/5">
                <div className="w-9 h-9 bg-brand-accent/10 rounded-lg flex items-center justify-center text-brand-accent font-bold text-sm uppercase ring-1 ring-brand-accent/20">
                  {profile?.displayName?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate leading-none mb-1">{profile?.displayName}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">
                    {profile?.role}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-all font-semibold text-xs group"
              >
                <LogOut className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                Logout Session
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md sticky top-0 border-b border-border-subtle z-30 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-brand-primary uppercase tracking-widest">
              {navItems.find(n => window.location.pathname === n.path)?.name || 'System Overview'}
            </h2>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-6">
            <NavLink 
              to="/notifications" 
              className={cn(
                "p-2 rounded-xl transition-all relative group",
                unreadCount > 0 ? "text-brand-accent bg-brand-accent/10" : "text-text-secondary hover:bg-bg-main"
              )}
            >
              <Bell className="w-5 h-5 transition-transform group-hover:rotate-12" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full border-2 border-white ring-2 ring-brand-accent/10" />
              )}
            </NavLink>
            
            <div className="h-8 w-px bg-border-subtle hidden sm:block" />
            
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-brand-primary leading-tight">{profile?.displayName}</p>
                <p className="text-[10px] text-text-tertiary lowercase tracking-tighter font-black">{profile?.email}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-bg-main border border-border-subtle flex items-center justify-center text-brand-primary font-bold text-xs ring-offset-2 group-hover:ring-2 group-hover:ring-brand-accent/20 transition-all">
                {profile?.displayName?.split(' ').map(n => n[0]).join('')}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 relative">
          <div className="p-4 sm:p-8 w-full relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
