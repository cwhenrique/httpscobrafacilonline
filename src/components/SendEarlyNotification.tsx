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

  // Interface for list data
  interface ListRow {
    title: string;
    description: string;
    rowId: string;
  }

  interface ListSection {
    title: string;
    rows: ListRow[];
  }

  interface ListData {
    title: string;
    description: string;
    buttonText: string;
    footerText: string;
    sections: ListSection[];
  }

  const generateEarlyListData = (): ListData => {
    const typeLabel = getContractTypeLabel(data.contractType);
    const installmentInfo =
      data.installmentNumber && data.totalInstallments
        ? `Parcela ${data.installmentNumber}/${data.totalInstallments}`
        : 'Parcela Única';

    // Build rich description
    let description = `Olá *${data.clientName}*!\n`;
    description += `━━━━━━━━━━━━━━━━\n\n`;
    description += `📋 *LEMBRETE DE PAGAMENTO*\n\n`;
    description += `📋 *Tipo:* ${typeLabel}\n`;
    description += `📊 *${installmentInfo}*\n`;
    description += `💰 *Valor:* ${formatCurrency(data.amount)}\n`;
    description += `📅 *Vencimento:* ${formatDate(data.dueDate)}`;
    if (data.daysUntilDue > 0) {
      description += ` (em ${data.daysUntilDue} dia${data.daysUntilDue > 1 ? 's' : ''})`;
    }
    description += `\n\n`;

    if (data.interestAmount && data.interestAmount > 0 && !data.isDaily && data.principalAmount && data.principalAmount > 0) {
      description += `💡 *Opções de Pagamento:*\n`;
      description += `✅ Valor total: ${formatCurrency(data.amount)}\n`;
      description += `⚠️ Só juros: ${formatCurrency(data.interestAmount)}\n`;
      description += `   (Principal de ${formatCurrency(data.principalAmount)} fica para próximo mês)\n\n`;
    }

    if (profile?.pix_key) {
      description += `━━━━━━━━━━━━━━━━\n`;
      description += `💳 *PIX:* ${profile.pix_key}\n`;
    }

    description += `\nQualquer dúvida, estou à disposição! 😊`;

    const signatureName = profile?.billing_signature_name || profile?.company_name;
    description += `\n\n━━━━━━━━━━━━━━━━`;

    const sections: ListSection[] = [{
      title: "📋 Detalhes",
      rows: [
        { title: "Valor", description: formatCurrency(data.amount), rowId: "amount" },
        { title: "Vencimento", description: formatDate(data.dueDate), rowId: "due" },
      ]
    }];

    return {
      title: `📋 Lembrete de Pagamento`,
      description,
      buttonText: "📋 Ver Detalhes",
      footerText: signatureName || 'CobraFácil',
      sections,
    };
  };

  const handleSend = async () => {
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
      const listData = generateEarlyListData();
      
      const { error } = await supabase.functions.invoke('send-whatsapp-to-client', {
        body: {
          userId: user.id,
          clientPhone: data.clientPhone,
          listData,
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
        initialMessage={generateEarlyListData().description}
        recipientName={data.clientName}
        recipientType="client"
        onConfirm={handleSend}
        isSending={isSending}
      />
    </>
  );
}
