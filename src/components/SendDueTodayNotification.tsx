import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, Clock, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SpamWarningDialog from './SpamWarningDialog';
import MessagePreviewDialog from './MessagePreviewDialog';
import { Badge } from '@/components/ui/badge';
import { useWhatsappMessages } from '@/hooks/useWhatsappMessages';
import { generateInstallmentsStatusList } from '@/lib/installmentStatusUtils';

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

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
};

const getContractTypeLabel = (type: DueTodayData['contractType']): string => {
  switch (type) {
    case 'loan': return 'Empréstimo';
    case 'product': return 'Venda de Produto';
    case 'vehicle': return 'Venda de Veículo';
    case 'contract': return 'Contrato';
    default: return 'Contrato';
  }
};

export default function SendDueTodayNotification({ 
  data, 
  className = ''
}: SendDueTodayNotificationProps) {
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
      case 'cpf': return 'CPF';
      case 'cnpj': return 'CNPJ';
      case 'telefone': return 'Telefone';
      case 'email': return 'Email';
      case 'aleatoria': return 'Chave Aleatória';
      default: return 'PIX';
    }
  };

  const generateDueTodayMessage = (): string => {
    const typeLabel = getContractTypeLabel(data.contractType);
    const installmentInfo = data.installmentNumber && data.totalInstallments 
      ? `Parcela ${data.installmentNumber}/${data.totalInstallments}` 
      : 'Pagamento';

    let message = `📅 *Lembrete de Vencimento*\n\n`;
    message += `Olá *${data.clientName}*!\n\n`;
    message += `Passando para lembrar que você tem uma parcela vencendo hoje:\n\n`;
    message += `📋 *Tipo:* ${typeLabel}\n`;
    message += `📊 *${installmentInfo}*\n`;
    message += `💰 *Valor:* ${formatCurrency(data.amount)}\n`;
    message += `📅 *Vencimento:* Hoje (${formatDate(data.dueDate)})\n`;
    
    // Adicionar lista de status das parcelas com emojis
    if (data.installmentDates && data.installmentDates.length > 0 && data.paidCount !== undefined && data.totalInstallments) {
      message += generateInstallmentsStatusList({
        installmentDates: data.installmentDates,
        paidCount: data.paidCount,
        totalInstallments: data.totalInstallments
      });
    }
    message += `\n`;
    
    // Seção de opções de pagamento (valor total E só juros na mesma mensagem)
    if (data.interestAmount && data.interestAmount > 0 && !data.isDaily && data.principalAmount && data.principalAmount > 0) {
      message += `━━━━━━━━━━━━━━━━\n`;
      message += `💰 *OPÇÕES DE PAGAMENTO*\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
      
      // Opção 1: Valor Total
      message += `✅ *VALOR TOTAL (quita a parcela):*\n`;
      message += `💵 ${formatCurrency(data.amount)}\n\n`;
      
      // Opção 2: Só Juros
      message += `⚠️ *SÓ JUROS (pagamento parcial):*\n`;
      message += `💵 ${formatCurrency(data.interestAmount)}\n`;
      message += `📌 Principal de ${formatCurrency(data.principalAmount)} fica para próximo mês\n`;
      message += `⚠️ _Este pagamento NÃO quita a parcela_\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
    }
    
    // PIX key section with value
    if (profile?.pix_key) {
      message += `━━━━━━━━━━━━━━━━\n`;
      message += `💳 *PIX para pagamento:*\n`;
      message += `📱 *Chave (${getPixKeyTypeLabel(profile.pix_key_type)}):*\n`;
      message += `${profile.pix_key}\n\n`;
      message += `💰 *Valor total:* ${formatCurrency(data.amount)}\n`;
      
      // Mostrar valor de só juros se aplicável
      if (data.interestAmount && data.interestAmount > 0 && !data.isDaily && data.principalAmount && data.principalAmount > 0) {
        message += `💡 *Só juros:* ${formatCurrency(data.interestAmount)}\n`;
      }
      
      message += `\n_Copie a chave e faça o PIX!_\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
    }
    
    if (profile?.payment_link) {
      message += `🔗 *Link alternativo:*\n${profile.payment_link}\n\n`;
    }
    
    message += `Evite juros e multas pagando em dia!`;
    
    const signatureName = profile?.billing_signature_name || profile?.company_name;
    if (signatureName) {
      message += `\n\n_${signatureName}_`;
    }

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
      toast.error('Erro ao enviar lembrete: ' + (error.message || 'Tente novamente'));
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
        variant="outline"
        size="sm"
        onClick={handleButtonClick}
        disabled={isSending || cooldown}
        className={`${className} ${cooldown ? 'opacity-60' : 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300 hover:bg-yellow-500/30'}`}
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
            <Bell className="w-4 h-4 mr-2" />
            Cobrar Parcela de Hoje
          </>
        )}
        {messageCount > 0 && (
          <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-300 border-amber-500/30">
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
        initialMessage={generateDueTodayMessage()}
        recipientName={data.clientName}
        recipientType="client"
        onConfirm={handleSend}
        isSending={isSending}
      />
    </>
  );
}
