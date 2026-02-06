import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WhatsAppStatus {
  connected: boolean;
  status: string;
  instanceName?: string;
  phoneNumber?: string;
  connectedAt?: string;
  needsNewQR?: boolean;
  waitingForScan?: boolean;
  message?: string;
  reconnected?: boolean;
}

interface UseWhatsAppAutoReconnectOptions {
  userId: string | undefined;
  instanceId: string | null | undefined;
  enabled: boolean;
  intervalMs?: number;
  onStatusChange?: (status: WhatsAppStatus | null) => void;
}

export function useWhatsAppAutoReconnect({
  userId,
  instanceId,
  enabled,
  intervalMs = 2 * 60 * 1000, // 2 minutes default
  onStatusChange,
}: UseWhatsAppAutoReconnectOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  const checkAndReconnect = useCallback(async () => {
    if (!userId || !instanceId || isCheckingRef.current) return;

    isCheckingRef.current = true;
    
    try {
      console.log('[WhatsApp Auto-Reconnect] Checking instance status...');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-check-status', {
        body: { userId, attemptReconnect: true }
      });

      if (error) {
        console.error('[WhatsApp Auto-Reconnect] Error checking status:', error);
        return;
      }

      const status = data as WhatsAppStatus;
      console.log('[WhatsApp Auto-Reconnect] Status:', status);

      // Notify about status change
      if (onStatusChange) {
        onStatusChange(status);
      }

      // If reconnected automatically, show toast
      if (status?.reconnected) {
        toast.success('WhatsApp reconectado automaticamente!');
      }
      
      // If disconnected and couldn't reconnect, just log (don't spam toasts)
      if (!status?.connected && status?.needsNewQR) {
        console.log('[WhatsApp Auto-Reconnect] Instance needs new QR code');
      }
    } catch (error) {
      console.error('[WhatsApp Auto-Reconnect] Exception:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [userId, instanceId, onStatusChange]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only start monitoring if enabled and we have required data
    if (!enabled || !userId || !instanceId) {
      console.log('[WhatsApp Auto-Reconnect] Monitoring disabled or missing data');
      return;
    }

    console.log(`[WhatsApp Auto-Reconnect] Starting monitoring (interval: ${intervalMs / 1000}s)`);

    // Do an initial check immediately
    checkAndReconnect();

    // Set up the interval
    intervalRef.current = setInterval(checkAndReconnect, intervalMs);

    return () => {
      if (intervalRef.current) {
        console.log('[WhatsApp Auto-Reconnect] Stopping monitoring');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, userId, instanceId, intervalMs, checkAndReconnect]);

  return { checkNow: checkAndReconnect };
}
