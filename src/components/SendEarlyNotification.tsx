import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useWhatsappMessages } from '@/hooks/useWhatsappMessages';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { profile } = useProfile();
  const { user } = useAuth();
  const { messageCount, registerMessage } = useWhatsappMessages(data.loanId);

  const canSend = profile?.whatsapp_to_clients_enabled && data.clientPhone;

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
    message += `\n\n`;

    if (profile?.pix_key) {
      const pixTypeLabel = getPixKeyTypeLabel(profile.pix_key_type);
      message += `🏦 *Dados para pagamento via PIX:*\n`;
      message += `Chave (${pixTypeLabel}): \`${profile.pix_key}\`\n`;
      if (profile.full_name) {
        message += `Nome: ${profile.full_name}\n`;
      }
      message += `\n`;
    }

    if (profile?.payment_link) {
      message += `💳 *Link para pagamento:*\n${profile.payment_link}\n\n`;
    }

    message += `Qualquer dúvida, estou à disposição! 😊`;

    if (profile?.company_name) {
      message += `\n\n_${profile.company_name}_`;
    }

    return message;
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
      const message = generateEarlyMessage();

      const { error } = await supabase.functions.invoke('send-whatsapp-to-client', {
        body: {
          userId: user.id,
          phone: data.clientPhone,
          message: message,
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
      setShowConfirmDialog(false);
    } catch (error: any) {
      console.error('Error sending early notification:', error);
      toast.error(error.message || 'Erro ao enviar lembrete');
    } finally {
      setIsSending(false);
    }
  };

  const handleButtonClick = () => {
    setShowConfirmDialog(true);
  };

  if (!canSend) return null;

  return (
    <>
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
        {isSending ? 'Enviando...' : 'Lembrar Cliente'}
        {messageCount > 0 && (
          <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-600 border-amber-500/30">
            {messageCount}x
          </Badge>
        )}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cobrança Antecipada
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Este contrato ainda <strong>não está vencido</strong>.
              </p>
              <p className="text-muted-foreground">
                Vencimento: <strong>{formatDate(data.dueDate)}</strong>
                {data.daysUntilDue > 0 && (
                  <span> (em {data.daysUntilDue} dia{data.daysUntilDue > 1 ? 's' : ''})</span>
                )}
              </p>
              <p className="pt-2">
                Deseja enviar um lembrete de pagamento mesmo assim?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              disabled={isSending}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Mesmo Assim'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
