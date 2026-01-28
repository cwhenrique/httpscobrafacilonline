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
} from '@/lib/messageUtils';


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
    const installmentInfo =
      data.installmentNumber && data.totalInstallments
        ? `Parcela ${data.installmentNumber}/${data.totalInstallments}`
        : 'Parcela Única';
    
    const paidCount = data.paidCount || 0;
    const totalInstallments = data.totalInstallments || 1;
    const progressPercent = Math.round((paidCount / totalInstallments) * 100);

    let message = `Olá *${data.clientName}*!\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    message += `📋 *LEMBRETE DE PAGAMENTO*\n\n`;
    
    // Informações principais
    message += `💵 *Valor:* ${formatCurrency(data.amount)}\n`;
    message += `📊 *${installmentInfo}*\n`;
    message += `📅 *Vencimento:* ${formatDate(data.dueDate)}`;
    if (data.daysUntilDue > 0) {
      message += ` (em ${data.daysUntilDue} dia${data.daysUntilDue > 1 ? 's' : ''})`;
    }
    message += `\n`;
    
    // Barra de progresso
    message += `\n📈 *Progresso:* ${generateProgressBar(progressPercent)}\n`;
    
    // Status das parcelas (inteligente)
    if (data.installmentDates && data.installmentDates.length > 0) {
      message += `\n`;
      message += generateInstallmentStatusList({
        installmentDates: data.installmentDates,
        paidCount: paidCount,
      });
    }
    
    // Pagamento parcial de juros (se houver)
    if (data.partialInterestPaid && data.partialInterestPaid > 0) {
      message += `\n💜 *JUROS PARCIAL:*\n`;
      message += `✅ Já pago: ${formatCurrency(data.partialInterestPaid)}\n`;
      message += `⏳ Pendente: ${formatCurrency(data.partialInterestPending || 0)}\n`;
    }
    
    // Opções de pagamento
    message += generatePaymentOptions(data.amount, data.interestAmount, data.principalAmount, data.isDaily);
    
    // PIX
    message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null, profile?.pix_pre_message || null);
    
    message += `\nQualquer dúvida, estou à disposição! 😊`;
    
    // Assinatura
    const signatureName = profile?.billing_signature_name || profile?.company_name;
    message += generateSignature(signatureName);

    return message;
  };

  // Mensagem simples: apenas parcela atual, sem lista de todas
  const generateSimpleEarlyMessage = (): string => {
    const installmentInfo =
      data.installmentNumber && data.totalInstallments
        ? `${data.installmentNumber}/${data.totalInstallments}`
        : 'Única';
    
    const paidCount = data.paidCount || 0;
    const totalInstallments = data.totalInstallments || 1;
    const progressPercent = Math.round((paidCount / totalInstallments) * 100);

    let message = `Olá *${data.clientName}*!\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    message += `📋 *LEMBRETE DE PAGAMENTO*\n\n`;
    
    // Barra de progresso
    message += `📈 *Progresso:* ${generateProgressBar(progressPercent)}\n\n`;
    
    // Informações da parcela atual
    message += `📌 *Parcela:* ${installmentInfo}\n`;
    message += `💵 *Valor:* ${formatCurrency(data.amount)}\n`;
    message += `📅 *Vencimento:* ${formatDate(data.dueDate)}`;
    if (data.daysUntilDue > 0) {
      message += ` (em ${data.daysUntilDue} dia${data.daysUntilDue > 1 ? 's' : ''})`;
    }
    message += `\n`;
    
    // Pagamento parcial de juros (se houver)
    if (data.partialInterestPaid && data.partialInterestPaid > 0) {
      message += `\n💜 *JUROS PARCIAL:*\n`;
      message += `✅ Já pago: ${formatCurrency(data.partialInterestPaid)}\n`;
      message += `⏳ Pendente: ${formatCurrency(data.partialInterestPending || 0)}\n`;
    }
    
    // PIX
    message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null, profile?.pix_pre_message || null);
    
    message += `\nQualquer dúvida, estou à disposição! 😊`;
    
    // Assinatura
    const signatureName = profile?.billing_signature_name || profile?.company_name;
    message += generateSignature(signatureName);

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
