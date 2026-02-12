import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, Clock, Bell, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SpamWarningDialog from './SpamWarningDialog';
import MessagePreviewDialog from './MessagePreviewDialog';
import { Badge } from '@/components/ui/badge';
import { useWhatsappMessages } from '@/hooks/useWhatsappMessages';
import { useWhatsAppStatus } from '@/contexts/WhatsAppStatusContext';
import {
  formatCurrency,
  formatDate,
  generatePixSection,
  generateSignature,
  getBillingConfig,
} from '@/lib/messageUtils';
import { CheckDiscount } from '@/types/checkDiscount';

interface CheckNotificationData {
  check: CheckDiscount;
  daysUntilDue: number;
}

interface CheckNotificationButtonProps {
  data: CheckNotificationData;
  type: 'early' | 'due_today' | 'overdue';
  className?: string;
}

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hora

const getCooldownKey = (checkId: string, type: string) => `whatsapp_cooldown_check_${type}_${checkId}`;

const isOnCooldown = (checkId: string, type: string): boolean => {
  const key = getCooldownKey(checkId, type);
  const lastSent = localStorage.getItem(key);
  if (!lastSent) return false;
  return Date.now() - parseInt(lastSent) < COOLDOWN_MS;
};

const setCooldown = (checkId: string, type: string) => {
  const key = getCooldownKey(checkId, type);
  localStorage.setItem(key, Date.now().toString());
};

const getRemainingCooldownMinutes = (checkId: string, type: string): number => {
  const key = getCooldownKey(checkId, type);
  const lastSent = localStorage.getItem(key);
  if (!lastSent) return 0;
  const remaining = COOLDOWN_MS - (Date.now() - parseInt(lastSent));
  return Math.max(0, Math.ceil(remaining / 60000));
};

export function CheckNotificationButton({ 
  data, 
  type,
  className = ''
}: CheckNotificationButtonProps) {
  const { check, daysUntilDue } = data;
  const [isSending, setIsSending] = useState(false);
  const [showSpamWarning, setShowSpamWarning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [cooldown, setCooldownState] = useState(isOnCooldown(check.id, type));
  const [remainingMinutes, setRemainingMinutes] = useState(getRemainingCooldownMinutes(check.id, type));
  const { profile } = useProfile();
  const { user } = useAuth();
  const { messageCount, registerMessage } = useWhatsappMessages(check.id);

  const clientPhone = check.clients?.phone;
  const clientName = check.clients?.full_name || check.issuer_name || 'Cliente';

  const { isInstanceConnected, markDisconnected } = useWhatsAppStatus();
  const canSendViaAPI =
    isInstanceConnected &&
    profile?.whatsapp_instance_id &&
    profile?.whatsapp_connected_phone &&
    profile?.whatsapp_to_clients_enabled &&
    clientPhone;

  const canShowButton = !!clientPhone;

  // Update cooldown state every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldownState(isOnCooldown(check.id, type));
      setRemainingMinutes(getRemainingCooldownMinutes(check.id, type));
    }, 60000);

    return () => clearInterval(interval);
  }, [check.id, type]);

  const generateMessage = (): string => {
    const config = getBillingConfig(profile?.billing_message_config);
    
    const profit = check.purchase_value && check.purchase_value > 0
      ? check.nominal_value - check.purchase_value
      : check.discount_amount;

    let message = '';
    
    if (type === 'overdue') {
      const daysOverdue = Math.abs(daysUntilDue);
      message = `⚠️ *Atenção ${clientName}*\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
      message += `🚨 *CHEQUE EM ATRASO*\n\n`;
      message += `📋 *Cheque Nº:* ${check.check_number}\n`;
      message += `🏦 *Banco:* ${check.bank_name}\n`;
      message += `💵 *Valor:* ${formatCurrency(check.nominal_value)}\n`;
      message += `📅 *Vencimento:* ${formatDate(check.due_date)}\n`;
      message += `⏰ *Dias em Atraso:* ${daysOverdue}\n`;
    } else if (type === 'due_today') {
      message = `Olá *${clientName}*!\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
      message += `📅 *CHEQUE VENCE HOJE*\n\n`;
      message += `📋 *Cheque Nº:* ${check.check_number}\n`;
      message += `🏦 *Banco:* ${check.bank_name}\n`;
      message += `💵 *Valor:* ${formatCurrency(check.nominal_value)}\n`;
      message += `📅 *Vencimento:* Hoje (${formatDate(check.due_date)})\n`;
    } else {
      // early
      message = `Olá *${clientName}*!\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
      message += `📋 *LEMBRETE - CHEQUE A VENCER*\n\n`;
      message += `📋 *Cheque Nº:* ${check.check_number}\n`;
      message += `🏦 *Banco:* ${check.bank_name}\n`;
      message += `💵 *Valor:* ${formatCurrency(check.nominal_value)}\n`;
      message += `📅 *Vencimento:* ${formatDate(check.due_date)} (em ${daysUntilDue} dia${daysUntilDue > 1 ? 's' : ''})\n`;
    }
    
    // PIX info
    if (config.includePixKey) {
      message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null, profile?.pix_pre_message || null);
    }
    
    // Closing message
    if (type === 'overdue') {
      message += `\n⚠️ *Regularize o mais rápido possível para evitar restrições.*\n`;
    } else if (type === 'due_today') {
      message += `\nEvite problemas pagando em dia!`;
    } else {
      message += `\nQualquer dúvida, estou à disposição! 😊`;
    }

    if (config.customClosingMessage) {
      message += `\n${config.customClosingMessage}`;
    }
    
    // Signature
    if (config.includeSignature) {
      const signatureName = profile?.billing_signature_name || profile?.company_name;
      message += generateSignature(signatureName);
    }

    return message;
  };

  const generateSimpleMessage = (): string => {
    const config = getBillingConfig(profile?.billing_message_config);
    
    let message = '';
    
    if (type === 'overdue') {
      const daysOverdue = Math.abs(daysUntilDue);
      message = `⚠️ *${clientName}*\n\n`;
      message += `🚨 *CHEQUE EM ATRASO*\n\n`;
      message += `Cheque: ${check.check_number}\n`;
      message += `Valor: ${formatCurrency(check.nominal_value)}\n`;
      message += `Atraso: ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}\n`;
    } else if (type === 'due_today') {
      message = `Olá *${clientName}*!\n\n`;
      message += `📅 *CHEQUE VENCE HOJE*\n\n`;
      message += `Cheque: ${check.check_number}\n`;
      message += `Valor: ${formatCurrency(check.nominal_value)}\n`;
    } else {
      message = `Olá *${clientName}*!\n\n`;
      message += `📋 *LEMBRETE - CHEQUE*\n\n`;
      message += `Cheque: ${check.check_number}\n`;
      message += `Valor: ${formatCurrency(check.nominal_value)}\n`;
      message += `Vence em ${daysUntilDue}d\n`;
    }
    
    if (config.includePixKey && profile?.pix_key) {
      message += `\nPIX: ${profile.pix_key}`;
    }

    return message;
  };

  const handleSend = async (editedMessage: string) => {
    if (!canSendViaAPI) {
      if (!profile?.whatsapp_connected_phone) {
        toast.error('WhatsApp não conectado. Reconecte nas configurações.');
      } else if (!profile?.whatsapp_to_clients_enabled) {
        toast.error('Ative o envio de WhatsApp para clientes nas configurações.');
      } else {
        toast.error('Cliente não possui telefone cadastrado.');
      }
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (cooldown) {
      toast.error(`Aguarde ${remainingMinutes} minutos para enviar novamente`);
      return;
    }

    setIsSending(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp-to-client', {
        body: { 
          userId: user.id,
          clientPhone: clientPhone,
          message: editedMessage
        },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        setCooldown(check.id, type);
        setCooldownState(true);
        setRemainingMinutes(60);
        
        await registerMessage({
          loanId: check.id,
          contractType: 'contract', // Using 'contract' as generic type for check
          messageType: type,
          clientPhone: clientPhone,
          clientName: clientName,
        });
        
        const successMessages = {
          overdue: 'Cobrança enviada!',
          due_today: 'Lembrete enviado!',
          early: 'Lembrete antecipado enviado!',
        };
        toast.success(successMessages[type]);
        setShowPreview(false);
      } else {
        throw new Error(result?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Error sending check notification:', error);
      
      let errorMessage = 'Tente novamente';
      const errorStr = error.message || '';
      
      if (errorStr.includes('não possui WhatsApp') || errorStr.includes('NUMBER_NOT_ON_WHATSAPP')) {
        errorMessage = `O número não possui WhatsApp.`;
      } else if (errorStr.includes('Reconecte') || errorStr.includes('desconectado') || errorStr.includes('502') || errorStr.includes('503')) {
        markDisconnected();
        setShowPreview(false);
        return;
      } else if (errorStr) {
        errorMessage = errorStr;
      }
      
      toast.error('Erro: ' + errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleButtonClick = () => {
    if (canSendViaAPI && cooldown) {
      toast.error(`Aguarde ${remainingMinutes} minutos para enviar novamente`);
      return;
    }
    if (canSendViaAPI) {
      setShowSpamWarning(true);
    } else {
      setShowPreview(true);
    }
  };

  const handleConfirmSpamWarning = () => {
    setShowSpamWarning(false);
    setShowPreview(true);
  };

  if (!canShowButton) return null;

  const previewMode = canSendViaAPI ? 'send' : 'whatsapp_link';

  // Button config based on type
  const buttonConfig = {
    overdue: {
      variant: 'destructive' as const,
      icon: AlertTriangle,
      label: 'Cobrar',
      className: '',
    },
    due_today: {
      variant: 'outline' as const,
      icon: Bell,
      label: 'Cobrar Hoje',
      className: 'bg-yellow-500/20 border-yellow-400/50 text-yellow-700 hover:bg-yellow-500/30',
    },
    early: {
      variant: 'outline' as const,
      icon: MessageCircle,
      label: 'Lembrar',
      className: 'bg-blue-500/20 border-blue-400/50 text-blue-700 hover:bg-blue-500/30',
    },
  };

  const config = buttonConfig[type];
  const Icon = config.icon;

  return (
    <>
      <Button 
        variant={config.variant}
        size="sm"
        onClick={handleButtonClick}
        disabled={isSending || (cooldown && !!canSendViaAPI)}
        className={`h-7 text-xs px-2 ${config.className} ${cooldown && canSendViaAPI ? 'opacity-60' : ''} ${className}`}
      >
        {isSending ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : cooldown && canSendViaAPI ? (
          <Clock className="w-3 h-3 mr-1" />
        ) : !canSendViaAPI ? (
          <ExternalLink className="w-3 h-3 mr-1" />
        ) : (
          <Icon className="w-3 h-3 mr-1" />
        )}
        {isSending ? '...' : cooldown && canSendViaAPI ? `${remainingMinutes}m` : !canSendViaAPI ? 'WhatsApp' : config.label}
        {messageCount > 0 && (
          <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
            {messageCount}x
          </Badge>
        )}
      </Button>

      <SpamWarningDialog
        open={showSpamWarning}
        onOpenChange={setShowSpamWarning}
        onConfirm={handleConfirmSpamWarning}
      />

      <MessagePreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        simpleMessage={generateSimpleMessage()}
        completeMessage={generateMessage()}
        recipientName={clientName}
        recipientType="client"
        onConfirm={handleSend}
        isSending={isSending}
        mode={previewMode}
        clientPhone={clientPhone}
      />
    </>
  );
}

// Convenience components for each notification type
export function SendCheckOverdueNotification({ check, daysUntilDue, className }: { check: CheckDiscount; daysUntilDue: number; className?: string }) {
  return <CheckNotificationButton data={{ check, daysUntilDue }} type="overdue" className={className} />;
}

export function SendCheckDueTodayNotification({ check, daysUntilDue, className }: { check: CheckDiscount; daysUntilDue: number; className?: string }) {
  return <CheckNotificationButton data={{ check, daysUntilDue }} type="due_today" className={className} />;
}

export function SendCheckEarlyNotification({ check, daysUntilDue, className }: { check: CheckDiscount; daysUntilDue: number; className?: string }) {
  return <CheckNotificationButton data={{ check, daysUntilDue }} type="early" className={className} />;
}
