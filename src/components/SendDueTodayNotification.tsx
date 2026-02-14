import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, Clock, Bell, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SpamWarningDialog from './SpamWarningDialog';
import MessagePreviewDialog from './MessagePreviewDialog';
import { Badge } from '@/components/ui/badge';
import { useWhatsappMessages } from '@/hooks/useWhatsappMessages';
import { useWhatsAppStatus } from '@/contexts/WhatsAppStatusContext';

interface DueTodayData {
  clientName: string;
  clientPhone: string;
  contractType: 'loan' | 'product' | 'vehicle' | 'contract';
  installmentNumber?: number;
  totalInstallments?: number;
  amount: number;
  dueDate: string;
  loanId: string;
  interestAmount?: number;
  principalAmount?: number;
  isDaily?: boolean;
  // NOVO: Campos para status das parcelas com emojis
  installmentDates?: string[];
  paidCount?: number;
  paidIndices?: number[]; // indices (0-based) das parcelas efetivamente pagas
  // NOVO: Pagamento parcial de juros
  partialInterestPaid?: number;
  partialInterestPending?: number;
}

interface SendDueTodayNotificationProps {
  data: DueTodayData;
  className?: string;
}

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hora em milissegundos

const getCooldownKey = (loanId: string) => `whatsapp_cooldown_duetoday_${loanId}`;

const isOnCooldown = (loanId: string): boolean => {
  const key = getCooldownKey(loanId);
  const lastSent = localStorage.getItem(key);
  if (!lastSent) return false;
  return Date.now() - parseInt(lastSent) < COOLDOWN_MS;
};

const setCooldown = (loanId: string) => {
  const key = getCooldownKey(loanId);
  localStorage.setItem(key, Date.now().toString());
};

const getRemainingCooldownMinutes = (loanId: string): number => {
  const key = getCooldownKey(loanId);
  const lastSent = localStorage.getItem(key);
  if (!lastSent) return 0;
  const remaining = COOLDOWN_MS - (Date.now() - parseInt(lastSent));
  return Math.max(0, Math.ceil(remaining / 60000));
};

import {
  formatCurrency,
  formatDate,
  getContractTypeLabel,
  generateProgressBar,
  generateInstallmentStatusList,
  generatePixSection,
  generateSignature,
  generatePaymentOptions,
  getBillingConfig,
  replaceTemplateVariables,
} from '@/lib/messageUtils';
import { DEFAULT_TEMPLATE_DUE_TODAY } from '@/types/billingMessageConfig';

export default function SendDueTodayNotification({ 
  data, 
  className = ''
}: SendDueTodayNotificationProps) {
  const [isSending, setIsSending] = useState(false);
  const [showSpamWarning, setShowSpamWarning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'send' | 'whatsapp_link'>('whatsapp_link');
  const [cooldown, setCooldownState] = useState(isOnCooldown(data.loanId));
  const [remainingMinutes, setRemainingMinutes] = useState(getRemainingCooldownMinutes(data.loanId));
  const { profile } = useProfile();
  const { user } = useAuth();
  const { messageCount, registerMessage } = useWhatsappMessages(data.loanId);

  const { isInstanceConnected, markDisconnected } = useWhatsAppStatus();
  const hasInstance = !!(
    profile?.whatsapp_instance_id &&
    profile?.whatsapp_connected_phone &&
    profile?.whatsapp_to_clients_enabled
  );
  const canSendViaAPI = isInstanceConnected && hasInstance && !!data.clientPhone;

  const canShowButton = !!data.clientPhone;

  // Update cooldown state every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldownState(isOnCooldown(data.loanId));
      setRemainingMinutes(getRemainingCooldownMinutes(data.loanId));
    }, 60000);

    return () => clearInterval(interval);
  }, [data.loanId]);

  const generateDueTodayMessage = (): string => {
    const config = getBillingConfig(profile?.billing_message_config);
    
    // Se tem template customizado, usar substituição de variáveis
    if (config.useCustomTemplates && config.customTemplateDueToday) {
      const paidCount = data.paidCount || 0;
      const totalInstallments = data.totalInstallments || 1;
      const progressPercent = Math.round((paidCount / totalInstallments) * 100);

      return replaceTemplateVariables(config.customTemplateDueToday, {
        clientName: data.clientName,
        amount: data.amount,
        installmentNumber: data.installmentNumber,
        totalInstallments: data.totalInstallments,
        dueDate: data.dueDate,
        progressPercent: progressPercent,
        pixKey: profile?.pix_key,
        pixKeyType: profile?.pix_key_type,
        pixPreMessage: profile?.pix_pre_message,
        signatureName: profile?.billing_signature_name || profile?.company_name,
        closingMessage: config.customClosingMessage || 'Evite juros e multas pagando em dia!',
      });
    }
    
    // Lógica original baseada em checkboxes
    const installmentInfo = data.installmentNumber && data.totalInstallments 
      ? `Parcela ${data.installmentNumber}/${data.totalInstallments}` 
      : 'Pagamento';
    
    const paidCount = data.paidCount || 0;
    const totalInstallments = data.totalInstallments || 1;
    const progressPercent = Math.round((paidCount / totalInstallments) * 100);

    let message = '';
    
    if (config.includeClientName) {
      message += `Olá *${data.clientName}*!\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
    }
    message += `📅 *VENCIMENTO HOJE*\n\n`;
    
    if (config.includeAmount) {
      message += `💵 *Valor:* ${formatCurrency(data.amount)}\n`;
    }
    if (config.includeInstallmentNumber) {
      message += `📊 *${installmentInfo}*\n`;
    }
    if (config.includeDueDate) {
      message += `📅 *Vencimento:* Hoje (${formatDate(data.dueDate)})\n`;
    }
    
    if (config.includeProgressBar) {
      message += `\n📈 *Progresso:* ${generateProgressBar(progressPercent)}\n`;
    }
    
    if (config.includeInstallmentsList && data.installmentDates && data.installmentDates.length > 0) {
      message += `\n`;
      message += generateInstallmentStatusList({
        installmentDates: data.installmentDates,
        paidCount: paidCount,
        paidIndices: data.paidIndices,
      });
    }
    
    if (data.partialInterestPaid && data.partialInterestPaid > 0) {
      message += `\n💜 *JUROS PARCIAL:*\n`;
      message += `✅ Já pago: ${formatCurrency(data.partialInterestPaid)}\n`;
      message += `⏳ Pendente: ${formatCurrency(data.partialInterestPending || 0)}\n`;
    }
    
    if (config.includePaymentOptions) {
      message += generatePaymentOptions(data.amount, data.interestAmount, data.principalAmount, data.isDaily);
    }
    
    if (config.includePixKey) {
      message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null, profile?.pix_pre_message || null);
    }
    
    message += `\nEvite juros e multas pagando em dia!`;
    
    if (config.customClosingMessage) {
      message += `\n${config.customClosingMessage}`;
    }
    
    if (config.includeSignature) {
      const signatureName = profile?.billing_signature_name || profile?.company_name;
      message += generateSignature(signatureName);
    }

    return message;
  };

  // Mensagem simples: apenas parcela atual, sem lista de todas
  const generateSimpleDueTodayMessage = (): string => {
    const config = getBillingConfig(profile?.billing_message_config);
    const installmentInfo = data.installmentNumber && data.totalInstallments 
      ? `${data.installmentNumber}/${data.totalInstallments}` 
      : 'Única';
    
    const paidCount = data.paidCount || 0;
    const totalInstallments = data.totalInstallments || 1;
    const progressPercent = Math.round((paidCount / totalInstallments) * 100);

    let message = '';
    
    if (config.includeClientName) {
      message += `Olá *${data.clientName}*!\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
    }
    message += `📅 *VENCIMENTO HOJE*\n\n`;
    
    // Barra de progresso
    if (config.includeProgressBar) {
      message += `📈 *Progresso:* ${generateProgressBar(progressPercent)}\n\n`;
    }
    
    // Informações da parcela atual
    if (config.includeInstallmentNumber) {
      message += `📌 *Parcela:* ${installmentInfo}\n`;
    }
    if (config.includeAmount) {
      message += `💵 *Valor:* ${formatCurrency(data.amount)}\n`;
    }
    if (config.includeDueDate) {
      message += `📅 *Vencimento:* Hoje (${formatDate(data.dueDate)})\n`;
    }
    
    // Pagamento parcial de juros (se houver)
    if (data.partialInterestPaid && data.partialInterestPaid > 0) {
      message += `\n💜 *JUROS PARCIAL:*\n`;
      message += `✅ Já pago: ${formatCurrency(data.partialInterestPaid)}\n`;
      message += `⏳ Pendente: ${formatCurrency(data.partialInterestPending || 0)}\n`;
    }
    
    // PIX
    if (config.includePixKey) {
      message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null, profile?.pix_pre_message || null);
    }
    
    message += `\nEvite juros e multas pagando em dia!`;
    
    // Mensagem de fechamento customizada
    if (config.customClosingMessage) {
      message += `\n${config.customClosingMessage}`;
    }
    
    // Assinatura
    if (config.includeSignature) {
      const signatureName = profile?.billing_signature_name || profile?.company_name;
      message += generateSignature(signatureName);
    }

    return message;
  };

  const handleSend = async (editedMessage: string) => {
    if (!canSendViaAPI) {
      if (!profile?.whatsapp_connected_phone) {
        toast.error('Seu WhatsApp não está conectado. Reconecte nas configurações (QR Code).');
      } else if (!profile?.whatsapp_to_clients_enabled) {
        toast.error('Configure seu WhatsApp para clientes nas configurações');
      } else {
        toast.error('Cliente não possui telefone cadastrado');
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
          clientPhone: data.clientPhone,
          message: editedMessage
        },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        setCooldown(data.loanId);
        setCooldownState(true);
        setRemainingMinutes(60);
        
        // Register message in database
        await registerMessage({
          loanId: data.loanId,
          contractType: data.contractType,
          messageType: 'due_today',
          clientPhone: data.clientPhone,
          clientName: data.clientName,
        });
        
        toast.success('Lembrete enviado para o cliente!');
        setShowPreview(false);
      } else {
        throw new Error(result?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Error sending due today notification:', error);
      const errorStr = error.message || '';
      if (errorStr.includes('Reconecte') || errorStr.includes('desconectado') || errorStr.includes('QR Code') || errorStr.includes('502') || errorStr.includes('503')) {
        markDisconnected();
        toast.info('Instância desconectada. Use "Cobrar via WhatsApp" ou reconecte o QR Code em Configurações.');
        return;
      }
      toast.error('Erro ao enviar lembrete: ' + (error.message || 'Tente novamente'));
    } finally {
      setIsSending(false);
    }
  };


  const handleWhatsAppLinkClick = () => {
    setPreviewMode('whatsapp_link');
    setShowPreview(true);
  };

  const handleInstanceClick = () => {
    if (!isInstanceConnected) {
      toast.info('Sua instância WhatsApp não está conectada. Conecte via QR Code em Configurações, ou use "Cobrar via WhatsApp".');
      return;
    }
    if (cooldown) {
      toast.error(`Aguarde ${remainingMinutes} minutos para enviar novamente`);
      return;
    }
    setPreviewMode('send');
    setShowSpamWarning(true);
  };

  const handleConfirmSpamWarning = () => {
    setShowSpamWarning(false);
    setShowPreview(true);
  };

  if (!canShowButton) return null;

  return (
    <>
      <div className="flex flex-row flex-wrap items-center gap-1.5 w-full">
        <Button
          variant="outline"
          size="sm"
          onClick={handleWhatsAppLinkClick}
          className={`${className} border-orange-500/50 text-orange-400 hover:bg-orange-500/20 text-xs flex-1 min-w-0`}
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          Hoje (Link)
        </Button>

        {hasInstance && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstanceClick}
            disabled={isSending}
            className={`${className} flex-1 min-w-0 text-xs border-orange-500/50 text-orange-400 hover:bg-orange-500/20 ${!isInstanceConnected ? 'opacity-50 cursor-not-allowed' : ''} ${cooldown ? 'opacity-60' : ''}`}
          >
            {isSending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Enviando...
              </>
            ) : cooldown ? (
              <>
                <Clock className="w-3.5 h-3.5 mr-1" />
                {remainingMinutes}min
              </>
            ) : (
              <>
                <MessageCircle className="w-3.5 h-3.5 mr-1" />
                Cobrar Hoje
              </>
            )}
          </Button>
        )}

        {messageCount > 0 && (
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
            {messageCount}x
          </Badge>
        )}
      </div>

      <SpamWarningDialog
        open={showSpamWarning}
        onOpenChange={setShowSpamWarning}
        onConfirm={handleConfirmSpamWarning}
      />

      <MessagePreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        simpleMessage={generateSimpleDueTodayMessage()}
        completeMessage={generateDueTodayMessage()}
        recipientName={data.clientName}
        recipientType="client"
        onConfirm={handleSend}
        isSending={isSending}
        mode={previewMode}
        clientPhone={data.clientPhone}
      />
    </>
  );
}
