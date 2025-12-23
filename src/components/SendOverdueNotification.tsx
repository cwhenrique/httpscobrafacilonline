import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SpamWarningDialog from './SpamWarningDialog';
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
  // Campos de multa
  penaltyAmount?: number;
  penaltyType?: 'percentage' | 'fixed';
  penaltyValue?: number;
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
  const [cooldown, setCooldownState] = useState(isOnCooldown(data.loanId));
  const [remainingMinutes, setRemainingMinutes] = useState(getRemainingCooldownMinutes(data.loanId));
  const { profile } = useProfile();
  const { user } = useAuth();
  const { messageCount, registerMessage } = useWhatsappMessages(data.loanId);

  const canSend = profile?.whatsapp_instance_id && profile?.whatsapp_to_clients_enabled && data.clientPhone;

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
      case 'cpf': return 'CPF';
      case 'telefone': return 'Telefone';
      case 'email': return 'Email';
      case 'aleatoria': return 'Chave Aleatória';
      default: return 'PIX';
    }
  };

  const generateOverdueMessage = (): string => {
    const typeLabel = getContractTypeLabel(data.contractType);
    const installmentInfo = data.installmentNumber && data.totalInstallments 
      ? `Parcela ${data.installmentNumber}/${data.totalInstallments}` 
      : 'Pagamento';

    const hasPenalty = data.penaltyAmount && data.penaltyAmount > 0;
    const totalAmount = hasPenalty ? data.amount + data.penaltyAmount : data.amount;

    let message = `⚠️ *Atenção ${data.clientName}*\n\n`;
    message += `Identificamos que você possui uma parcela em atraso:\n\n`;
    message += `📋 *Tipo:* ${typeLabel}\n`;
    message += `📊 *${installmentInfo}*\n`;
    message += `💰 *Valor Original:* ${formatCurrency(data.amount)}\n`;
    message += `📅 *Vencimento:* ${formatDate(data.dueDate)}\n`;
    message += `⏰ *Dias em atraso:* ${data.daysOverdue}\n`;
    
    // Seção de multa
    if (hasPenalty) {
      message += `\n━━━━━━━━━━━━━━━━\n`;
      message += `⚠️ *MULTA POR ATRASO*\n`;
      if (data.penaltyType === 'percentage' && data.penaltyValue) {
        message += `📊 *Cálculo:* ${data.penaltyValue}% × ${data.daysOverdue} dias\n`;
      } else if (data.penaltyValue) {
        message += `📊 *Cálculo:* R$ ${data.penaltyValue.toFixed(2)}/dia × ${data.daysOverdue} dias\n`;
      }
      message += `💸 *Valor da Multa:* +${formatCurrency(data.penaltyAmount)}\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
      message += `💵 *TOTAL A PAGAR:* ${formatCurrency(totalAmount)}\n\n`;
    } else {
      message += `\n`;
    }
    
    // PIX key section with value
    if (profile?.pix_key) {
      message += `━━━━━━━━━━━━━━━━\n`;
      message += `💳 *PIX para pagamento:*\n`;
      message += `📱 *Chave (${getPixKeyTypeLabel(profile.pix_key_type)}):*\n`;
      message += `${profile.pix_key}\n\n`;
      message += `💰 *Valor a pagar:* ${formatCurrency(totalAmount)}\n\n`;
      message += `_Copie a chave e faça o PIX no valor exato!_\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
    }
    
    if (profile?.payment_link) {
      message += `🔗 *Link alternativo:*\n${profile.payment_link}\n\n`;
    }
    
    message += `Por favor, entre em contato para regularizar sua situação.`;
    
    const signatureName = profile?.billing_signature_name || profile?.company_name;
    if (signatureName) {
      message += `\n\n_${signatureName}_`;
    }

    return message;
  };

  const handleSend = async () => {
    if (!canSend) {
      if (!profile?.whatsapp_to_clients_enabled) {
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
        
        // Register message in database
        await registerMessage({
          loanId: data.loanId,
          contractType: data.contractType,
          messageType: 'overdue',
          clientPhone: data.clientPhone,
          clientName: data.clientName,
        });
        
        toast.success('Cobrança enviada para o cliente!');
      } else {
        throw new Error(result?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Error sending overdue notification:', error);
      toast.error('Erro ao enviar cobrança: ' + (error.message || 'Tente novamente'));
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

  const handleConfirmSend = () => {
    setShowSpamWarning(false);
    handleSend();
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
        onConfirm={handleConfirmSend}
      />
    </>
  );
}
