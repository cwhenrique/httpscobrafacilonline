import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SpamWarningDialog from './SpamWarningDialog';
import MessagePreviewDialog from './MessagePreviewDialog';
import { Badge } from '@/components/ui/badge';
import { useWhatsappMessages } from '@/hooks/useWhatsappMessages';

interface OverdueData {
  clientName: string;
  clientPhone: string;
  contractType: 'loan' | 'product' | 'vehicle' | 'contract';
  installmentNumber?: number;
  totalInstallments?: number;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  loanId: string;
  // Campos de multa dinâmica
  penaltyAmount?: number;
  penaltyType?: 'percentage' | 'fixed';
  penaltyValue?: number;
  // Campos para opção de pagamento só de juros
  interestAmount?: number;
  principalAmount?: number;
  // Indica se é contrato diário (não mostra opção de pagar só juros)
  isDaily?: boolean;
  // NOVO: Campos para múltiplas parcelas em atraso (empréstimos diários)
  overdueInstallmentsCount?: number;
  overdueInstallmentsDetails?: Array<{
    installmentNumber: number;
    daysOverdue: number;
    penaltyAmount: number;
    installmentAmount: number;
    totalWithPenalty: number;
  }>;
  totalOverdueAmount?: number;
  totalPenaltyAmount?: number;
  // Multas manuais aplicadas (só usadas se NÃO houver multa dinâmica)
  manualPenaltyAmount?: number;
  // Detalhamento das multas manuais por parcela (índice → valor)
  manualPenaltiesBreakdown?: Record<number, number>;
  // Indica se há multa dinâmica configurada (valor fixo/dia ou %)
  hasDynamicPenalty?: boolean;
  // NOVO: Campos para status das parcelas com emojis
  installmentDates?: string[];
  paidCount?: number;
  // NOVO: Juros por atraso (calculado por dia - separado da multa)
  overdueInterestAmount?: number;
  // NOVO: Pagamento parcial de juros
  partialInterestPaid?: number;
  partialInterestPending?: number;
}

interface SendOverdueNotificationProps {
  data: OverdueData;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hora em milissegundos

const getCooldownKey = (loanId: string) => `whatsapp_cooldown_overdue_${loanId}`;

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
  getPixKeyTypeLabel,
  generateProgressBar,
  generateInstallmentStatusList,
  generatePixSection,
  generateSignature,
  generatePaymentOptions,
} from '@/lib/messageUtils';

export default function SendOverdueNotification({ 
  data, 
  className = '',
  variant = 'destructive',
  size = 'sm'
}: SendOverdueNotificationProps) {
  const [isSending, setIsSending] = useState(false);
  const [showSpamWarning, setShowSpamWarning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [cooldown, setCooldownState] = useState(isOnCooldown(data.loanId));
  const [remainingMinutes, setRemainingMinutes] = useState(getRemainingCooldownMinutes(data.loanId));
  const { profile } = useProfile();
  const { user } = useAuth();
  const { messageCount, registerMessage } = useWhatsappMessages(data.loanId);

  const canSend =
    profile?.whatsapp_instance_id &&
    profile?.whatsapp_connected_phone &&
    profile?.whatsapp_to_clients_enabled &&
    data.clientPhone;

  // Update cooldown state every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldownState(isOnCooldown(data.loanId));
      setRemainingMinutes(getRemainingCooldownMinutes(data.loanId));
    }, 60000);

    return () => clearInterval(interval);
  }, [data.loanId]);



  const generateOverdueMessage = (): string => {
    const typeLabel = getContractTypeLabel(data.contractType);
    const hasMultipleOverdue = data.overdueInstallmentsDetails && data.overdueInstallmentsDetails.length > 1;
    const hasManualPenalty = data.manualPenaltyAmount && data.manualPenaltyAmount > 0;
    
    let message = `⚠️ *Atenção ${data.clientName}*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    
    if (hasMultipleOverdue && data.isDaily) {
      const effectivePenalty = data.hasDynamicPenalty 
        ? (data.totalPenaltyAmount || 0) 
        : (data.manualPenaltyAmount || 0);
      const totalAmount = (data.totalOverdueAmount || 0) + effectivePenalty;
      
      message += `🚨 *${data.overdueInstallmentsCount} PARCELAS EM ATRASO*\n\n`;
      message += `📋 *Tipo:* ${typeLabel} Diário\n`;
      
      // Barra de progresso
      const paidCount = data.paidCount || 0;
      const totalInstallments = data.totalInstallments || 1;
      const progressPercent = Math.round((paidCount / totalInstallments) * 100);
      message += `📈 *Progresso:* ${generateProgressBar(progressPercent)}\n\n`;
      
      for (const item of data.overdueInstallmentsDetails!) {
        const manualPenalty = data.manualPenaltiesBreakdown?.[item.installmentNumber - 1] || 0;
        message += `📌 Parc. ${item.installmentNumber}/${data.totalInstallments} • ${item.daysOverdue}d\n`;
        message += `   💰 ${formatCurrency(item.installmentAmount)}`;
        if (data.hasDynamicPenalty && item.penaltyAmount > 0) {
          message += ` + ${formatCurrency(item.penaltyAmount)} multa`;
        } else if (!data.hasDynamicPenalty && manualPenalty > 0) {
          message += ` + ${formatCurrency(manualPenalty)} multa`;
        }
        message += `\n`;
      }
      
      message += `\n💵 *TOTAL A PAGAR:* ${formatCurrency(totalAmount)}\n`;
    } else {
      const installmentInfo = data.installmentNumber && data.totalInstallments 
        ? `Parcela ${data.installmentNumber}/${data.totalInstallments}` 
        : 'Pagamento';
      
      // Separar: multa aplicada vs juros por atraso
      const appliedPenalty = hasManualPenalty ? data.manualPenaltyAmount! : 0;
      const overdueInterest = data.overdueInterestAmount || 0;
      const totalExtras = appliedPenalty + overdueInterest;
      const totalAmount = data.amount + totalExtras;

      // Informações principais
      message += `💵 *Valor da Parcela:* ${formatCurrency(data.amount)}\n`;
      message += `📊 *${installmentInfo}*\n`;
      message += `📅 *Vencimento:* ${formatDate(data.dueDate)}\n`;
      message += `⏰ *Dias em Atraso:* ${data.daysOverdue}\n`;
      
      // Juros por atraso (se houver)
      if (overdueInterest > 0) {
        message += `📈 *Juros por Atraso (${data.daysOverdue}d):* +${formatCurrency(overdueInterest)}\n`;
      }
      
      // Multa aplicada (se houver)
      if (appliedPenalty > 0) {
        message += `⚠️ *Multa Aplicada:* +${formatCurrency(appliedPenalty)}\n`;
      }
      
      // Total a pagar
      if (totalExtras > 0) {
        message += `💵 *TOTAL A PAGAR:* ${formatCurrency(totalAmount)}\n`;
      }
      
      // Barra de progresso
      const paidCount = data.paidCount || 0;
      const totalInstallments = data.totalInstallments || 1;
      const progressPercent = Math.round((paidCount / totalInstallments) * 100);
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
      
      // Opções de pagamento (só juros + multa)
      message += generatePaymentOptions(
        totalAmount,
        data.interestAmount,
        data.principalAmount,
        data.isDaily,
        appliedPenalty,
        overdueInterest
      );
    }
    
    // PIX
    message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null, profile?.pix_pre_message || null);
    
    // Assinatura
    const signatureName = profile?.billing_signature_name || profile?.company_name;
    message += generateSignature(signatureName);

    return message;
  };

  // Mensagem simples: apenas parcela atual, sem lista de todas
  const generateSimpleOverdueMessage = (): string => {
    const typeLabel = getContractTypeLabel(data.contractType);
    const hasManualPenalty = data.manualPenaltyAmount && data.manualPenaltyAmount > 0;
    
    let message = `⚠️ *Atenção ${data.clientName}*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    message += `🚨 *PARCELA EM ATRASO*\n\n`;
    
    message += `📋 *Tipo:* ${typeLabel}${data.isDaily ? ' Diário' : ''}\n`;
    
    // Barra de progresso
    const paidCount = data.paidCount || 0;
    const totalInstallments = data.totalInstallments || 1;
    const progressPercent = Math.round((paidCount / totalInstallments) * 100);
    message += `📈 *Progresso:* ${generateProgressBar(progressPercent)}\n\n`;
    
    // Informações da parcela atual
    const installmentInfo = data.installmentNumber && data.totalInstallments 
      ? `${data.installmentNumber}/${data.totalInstallments}` 
      : 'Única';
    
    message += `📌 *Parcela:* ${installmentInfo}\n`;
    message += `💵 *Valor:* ${formatCurrency(data.amount)}\n`;
    message += `📅 *Vencimento:* ${formatDate(data.dueDate)}\n`;
    message += `⏰ *Dias em Atraso:* ${data.daysOverdue}\n`;
    
    // Multa/juros
    const appliedPenalty = hasManualPenalty ? data.manualPenaltyAmount! : 0;
    const overdueInterest = data.overdueInterestAmount || 0;
    const totalExtras = appliedPenalty + overdueInterest;
    const totalAmount = data.amount + totalExtras;
    
    if (overdueInterest > 0) {
      message += `📈 *Juros:* +${formatCurrency(overdueInterest)}\n`;
    }
    if (appliedPenalty > 0) {
      message += `⚠️ *Multa:* +${formatCurrency(appliedPenalty)}\n`;
    }
    
    // Pagamento parcial de juros (se houver)
    if (data.partialInterestPaid && data.partialInterestPaid > 0) {
      message += `\n💜 *JUROS PARCIAL:*\n`;
      message += `✅ Já pago: ${formatCurrency(data.partialInterestPaid)}\n`;
      message += `⏳ Pendente: ${formatCurrency(data.partialInterestPending || 0)}\n`;
    }
    
    message += `\n💵 *Total:* ${formatCurrency(totalAmount)}\n`;
    
    // PIX
    message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null, profile?.pix_pre_message || null);
    
    // Assinatura
    const signatureName = profile?.billing_signature_name || profile?.company_name;
    message += generateSignature(signatureName);

    return message;
  };

  const handleSend = async (editedMessage: string) => {
    if (!canSend) {
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
        
        await registerMessage({
          loanId: data.loanId,
          contractType: data.contractType,
          messageType: 'overdue',
          clientPhone: data.clientPhone,
          clientName: data.clientName,
        });
        
        toast.success('Cobrança enviada para o cliente!');
        setShowPreview(false);
      } else {
        throw new Error(result?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Error sending overdue notification:', error);
      
      let errorMessage = 'Tente novamente';
      const errorStr = error.message || '';
      
      if (errorStr.includes('não possui WhatsApp') || errorStr.includes('NUMBER_NOT_ON_WHATSAPP')) {
        errorMessage = `O número "${data.clientPhone}" não possui WhatsApp. Verifique o cadastro do cliente.`;
      } else if (errorStr.includes('Reconecte') || errorStr.includes('desconectado') || errorStr.includes('QR Code')) {
        errorMessage = 'WhatsApp desconectado. Reconecte nas configurações.';
      } else if (errorStr.includes('telefone') || errorStr.includes('phone') || errorStr.includes('inválido')) {
        errorMessage = `Número inválido: "${data.clientPhone}". Atualize o cadastro.`;
      } else if (errorStr.includes('desativado')) {
        errorMessage = 'Envio de WhatsApp para clientes está desativado.';
      } else if (errorStr) {
        errorMessage = errorStr;
      }
      
      toast.error('Erro: ' + errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleButtonClick = () => {
    if (cooldown) {
      toast.error(`Aguarde ${remainingMinutes} minutos para enviar novamente`);
      return;
    }
    setShowSpamWarning(true);
  };

  const handleConfirmSpamWarning = () => {
    setShowSpamWarning(false);
    setShowPreview(true);
  };

  if (!canSend) return null;

  return (
    <>
      <Button 
        variant={cooldown ? 'outline' : variant}
        size={size}
        onClick={handleButtonClick}
        disabled={isSending || cooldown}
        className={`${className} ${cooldown ? 'opacity-60' : ''}`}
      >
        {isSending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Enviando...
          </>
        ) : cooldown ? (
          <>
            <Clock className="w-4 h-4 mr-2" />
            Aguarde {remainingMinutes}min
          </>
        ) : (
          <>
            <MessageCircle className="w-4 h-4 mr-2" />
            Enviar Cobrança
          </>
        )}
        {messageCount > 0 && (
          <Badge variant="secondary" className="ml-2 bg-red-500/20 text-red-300 border-red-500/30">
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
        simpleMessage={generateSimpleOverdueMessage()}
        completeMessage={generateOverdueMessage()}
        recipientName={data.clientName}
        recipientType="client"
        onConfirm={handleSend}
        isSending={isSending}
      />
    </>
  );
}
