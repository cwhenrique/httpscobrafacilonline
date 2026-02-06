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
  canAttemptReconnect?: boolean;
}

interface UseWhatsAppAutoReconnectOptions {
  userId: string | undefined;
  instanceId: string | null | undefined;
  enabled: boolean;
  intervalMs?: number;
  onStatusChange?: (status: WhatsAppStatus | null) => void;
}

const MAX_CONSECUTIVE_FAILURES = 3;
const MIN_BACKOFF_MS = 60 * 1000; // 1 minuto mínimo entre tentativas após falha

export function useWhatsAppAutoReconnect({
  userId,
  instanceId,
  enabled,
  intervalMs = 2 * 60 * 1000, // 2 minutes default
  onStatusChange,
}: UseWhatsAppAutoReconnectOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const lastFailureTimeRef = useRef<number>(0);
  const isFirstCheckRef = useRef(true);

  const checkAndReconnect = useCallback(async () => {
    if (!userId || !instanceId || isCheckingRef.current) return;

    // Se atingiu o máximo de falhas, parar de tentar
    if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
      console.log('[WhatsApp Auto-Reconnect] Max failures reached, stopping automatic attempts');
      return;
    }

    // Aplicar backoff após falhas
    if (consecutiveFailuresRef.current > 0) {
      const timeSinceLastFailure = Date.now() - lastFailureTimeRef.current;
      if (timeSinceLastFailure < MIN_BACKOFF_MS) {
        console.log(`[WhatsApp Auto-Reconnect] Backoff active, waiting ${Math.ceil((MIN_BACKOFF_MS - timeSinceLastFailure) / 1000)}s`);
        return;
      }
    }

    isCheckingRef.current = true;
    
    try {
      // Na primeira verificação, apenas lê o status (sem tentar reconectar)
      // Nas verificações seguintes, tenta reconectar se desconectado
      const shouldAttemptReconnect = !isFirstCheckRef.current;
      
      console.log(`[WhatsApp Auto-Reconnect] Checking status (attemptReconnect: ${shouldAttemptReconnect})`);
      
      const { data, error } = await supabase.functions.invoke('whatsapp-check-status', {
        body: { userId, attemptReconnect: shouldAttemptReconnect }
      });

      if (error) {
        console.error('[WhatsApp Auto-Reconnect] Error checking status:', error);
        consecutiveFailuresRef.current++;
        lastFailureTimeRef.current = Date.now();
        return;
      }

      const status = data as WhatsAppStatus;
      console.log('[WhatsApp Auto-Reconnect] Status:', status);

      // Marcar primeira verificação como concluída
      isFirstCheckRef.current = false;

      // Notify about status change
      if (onStatusChange) {
        onStatusChange(status);
      }

      // Se reconectou automaticamente, mostrar toast
      if (status?.reconnected) {
        toast.success('WhatsApp reconectado automaticamente!');
        consecutiveFailuresRef.current = 0;
      } else if (status?.connected) {
        // Conexão OK, resetar contador de falhas
        consecutiveFailuresRef.current = 0;
      } else {
        // Desconectado
        consecutiveFailuresRef.current++;
        lastFailureTimeRef.current = Date.now();
        
        // Se atingiu máximo de falhas, notificar usuário
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          console.log('[WhatsApp Auto-Reconnect] Max failures reached. User needs to reconnect manually.');
          // Não mostrar toast aqui para não ser intrusivo
        } else if (status?.needsNewQR) {
          console.log('[WhatsApp Auto-Reconnect] Instance needs new QR code');
        }
      }
    } catch (error) {
      console.error('[WhatsApp Auto-Reconnect] Exception:', error);
      consecutiveFailuresRef.current++;
      lastFailureTimeRef.current = Date.now();
    } finally {
      isCheckingRef.current = false;
    }
  }, [userId, instanceId, onStatusChange]);

  // Função para resetar o contador de falhas (pode ser chamada externamente)
  const resetFailures = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    lastFailureTimeRef.current = 0;
    isFirstCheckRef.current = true;
  }, []);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Reset state when dependencies change
    consecutiveFailuresRef.current = 0;
    lastFailureTimeRef.current = 0;
    isFirstCheckRef.current = true;

    // Only start monitoring if enabled and we have required data
    if (!enabled || !userId || !instanceId) {
      console.log('[WhatsApp Auto-Reconnect] Monitoring disabled or missing data');
      return;
    }

    console.log(`[WhatsApp Auto-Reconnect] Starting monitoring (interval: ${intervalMs / 1000}s)`);

    // Do an initial check immediately (passive, no reconnect)
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

  return { 
    checkNow: checkAndReconnect,
    resetFailures,
    consecutiveFailures: consecutiveFailuresRef.current,
  };
}
