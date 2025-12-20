import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, FileText, MessageCircle, Loader2, Users } from 'lucide-react';
import { generatePaymentReceipt, PaymentReceiptData } from '@/lib/pdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SpamWarningDialog from './SpamWarningDialog';

interface PaymentReceiptPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PaymentReceiptData | null;
  clientPhone?: string; // Telefone do cliente para envio direto
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
};

const getTypeLabel = (type: 'loan' | 'product' | 'vehicle' | 'contract'): string => {
  switch (type) {
    case 'loan': return 'Empréstimo';
    case 'product': return 'Venda de Produto';
    case 'vehicle': return 'Venda de Veículo';
    case 'contract': return 'Contrato';
    default: return 'Pagamento';
  }
};

const getContractPrefix = (type: 'loan' | 'product' | 'vehicle' | 'contract'): string => {
  switch (type) {
    case 'loan': return 'EMP';
    case 'product': return 'PRD';
    case 'vehicle': return 'VEI';
    case 'contract': return 'CTR';
    default: return 'DOC';
  }
};

const generateWhatsAppMessage = (data: PaymentReceiptData): string => {
  const prefix = getContractPrefix(data.type);
  const contractNumber = `${prefix}-${data.contractId.substring(0, 8).toUpperCase()}`;
  const isFullyPaid = data.remainingBalance <= 0;
  
  let message = `✅ *COMPROVANTE DE PAGAMENTO*\n`;
  message += `━━━━━━━━━━━━━━━━\n\n`;
  message += `📋 *Contrato:* ${contractNumber}\n`;
  message += `👤 *Cliente:* ${data.clientName}\n`;
  message += `📊 *Parcela:* ${data.installmentNumber}/${data.totalInstallments}\n\n`;
  
  message += `💰 *PAGAMENTO*\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `💵 Valor Pago: ${formatCurrency(data.amountPaid)}\n`;
  message += `📅 Data: ${formatDate(data.paymentDate)}\n`;
  
  if (data.totalPaid) {
    message += `💰 Total Pago: ${formatCurrency(data.totalPaid)}\n`;
  }
  
  if (isFullyPaid) {
    message += `\n🎉 *CONTRATO QUITADO!* 🎉\n`;
    message += `Obrigado pela confiança!\n`;
  } else {
    message += `\n📊 *Saldo Restante:* ${formatCurrency(data.remainingBalance)}\n`;
  }
  
  message += `\n━━━━━━━━━━━━━━━━\n`;
  if (data.companyName) {
    message += `_${data.companyName}_\n`;
  }
  message += `_Comprovante automático_`;
  
  return message;
};

export default function PaymentReceiptPrompt({ open, onOpenChange, data, clientPhone }: PaymentReceiptPromptProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isSendingToClient, setIsSendingToClient] = useState(false);
  const [showSpamWarning, setShowSpamWarning] = useState(false);
  const { profile } = useProfile();
  const { user } = useAuth();

  if (!data) return null;

  // Send to collector (existing behavior)
  const handleSendWhatsApp = async () => {
    if (!profile?.phone) {
      toast.error('Configure seu telefone no perfil para receber comprovantes');
      return;
    }
    
    setIsSendingWhatsApp(true);
    try {
      const message = generateWhatsAppMessage(data);
      
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { phone: profile.phone, message },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        toast.success('Comprovante enviado para seu WhatsApp!');
      } else {
        throw new Error(result?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Erro ao enviar WhatsApp: ' + (error.message || 'Tente novamente'));
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Send to client (new feature)
  const handleSendToClient = async () => {
    if (!clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    if (!profile?.whatsapp_to_clients_enabled) {
      toast.error('Configure seu WhatsApp para clientes nas configurações');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }
    
    setIsSendingToClient(true);
    try {
      const message = generateWhatsAppMessage(data);
      
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp-to-client', {
        body: { 
          userId: user.id,
          clientPhone: clientPhone,
          message 
        },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        toast.success('Comprovante enviado para o cliente!');
      } else {
        throw new Error(result?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Error sending WhatsApp to client:', error);
      toast.error('Erro ao enviar para cliente: ' + (error.message || 'Tente novamente'));
    } finally {
      setIsSendingToClient(false);
    }
  };

  const handleClientButtonClick = () => {
    setShowSpamWarning(true);
  };

  const handleConfirmSendToClient = () => {
    setShowSpamWarning(false);
    handleSendToClient();
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await generatePaymentReceipt(data);
      toast.success('Comprovante de pagamento baixado!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Erro ao gerar comprovante');
    } finally {
      setIsGenerating(false);
    }
  };

  const isFullyPaid = data.remainingBalance <= 0;
  const canSendToClient = profile?.whatsapp_instance_id && profile?.whatsapp_to_clients_enabled && clientPhone;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-md sm:max-w-lg animate-scale-in">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Pagamento Registrado!
            </DialogTitle>
            <DialogDescription>
              Deseja baixar ou enviar o comprovante?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            <div className="bg-primary/10 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium">{getTypeLabel(data.type)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{data.clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Parcela:</span>
                <span className="font-medium">{data.installmentNumber}/{data.totalInstallments}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Pago:</span>
                <span className="font-semibold text-primary">{formatCurrency(data.amountPaid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">{formatDate(data.paymentDate)}</span>
              </div>
              {isFullyPaid ? (
                <div className="bg-primary rounded-lg p-2 text-center text-primary-foreground text-sm font-medium mt-2">
                  ✅ Contrato Quitado!
                </div>
              ) : (
                <div className="flex justify-between text-sm pt-2 border-t border-primary/20">
                  <span className="text-muted-foreground">Saldo Restante:</span>
                  <span className="font-semibold">{formatCurrency(data.remainingBalance)}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs sm:text-sm">
              <X className="w-4 h-4 mr-1 sm:mr-2" />
              Fechar
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSendWhatsApp} 
              disabled={isSendingWhatsApp}
              className="text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
            >
              {isSendingWhatsApp ? (
                <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4 mr-1 sm:mr-2" />
              )}
              {isSendingWhatsApp ? 'Enviando...' : 'Para Mim'}
            </Button>
            {canSendToClient && (
              <Button 
                variant="outline" 
                onClick={handleClientButtonClick} 
                disabled={isSendingToClient}
                className="text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700"
              >
                {isSendingToClient ? (
                  <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
                ) : (
                  <Users className="w-4 h-4 mr-1 sm:mr-2" />
                )}
                {isSendingToClient ? 'Enviando...' : 'Para Cliente'}
              </Button>
            )}
            <Button onClick={handleDownload} disabled={isGenerating} className="text-xs sm:text-sm">
              <Download className="w-4 h-4 mr-1 sm:mr-2" />
              {isGenerating ? 'Gerando...' : 'PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SpamWarningDialog
        open={showSpamWarning}
        onOpenChange={setShowSpamWarning}
        onConfirm={handleConfirmSendToClient}
      />
    </>
  );
}
