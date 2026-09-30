// src/hooks/useNotifications.js
//
// Mirrors wholesalerapp/src/hooks/useNotifications.js.
//
// DELTA: the wholesaler's twin reads a local AsyncStorage feed written by its
// push handler. The Retailer app keeps no local mirror — its bell list is served
// by the API (see NotificationsScreen), which also returns the authoritative
// `unread_count`. So this hook loads from the API and falls back to counting
// unread rows locally when the server omits the total.
import { useCallback, useEffect, useState } from 'react';
import { notificationService } from '../services/notificationService';

export default function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationService.list({ limit: 50 });
      const list = Array.isArray(res) ? res : (res?.notifications ?? []);
      setNotifications(list);
      setUnreadCount(
        res?.unread_count ?? list.filter(n => !(n.is_read ?? n.read)).length,
      );
    } catch (err) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Optimistic local mark-as-read, then persist. */
  const markRead = useCallback(async (id) => {
    setNotifications(prev =>
      prev.map(n => (n._id === id || n.id === id) ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await notificationService.markRead(id);
    } catch {
      // The list is refetched on next mount; a failed write is not worth a toast.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationService.markAllRead();
    } catch { /* refetched on next mount */ }
  }, []);

  return { notifications, unreadCount, loading, error, markRead, markAllRead, reload: load };
}
