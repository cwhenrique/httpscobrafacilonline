import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, Clock, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SpamWarningDialog from './SpamWarningDialog';
import MessagePreviewDialog from './MessagePreviewDialog';
import { Badge } from '@/components/ui/badge';
import { useWhatsappMessages } from '@/hooks/useWhatsappMessages';
import { useWhatsAppStatus } from '@/contexts/WhatsAppStatusContext';

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
  paidIndices?: number[]; // indices (0-based) das parcelas efetivamente pagas
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
  getBillingConfig,
  replaceTemplateVariables,
} from '@/lib/messageUtils';
import { DEFAULT_TEMPLATE_OVERDUE } from '@/types/billingMessageConfig';

export default function SendOverdueNotification({ 
  data, 
  className = '',
  variant = 'destructive',
  size = 'sm'
}: SendOverdueNotificationProps) {
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


  const generateOverdueMessage = (): string => {
    const config = getBillingConfig(profile?.billing_message_config);
    
    // Se tem template customizado, usar substituição de variáveis
    if (config.useCustomTemplates && config.customTemplateOverdue) {
      const paidCount = data.paidCount || 0;
      const totalInstallments = data.totalInstallments || 1;
      const progressPercent = Math.round((paidCount / totalInstallments) * 100);
      const dynamicPenalty = data.hasDynamicPenalty ? (data.totalPenaltyAmount || 0) : 0;
      const manualPenalty = data.manualPenaltyAmount || 0;
      const appliedPenalty = data.hasDynamicPenalty ? dynamicPenalty : manualPenalty;
      const overdueInterest = data.overdueInterestAmount || 0;
      const totalExtras = appliedPenalty + overdueInterest;
      const totalAmount = data.amount + totalExtras;

      let message = replaceTemplateVariables(config.customTemplateOverdue, {
        clientName: data.clientName,
        amount: data.amount,
        installmentNumber: data.installmentNumber,
        totalInstallments: data.totalInstallments,
        dueDate: data.dueDate,
        daysOverdue: data.daysOverdue,
        penaltyAmount: appliedPenalty,
        overdueInterestAmount: overdueInterest,
        totalAmount: totalAmount,
        progressPercent: progressPercent,
        pixKey: profile?.pix_key,
        pixKeyType: profile?.pix_key_type,
        pixPreMessage: profile?.pix_pre_message,
        signatureName: profile?.billing_signature_name || profile?.company_name,
        closingMessage: config.customClosingMessage,
        contractInterestAmount: data.interestAmount,
      });

      // Adicionar opções de pagamento se habilitado no config
      if (config.includePaymentOptions) {
        message += generatePaymentOptions(
          totalAmount,
          data.interestAmount,
          data.principalAmount,
          data.isDaily,
          appliedPenalty,
          overdueInterest
        );
      }

      return message;
    }
    
    // Lógica original baseada em checkboxes
    const typeLabel = getContractTypeLabel(data.contractType);
    const hasMultipleOverdue = data.overdueInstallmentsDetails && data.overdueInstallmentsDetails.length > 1;
    const hasManualPenalty = data.manualPenaltyAmount && data.manualPenaltyAmount > 0;
    
    let message = '';
    
    if (config.includeClientName) {
      message += `⚠️ *Atenção ${data.clientName}*\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
    }
    
    if (hasMultipleOverdue && data.isDaily) {
      const effectivePenalty = data.hasDynamicPenalty 
        ? (data.totalPenaltyAmount || 0) 
        : (data.manualPenaltyAmount || 0);
      const totalAmount = (data.totalOverdueAmount || 0) + effectivePenalty;
      
      message += `🚨 *${data.overdueInstallmentsCount} PARCELAS EM ATRASO*\n\n`;
      message += `📋 *Tipo:* ${typeLabel} Diário\n`;
      
      if (config.includeProgressBar) {
        const paidCount = data.paidCount || 0;
        const totalInstallments = data.totalInstallments || 1;
        const progressPercent = Math.round((paidCount / totalInstallments) * 100);
        message += `📈 *Progresso:* ${generateProgressBar(progressPercent)}\n\n`;
      }
      
      for (const item of data.overdueInstallmentsDetails!) {
        const manualPenalty = data.manualPenaltiesBreakdown?.[item.installmentNumber - 1] || 0;
        if (config.includeInstallmentNumber) {
          message += `📌 Parc. ${item.installmentNumber}/${data.totalInstallments} • ${item.daysOverdue}d\n`;
        }
        if (config.includeAmount) {
          message += `   💰 ${formatCurrency(item.installmentAmount)}`;
          if (config.includePenalty) {
            if (data.hasDynamicPenalty && item.penaltyAmount > 0) {
              message += ` + ${formatCurrency(item.penaltyAmount)} multa`;
            } else if (!data.hasDynamicPenalty && manualPenalty > 0) {
              message += ` + ${formatCurrency(manualPenalty)} multa`;
            }
          }
          message += `\n`;
        }
      }
      
      if (config.includeAmount) {
        message += `\n💵 *TOTAL A PAGAR:* ${formatCurrency(totalAmount)}\n`;
      }
    } else {
      const installmentInfo = data.installmentNumber && data.totalInstallments 
        ? `Parcela ${data.installmentNumber}/${data.totalInstallments}` 
        : 'Pagamento';
      
      const appliedPenalty = hasManualPenalty ? data.manualPenaltyAmount! : 0;
      const overdueInterest = data.overdueInterestAmount || 0;
      const totalExtras = appliedPenalty + overdueInterest;
      const totalAmount = data.amount + totalExtras;

      if (config.includeAmount) {
        message += `💵 *Valor da Parcela:* ${formatCurrency(data.amount)}\n`;
      }
      if (config.includeInstallmentNumber) {
        message += `📊 *${installmentInfo}*\n`;
      }
      if (config.includeDueDate) {
        message += `📅 *Vencimento:* ${formatDate(data.dueDate)}\n`;
      }
      if (config.includeDaysOverdue) {
        message += `⏰ *Dias em Atraso:* ${data.daysOverdue}\n`;
      }
      
      if (config.includePenalty) {
        if (overdueInterest > 0 && appliedPenalty > 0) {
          // Consolidado quando ambos existem
          message += `💰 *Juros + Multa:* +${formatCurrency(overdueInterest + appliedPenalty)}\n`;
        } else if (overdueInterest > 0) {
          message += `📈 *Juros por Atraso (${data.daysOverdue}d):* +${formatCurrency(overdueInterest)}\n`;
        } else if (appliedPenalty > 0) {
          message += `⚠️ *Multa Aplicada:* +${formatCurrency(appliedPenalty)}\n`;
        }
      }
      
      if (config.includeAmount && totalExtras > 0) {
        message += `💵 *TOTAL A PAGAR:* ${formatCurrency(totalAmount)}\n`;
      }
      
      if (config.includeProgressBar) {
        const paidCount = data.paidCount || 0;
        const totalInstallments = data.totalInstallments || 1;
        const progressPercent = Math.round((paidCount / totalInstallments) * 100);
        message += `\n📈 *Progresso:* ${generateProgressBar(progressPercent)}\n`;
      }
      
      if (config.includeInstallmentsList && data.installmentDates && data.installmentDates.length > 0) {
        const paidCount = data.paidCount || 0;
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
        message += generatePaymentOptions(
          totalAmount,
          data.interestAmount,
          data.principalAmount,
          data.isDaily,
          appliedPenalty,
          overdueInterest
        );
      }
    }
    
    message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null, profile?.pix_pre_message || null);
    
    const signatureName = profile?.billing_signature_name || profile?.company_name;
    message += generateSignature(signatureName);

    return message;
  };

  // Mensagem simples: apenas parcela atual, sem lista de todas
  const generateSimpleOverdueMessage = (): string => {
    const config = getBillingConfig(profile?.billing_message_config);
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
    
    if (overdueInterest > 0 && appliedPenalty > 0) {
      // Consolidado quando ambos existem
      message += `💰 *Juros + Multa:* +${formatCurrency(overdueInterest + appliedPenalty)}\n`;
    } else if (overdueInterest > 0) {
      message += `📈 *Juros:* +${formatCurrency(overdueInterest)}\n`;
    } else if (appliedPenalty > 0) {
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
    if (config.includePixKey) {
      message += generatePixSection(profile?.pix_key || null, profile?.pix_key_type || null, profile?.pix_pre_message || null);
    }
    
    // Mensagem de fechamento customizada
    if (config.customClosingMessage) {
      message += `\n${config.customClosingMessage}\n`;
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
      } else if (errorStr.includes('Reconecte') || errorStr.includes('desconectado') || errorStr.includes('QR Code') || errorStr.includes('502') || errorStr.includes('503')) {
        markDisconnected();
        // Silently fallback - button will switch to wa.me mode
        setShowPreview(false);
        return;
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
      <div className="flex flex-col items-center gap-1.5">
        {/* Botão 1: Link wa.me - sempre visível */}
        <Button
          variant="outline"
          size={size}
          onClick={handleWhatsAppLinkClick}
          className={`${className} border-red-500/50 text-red-400 hover:bg-red-500/20`}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Cobrar Atraso (WhatsApp)
        </Button>

        {/* Botão 2: Instância API - só aparece se hasInstance */}
        {hasInstance && (
          <Button
            variant={cooldown ? 'outline' : variant}
            size={size}
            onClick={handleInstanceClick}
            disabled={isSending}
            className={`${className} ${!isInstanceConnected ? 'opacity-50 cursor-not-allowed' : ''} ${cooldown ? 'opacity-60' : ''}`}
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
          </Button>
        )}

        {messageCount > 0 && (
          <Badge variant="secondary" className="bg-red-500/20 text-red-300 border-red-500/30">
            Já cobrou {messageCount}x
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
        simpleMessage={generateSimpleOverdueMessage()}
        completeMessage={generateOverdueMessage()}
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
