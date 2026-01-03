import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Notification } from '@/types/database';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();

  const fetchNotifications = useCallback(async () => {
    if (!user || employeeLoading || !effectiveUserId) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
    } else {
      const typedData = (data || []).map(n => ({
        ...n,
        type: n.type as 'info' | 'warning' | 'error' | 'success'
      }));
      setNotifications(typedData);
      setUnreadCount(typedData.filter(n => !n.is_read).length);
    }
    setLoading(false);
  }, [user, effectiveUserId, employeeLoading]);

  const createNotification = async (notification: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    loan_id?: string;
    client_id?: string;
  }) => {
    if (!user || !effectiveUserId) return;

    const { error } = await supabase
      .from('notifications')
      .insert({
        ...notification,
        user_id: effectiveUserId,
        type: notification.type || 'info',
      });

    if (error) {
      console.error('Error creating notification:', error);
    } else {
      await fetchNotifications();
    }
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user || !effectiveUserId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', effectiveUserId)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const deleteNotification = async (id: string) => {
    const notification = notifications.find(n => n.id === id);
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  const clearAllNotifications = async () => {
    if (!user || !effectiveUserId) return;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', effectiveUserId);

    if (!error) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    refetch: fetchNotifications,
  };
}
