import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Notification } from '../types';
import { useAuth } from './AuthProvider';
import { Bell, BellOff, CheckCircle2, Clock, Trash2, ExternalLink, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export const NotificationManager: React.FC = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    });

    return unsub;
  }, [profile]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const safeFormat = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return isValid(d) ? format(d, 'MMM dd, HH:mm') : 'Recently';
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Notifications</h1>
          <p className="text-sm text-text-muted mt-1">Stay updated with leave requests and system alerts.</p>
        </div>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead}
            className="flex items-center justify-center gap-2 bg-indigo-50 text-brand-indigo px-4 py-2 rounded-lg font-semibold hover:bg-indigo-100 transition-all text-sm"
          >
            <CheckCircle2 className="w-4 h-4" /> Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {notifications.map((notif) => (
            <motion.div
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={notif.id}
              className={cn(
                "group relative bg-white p-4 rounded-xl border transition-all flex items-start gap-4",
                notif.read ? "border-border-main" : "border-brand-indigo ring-1 ring-brand-indigo/10 shadow-md"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors",
                notif.read ? "bg-gray-50 text-text-muted border-border-main" : "bg-indigo-50 text-brand-indigo border-indigo-100"
              )}>
                {notif.type === 'leave_request' ? <Inbox className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0 pr-12">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className={cn("text-sm font-bold truncate", notif.read ? "text-text-main" : "text-brand-indigo")}>
                    {notif.message}
                  </h3>
                  {!notif.read && <span className="w-2 h-2 bg-brand-indigo rounded-full animate-pulse flex-shrink-0" />}
                </div>
                {notif.details && <p className="text-xs text-text-muted line-clamp-2 mb-2 font-medium">{notif.details}</p>}
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-[10px] text-text-muted font-bold uppercase tracking-wider">
                    <Clock className="w-3 h-3" /> {safeFormat(notif.createdAt)}
                  </span>
                  {notif.link && (
                    <button 
                      onClick={() => {
                        markAsRead(notif.id);
                        navigate(notif.link!);
                      }}
                      className="flex items-center gap-1 text-[10px] text-brand-indigo font-bold uppercase tracking-wider hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> View Details
                    </button>
                  )}
                </div>
              </div>

              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {!notif.read && (
                  <button 
                    onClick={() => markAsRead(notif.id)}
                    className="p-2 text-text-muted hover:text-brand-indigo hover:bg-indigo-50 rounded-lg transition-all"
                    title="Mark as read"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => deleteNotification(notif.id)}
                  className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {notifications.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-border-main mb-4 shadow-sm">
              <BellOff className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-bold text-text-main mb-1">No notifications yet</h3>
            <p className="text-sm text-text-muted max-w-xs">We'll let you know when there's an update on your requests or system activity.</p>
          </div>
        )}
      </div>
    </div>
  );
};
