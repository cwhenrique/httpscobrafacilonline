import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  isLoading: boolean;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const vapidKeyRef = useRef<string | null>(null);
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'unsupported',
    isLoading: true,
  });

  // Fetch VAPID public key from backend
  const getVapidKey = useCallback(async (): Promise<string | null> => {
    if (vapidKeyRef.current) return vapidKeyRef.current;
    
    try {
      const { data, error } = await supabase.functions.invoke('get-vapid-public-key');
      if (error) throw error;
      vapidKeyRef.current = data?.publicKey || null;
      return vapidKeyRef.current;
    } catch (error) {
      console.error('Error fetching VAPID key:', error);
      return null;
    }
  }, []);

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const isSupported = 
      'serviceWorker' in navigator && 
      'PushManager' in window && 
      'Notification' in window;
    
    return isSupported;
  }, []);

  // Get current subscription status
  const checkSubscription = useCallback(async () => {
    if (!checkSupport() || !user) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      const permission = Notification.permission;
      const isSubscribed = subscription !== null;

      // Verify subscription exists in database
      if (isSubscribed && subscription) {
        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .eq('is_active', true)
          .maybeSingle();

        setState({
          isSupported: true,
          isSubscribed: !!data,
          permission,
          isLoading: false,
        });
      } else {
        setState({
          isSupported: true,
          isSubscribed: false,
          permission,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [checkSupport, user]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!checkSupport() || !user) {
      toast.error('Notificações push não suportadas neste dispositivo');
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Fetch VAPID key from backend
      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        toast.error('Configuração de notificações não disponível');
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error('Permissão de notificação negada');
        setState(prev => ({ ...prev, permission, isLoading: false }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const subscriptionJson = subscription.toJSON();
      
      if (!subscriptionJson.endpoint || !subscriptionJson.keys) {
        throw new Error('Invalid subscription data');
      }

      // Get device name
      const deviceName = navigator.userAgent.includes('Mobile') 
        ? 'Celular' 
        : navigator.userAgent.includes('Tablet') 
          ? 'Tablet' 
          : 'Computador';

      // Save to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth,
          device_name: deviceName,
          is_active: true,
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (error) throw error;

      setState({
        isSupported: true,
        isSubscribed: true,
        permission: 'granted',
        isLoading: false,
      });

      toast.success('Notificações ativadas com sucesso!');
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Erro ao ativar notificações');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [checkSupport, user, getVapidKey]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      toast.success('Notificações desativadas');
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      toast.error('Erro ao desativar notificações');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Toggle subscription
  const toggle = useCallback(async () => {
    if (state.isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [state.isSubscribed, subscribe, unsubscribe]);

  // Initialize
  useEffect(() => {
    const isSupported = checkSupport();
    
    if (!isSupported) {
      setState({
        isSupported: false,
        isSubscribed: false,
        permission: 'unsupported',
        isLoading: false,
      });
      return;
    }

    checkSubscription();
  }, [checkSupport, checkSubscription, user]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    toggle,
    checkSubscription,
  };
}
