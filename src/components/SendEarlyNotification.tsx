import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useWhatsappMessages } from '@/hooks/useWhatsappMessages';
import SpamWarningDialog from './SpamWarningDialog';
import MessagePreviewDialog from './MessagePreviewDialog';


export interface EarlyNotificationData {
  clientName: string;
  clientPhone: string;
  contractType: 'loan' | 'product' | 'vehicle' | 'contract';
  installmentNumber?: number;
  totalInstallments?: number;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  loanId: string;
  interestAmount?: number;
  principalAmount?: number;
  isDaily?: boolean;
  // NOVO: Campos para status das parcelas com emojis
  installmentDates?: string[];
  paidCount?: number;
  // NOVO: Pagamento parcial de juros
  partialInterestPaid?: number;
  partialInterestPending?: number;
}

interface SendEarlyNotificationProps {
  data: EarlyNotificationData;
  className?: string;
}

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
import { DEFAULT_TEMPLATE_EARLY } from '@/types/billingMessageConfig';


export function SendEarlyNotification({ data, className }: SendEarlyNotificationProps) {
  const [isSending, setIsSending] = useState(false);
  const [showSpamWarning, setShowSpamWarning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { profile } = useProfile();
  const { user } = useAuth();
  const { messageCount, registerMessage } = useWhatsappMessages(data.loanId);

  const canSend =
    profile?.whatsapp_instance_id &&
    profile?.whatsapp_connected_phone &&
    profile?.whatsapp_to_clients_enabled &&
    data.clientPhone;

  const generateEarlyMessage = (): string => {
    const config = getBillingConfig(profile?.billing_message_config);
    
    // Se tem template customizado, usar substituição de variáveis
    if (config.useCustomTemplates && config.customTemplateEarly) {
      const paidCount = data.paidCount || 0;
      const totalInstallments = data.totalInstallments || 1;
      const progressPercent = Math.round((paidCount / totalInstallments) * 100);

      return replaceTemplateVariables(config.customTemplateEarly, {
        clientName: data.clientName,
        amount: data.amount,
        installmentNumber: data.installmentNumber,
        totalInstallments: data.totalInstallments,
        dueDate: data.dueDate,
        daysUntilDue: data.daysUntilDue,
        progressPercent: progressPercent,
        pixKey: profile?.pix_key,
        pixKeyType: profile?.pix_key_type,
        pixPreMessage: profile?.pix_pre_message,
        signatureName: profile?.billing_signature_name || profile?.company_name,
        closingMessage: config.customClosingMessage || 'Qualquer dúvida, estou à disposição! 😊',
      });
    }
    
    // Lógica original baseada em checkboxes
    const installmentInfo =
      data.installmentNumber && data.totalInstallments
        ? `Parcela ${data.installmentNumber}/${data.totalInstallments}`
        : 'Parcela Única';
    
    const paidCount = data.paidCount || 0;
    const totalInstallments = data.totalInstallments || 1;
    const progressPercent = Math.round((paidCount / totalInstallments) * 100);

    let message = '';
    
    if (config.includeClientName) {
      message += `Olá *${data.clientName}*!\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
    }
    message += `📋 *LEMBRETE DE PAGAMENTO*\n\n`;
    
    if (config.includeAmount) {
      message += `💵 *Valor:* ${formatCurrency(data.amount)}\n`;
    }
    if (config.includeInstallmentNumber) {
      message += `📊 *${installmentInfo}*\n`;
    }
    if (config.includeDueDate) {
      message += `📅 *Vencimento:* ${formatDate(data.dueDate)}`;
      if (data.daysUntilDue > 0) {
        message += ` (em ${data.daysUntilDue} dia${data.daysUntilDue > 1 ? 's' : ''})`;
      }
      message += `\n`;
    }
    
    if (config.includeProgressBar) {
      message += `\n📈 *Progresso:* ${generateProgressBar(progressPercent)}\n`;
    }
    
    if (config.includeInstallmentsList && data.installmentDates && data.installmentDates.length > 0) {
      message += `\n`;
      message += generateInstallmentStatusList({
        installmentDates: data.installmentDates,
        paidCount: paidCount,
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
    
    if (config.customClosingMessage) {
      message += `\n${config.customClosingMessage}\n`;
    } else {
      message += `\nQualquer dúvida, estou à disposição! 😊`;
    }
    
    if (config.includeSignature) {
      const signatureName = profile?.billing_signature_name || profile?.company_name;
      message += generateSignature(signatureName);
    }

    return message;
  };

  // Mensagem simples: apenas parcela atual, sem lista de todas
  const generateSimpleEarlyMessage = (): string => {
    const config = getBillingConfig(profile?.billing_message_config);
    const installmentInfo =
      data.installmentNumber && data.totalInstallments
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
    message += `📋 *LEMBRETE DE PAGAMENTO*\n\n`;
    
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
      message += `📅 *Vencimento:* ${formatDate(data.dueDate)}`;
      if (data.daysUntilDue > 0) {
        message += ` (em ${data.daysUntilDue} dia${data.daysUntilDue > 1 ? 's' : ''})`;
      }
      message += `\n`;
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
    
    // Mensagem de fechamento customizada ou padrão
    if (config.customClosingMessage) {
      message += `\n${config.customClosingMessage}`;
    } else {
      message += `\nQualquer dúvida, estou à disposição! 😊`;
    }
    
    // Assinatura
    if (config.includeSignature) {
      const signatureName = profile?.billing_signature_name || profile?.company_name;
      message += generateSignature(signatureName);
    }

    return message;
  };

  const handleSend = async (editedMessage: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para enviar mensagens');
      return;
    }

    if (!data.clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp-to-client', {
        body: {
          userId: user.id,
          clientPhone: data.clientPhone,
          message: editedMessage,
        },
      });

      if (error) throw error;

      await registerMessage({
        loanId: data.loanId,
        contractType: data.contractType,
        messageType: 'early',
        clientPhone: data.clientPhone,
        clientName: data.clientName,
      });

      toast.success('Lembrete enviado com sucesso!');
      setShowPreview(false);
    } catch (error: any) {
      console.error('Error sending early notification:', error);
      toast.error(error.message || 'Erro ao enviar lembrete');
    } finally {
      setIsSending(false);
    }
  };

  const handleButtonClick = () => {
    setShowSpamWarning(true);
  };

  const handleConfirmSpamWarning = () => {
    setShowSpamWarning(false);
    setShowPreview(true);
  };

  if (!canSend) return null;

  return (
    <>
      <div className="flex flex-col items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleButtonClick}
          disabled={isSending}
          className={className}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <MessageCircle className="w-4 h-4 mr-2" />
          )}
          {isSending ? 'Enviando...' : 'Cobrar Antes do Prazo'}
        </Button>
        {messageCount > 0 && (
          <span className="text-xs text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
            Já cobrou {messageCount}x
          </span>
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
        simpleMessage={generateSimpleEarlyMessage()}
        completeMessage={generateEarlyMessage()}
        recipientName={data.clientName}
        recipientType="client"
        onConfirm={handleSend}
        isSending={isSending}
      />
    </>
  );
}
