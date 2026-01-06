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

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
};

const getContractTypeLabel = (type: OverdueData['contractType']): string => {
  switch (type) {
    case 'loan': return 'Empréstimo';
    case 'product': return 'Venda de Produto';
    case 'vehicle': return 'Venda de Veículo';
    case 'contract': return 'Contrato';
    default: return 'Contrato';
  }
};

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

  const getPixKeyTypeLabel = (type: string | null): string => {
    switch (type) {
      case 'cpf': return 'Chave PIX CPF';
      case 'cnpj': return 'Chave PIX CNPJ';
      case 'telefone': return 'Chave PIX Telefone';
      case 'email': return 'Chave PIX Email';
      case 'aleatoria': return 'Chave PIX Aleatória';
      default: return 'Chave PIX';
    }
  };


  const generateOverdueMessage = (): string => {
    const typeLabel = getContractTypeLabel(data.contractType);
    const hasMultipleOverdue = data.overdueInstallmentsDetails && data.overdueInstallmentsDetails.length > 1;
    const hasPenalty = data.penaltyAmount && data.penaltyAmount > 0;
    const hasManualPenalty = data.manualPenaltyAmount && data.manualPenaltyAmount > 0;
    
    let message = `⚠️ *Atenção ${data.clientName}*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    
    if (hasMultipleOverdue && data.isDaily) {
      const effectivePenalty = data.hasDynamicPenalty 
        ? (data.totalPenaltyAmount || 0) 
        : (data.manualPenaltyAmount || 0);
      const totalAmount = (data.totalOverdueAmount || 0) + effectivePenalty;
      
      message += `🚨 *${data.overdueInstallmentsCount} PARCELAS EM ATRASO*\n\n`;
      message += `📋 *Tipo:* ${typeLabel} Diário\n\n`;
      
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
      const effectivePenalty = hasPenalty ? data.penaltyAmount! : (hasManualPenalty ? data.manualPenaltyAmount! : 0);
      const totalAmount = data.amount + effectivePenalty;

      message += `📋 *Tipo:* ${typeLabel}\n`;
      message += `📊 *${installmentInfo}*\n`;
      message += `💰 *Valor Original:* ${formatCurrency(data.amount)}\n`;
      message += `📅 *Vencimento:* ${formatDate(data.dueDate)}\n`;
      message += `⏰ *Dias em atraso:* ${data.daysOverdue}\n\n`;
      
      if (effectivePenalty > 0) {
        message += `⚠️ *Multa:* +${formatCurrency(effectivePenalty)}\n`;
        message += `💵 *TOTAL A PAGAR:* ${formatCurrency(totalAmount)}\n\n`;
      }
      
      // Opção de pagar só juros (com texto CORRETO)
      if (data.interestAmount && data.interestAmount > 0 && !data.isDaily && data.principalAmount && data.principalAmount > 0) {
        const interestPlusPenalty = data.interestAmount + effectivePenalty;
        message += `💡 *Opções de Pagamento:*\n`;
        message += `✅ Valor total: ${formatCurrency(totalAmount)}\n`;
        message += `⚠️ Só juros: ${formatCurrency(interestPlusPenalty)}\n`;
        message += `   (Parcela de ${formatCurrency(data.amount)} será adicionada ao próximo mês)\n\n`;
      }
      
      // Status das parcelas com emojis
      if (data.installmentDates && data.installmentDates.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        message += `📊 *STATUS DAS PARCELAS:*\n`;
        data.installmentDates.forEach((dateStr, index) => {
          const installmentNum = index + 1;
          const dueDate = new Date(dateStr + 'T12:00:00');
          const isPaid = installmentNum <= (data.paidCount || 0);
          
          let emoji: string;
          let status: string;
          
          if (isPaid) {
            emoji = '✅';
            status = 'Paga';
          } else if (dueDate < today) {
            const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            emoji = '❌';
            status = `Em Atraso (${daysOverdue}d)`;
          } else {
            emoji = '⏳';
            status = 'Em Aberto';
          }
          
          message += `${installmentNum}️⃣ ${emoji} ${formatDate(dateStr)} - ${status}\n`;
        });
        
        // Barra de progresso
        const paidCount = data.paidCount || 0;
        const totalInstallments = data.totalInstallments || data.installmentDates.length;
        const progressPercent = Math.round((paidCount / totalInstallments) * 100);
        const filledBlocks = Math.round(progressPercent / 10);
        const emptyBlocks = 10 - filledBlocks;
        message += `\n📈 *Progresso:* ${'▓'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${progressPercent}%\n`;
      }
    }
    
    if (profile?.pix_key) {
      message += `\n━━━━━━━━━━━━━━━━\n`;
      message += `💳 *${getPixKeyTypeLabel(profile.pix_key_type)}:* ${profile.pix_key}\n`;
    }
    
    const signatureName = profile?.billing_signature_name || profile?.company_name;
    if (signatureName) {
      message += `\n━━━━━━━━━━━━━━━━\n`;
      message += `_${signatureName}_`;
    }

    return message;
  };

  const handleSend = async () => {
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
      const message = generateOverdueMessage();
      
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp-to-client', {
        body: { 
          userId: user.id,
          clientPhone: data.clientPhone,
          message
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
        initialMessage={generateOverdueMessage()}
        recipientName={data.clientName}
        recipientType="client"
        onConfirm={handleSend}
        isSending={isSending}
      />
    </>
  );
}
