import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SpamWarningDialog from './SpamWarningDialog';

interface OverdueData {
  clientName: string;
  clientPhone: string;
  contractType: 'loan' | 'product' | 'vehicle' | 'contract';
  installmentNumber?: number;
  totalInstallments?: number;
  amount: number;
  dueDate: string;
  daysOverdue: number;
}

interface SendOverdueNotificationProps {
  data: OverdueData;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

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
  const { profile } = useProfile();
  const { user } = useAuth();

  const canSend = profile?.whatsapp_instance_id && profile?.whatsapp_to_clients_enabled && data.clientPhone;

  const generateOverdueMessage = (): string => {
    const typeLabel = getContractTypeLabel(data.contractType);
    const installmentInfo = data.installmentNumber && data.totalInstallments 
      ? `Parcela ${data.installmentNumber}/${data.totalInstallments}` 
      : 'Pagamento';

    let message = `⚠️ *Atenção ${data.clientName}*\n\n`;
    message += `Identificamos que você possui uma parcela em atraso:\n\n`;
    message += `📋 *Tipo:* ${typeLabel}\n`;
    message += `📊 *${installmentInfo}*\n`;
    message += `💰 *Valor:* ${formatCurrency(data.amount)}\n`;
    message += `📅 *Vencimento:* ${formatDate(data.dueDate)}\n`;
    message += `⏰ *Dias em atraso:* ${data.daysOverdue}\n\n`;
    message += `Por favor, entre em contato para regularizar sua situação.\n\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `_${profile?.company_name || 'CobraFácil'}_`;

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
        variant={variant}
        size={size}
        onClick={handleButtonClick}
        disabled={isSending}
        className={className}
      >
        {isSending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <MessageCircle className="w-4 h-4 mr-2" />
        )}
        {isSending ? 'Enviando...' : 'Enviar Cobrança'}
      </Button>

      <SpamWarningDialog
        open={showSpamWarning}
        onOpenChange={setShowSpamWarning}
        onConfirm={handleConfirmSend}
      />
    </>
  );
}
