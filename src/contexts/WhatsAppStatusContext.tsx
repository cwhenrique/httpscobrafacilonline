import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';

interface WhatsAppStatusContextType {
  isInstanceConnected: boolean;
  markDisconnected: () => void;
}

const WhatsAppStatusContext = createContext<WhatsAppStatusContextType>({
  isInstanceConnected: false,
  markDisconnected: () => {},
});

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function WhatsAppStatusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [isInstanceConnected, setIsInstanceConnected] = useState(false);
  const isCheckingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use refs for values that change frequently to avoid recreating callbacks
  const userIdRef = useRef<string | undefined>();
  const instanceIdRef = useRef<string | null | undefined>();
  const hasInstanceRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    instanceIdRef.current = profile?.whatsapp_instance_id;
  }, [profile?.whatsapp_instance_id]);

  const hasInstance = !!(
    profile?.whatsapp_instance_id &&
    profile?.whatsapp_connected_phone &&
    profile?.whatsapp_to_clients_enabled
  );

  useEffect(() => {
    hasInstanceRef.current = hasInstance;
  }, [hasInstance]);

  // Stable callback that reads from refs
  const checkStatus = useCallback(async () => {
    const userId = userIdRef.current;
    const instanceId = instanceIdRef.current;
    if (!userId || !instanceId || isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-check-status', {
        body: { userId, attemptReconnect: false },
      });

      if (error) {
        console.log('[WhatsApp Global] Status check error, marking disconnected');
        setIsInstanceConnected(false);
      } else {
        setIsInstanceConnected(!!data?.connected);
      }
    } catch {
      setIsInstanceConnected(false);
    } finally {
      isCheckingRef.current = false;
    }
  }, []); // No dependencies - reads from refs

  const markDisconnected = useCallback(() => {
    setIsInstanceConnected(false);
  }, []);

  // Start/stop polling - stable effect that doesn't depend on checkStatus
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!hasInstance || !user?.id) {
      // Don't reset isInstanceConnected here to avoid flicker during profile refetch
      return;
    }

    // Initial check
    checkStatus();

    // Poll every 2 minutes
    intervalRef.current = setInterval(checkStatus, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasInstance, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WhatsAppStatusContext.Provider value={{ isInstanceConnected, markDisconnected }}>
      {children}
    </WhatsAppStatusContext.Provider>
  );
}

export function useWhatsAppStatus() {
  return useContext(WhatsAppStatusContext);
}
