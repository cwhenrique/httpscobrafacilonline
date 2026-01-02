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
import { generateInstallmentsStatusList } from '@/lib/installmentStatusUtils';

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
}

interface SendEarlyNotificationProps {
  data: EarlyNotificationData;
  className?: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getContractTypeLabel = (type: EarlyNotificationData['contractType']): string => {
  const labels: Record<EarlyNotificationData['contractType'], string> = {
    loan: 'Empréstimo',
    product: 'Venda de Produto',
    vehicle: 'Veículo',
    contract: 'Contrato',
  };
  return labels[type];
};

const getPixKeyTypeLabel = (type: string | null): string => {
  if (!type) return '';
  const labels: Record<string, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    email: 'E-mail',
    phone: 'Telefone',
    random: 'Chave Aleatória',
  };
  return labels[type] || type;
};

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
    const typeLabel = getContractTypeLabel(data.contractType);
    const installmentInfo =
      data.installmentNumber && data.totalInstallments
        ? `Parcela ${data.installmentNumber}/${data.totalInstallments}`
        : 'Parcela Única';

    let message = `📋 *Lembrete de Pagamento*\n\n`;
    message += `Olá *${data.clientName}*!\n\n`;
    message += `Este é um lembrete sobre sua próxima parcela:\n\n`;
    message += `📋 *Tipo:* ${typeLabel}\n`;
    message += `📊 *${installmentInfo}*\n`;
    message += `💰 *Valor:* ${formatCurrency(data.amount)}\n`;
    message += `📅 *Vencimento:* ${formatDate(data.dueDate)}`;
    
    if (data.daysUntilDue > 0) {
      message += ` (em ${data.daysUntilDue} dia${data.daysUntilDue > 1 ? 's' : ''})`;
    }
    message += `\n`;

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

    if (profile?.pix_key) {
      const pixTypeLabel = getPixKeyTypeLabel(profile.pix_key_type);
      message += `━━━━━━━━━━━━━━━━\n`;
      message += `💳 *PIX para pagamento:*\n`;
      message += `📱 *Chave (${pixTypeLabel}):*\n`;
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
      message += `💳 *Link para pagamento:*\n${profile.payment_link}\n\n`;
    }

    message += `Qualquer dúvida, estou à disposição! 😊`;

    const signatureName = profile?.billing_signature_name || profile?.company_name;
    if (signatureName) {
      message += `\n\n_${signatureName}_`;
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
        initialMessage={generateEarlyMessage()}
        recipientName={data.clientName}
        recipientType="client"
        onConfirm={handleSend}
        isSending={isSending}
      />
    </>
  );
}
