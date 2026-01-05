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
import MessagePreviewDialog from './MessagePreviewDialog';


interface PaymentReceiptPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PaymentReceiptData | null;
  clientPhone?: string; // Telefone do cliente para envio direto
  installmentDates?: string[]; // Datas de vencimento de cada parcela
  paidCount?: number; // Número de parcelas pagas
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

// Generate list data for CLIENT (simple, no technical details)
const generateClientListData = (data: PaymentReceiptData, installmentDates?: string[], paidCount?: number, companyName?: string): ListData => {
  const isFullyPaid = data.remainingBalance <= 0;
  const installments = data.installmentNumber;
  const totalCount = data.totalInstallments;
  
  const maxPaidInstallment = Array.isArray(installments) 
    ? Math.max(...installments) 
    : installments;
  
  let progressPercent: number;
  if (isFullyPaid) {
    progressPercent = 100;
  } else if (data.totalContract && data.totalPaid) {
    progressPercent = Math.min(100, Math.round((data.totalPaid / data.totalContract) * 100));
  } else {
    progressPercent = Math.round((maxPaidInstallment / totalCount) * 100);
  }
  
  // Build rich description
  let description = `Olá *${data.clientName}*!\n`;
  description += `━━━━━━━━━━━━━━━━\n\n`;
  description += `✅ *PAGAMENTO CONFIRMADO*\n\n`;
  description += `💰 *Valor Pago:* ${formatCurrency(data.amountPaid)}\n`;
  if (data.penaltyAmount && data.penaltyAmount > 0) {
    description += `⚠️ *Multa Inclusa:* ${formatCurrency(data.penaltyAmount)}\n`;
  }
  if (data.discountAmount && data.discountAmount > 0) {
    description += `🏷️ *Desconto:* ${formatCurrency(data.discountAmount)}\n`;
  }
  
  if (Array.isArray(installments)) {
    description += `📊 *Parcelas Pagas:* ${installments.join(', ')} de ${totalCount}\n`;
  } else {
    description += `📊 *Parcela:* ${installments}/${totalCount}\n`;
  }
  description += `📅 *Data:* ${formatDate(data.paymentDate)}\n\n`;
  
  // Progress bar
  const filledBlocks = Math.round(progressPercent / 10);
  const emptyBlocks = 10 - filledBlocks;
  description += `📈 *Progresso:* ${'▓'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${progressPercent}%\n\n`;
  
  if (isFullyPaid) {
    description += `🎉 *CONTRATO QUITADO!*\n`;
    description += `Obrigado pela confiança!\n`;
  } else {
    description += `📊 *Saldo Restante:* ${formatCurrency(data.remainingBalance)}\n`;
    if (data.nextDueDate) {
      description += `📅 *Próximo Vencimento:* ${formatDate(data.nextDueDate)}\n`;
    }
  }
  
  description += `\n━━━━━━━━━━━━━━━━`;

  const sections: ListSection[] = [{
    title: "📋 Detalhes",
    rows: [
      { title: "Valor Pago", description: formatCurrency(data.amountPaid), rowId: "amount" },
      { title: "Parcela", description: Array.isArray(installments) ? `${installments.join(', ')} de ${totalCount}` : `${installments}/${totalCount}`, rowId: "inst" },
      { title: "Saldo Restante", description: formatCurrency(data.remainingBalance), rowId: "balance" },
    ]
  }];

  const signatureName = data.billingSignatureName || companyName || 'CobraFácil';

  return {
    title: "✅ Pagamento Recebido",
    description,
    buttonText: "📋 Ver Detalhes",
    footerText: signatureName,
    sections,
  };
};

// Generate list data for COLLECTOR (full details)
const generateCollectorListData = (data: PaymentReceiptData, clientPhone?: string): ListData => {
  const prefix = getContractPrefix(data.type);
  const contractNumber = `${prefix}-${data.contractId.substring(0, 8).toUpperCase()}`;
  const isFullyPaid = data.remainingBalance <= 0;
  
  let description = `📋 *Contrato:* ${contractNumber}\n`;
  description += `━━━━━━━━━━━━━━━━\n\n`;
  description += `👤 *Cliente:* ${data.clientName}\n`;
  if (clientPhone) {
    description += `📱 *Telefone:* ${clientPhone}\n`;
  }
  description += `\n💰 *PAGAMENTO*\n`;
  description += `• Valor Pago: ${formatCurrency(data.amountPaid)}\n`;
  if (data.penaltyAmount && data.penaltyAmount > 0) {
    description += `• Multa: ${formatCurrency(data.penaltyAmount)}\n`;
  }
  if (data.discountAmount && data.discountAmount > 0) {
    description += `• Desconto: ${formatCurrency(data.discountAmount)}\n`;
  }
  if (Array.isArray(data.installmentNumber)) {
    description += `• Parcelas: ${data.installmentNumber.join(', ')} de ${data.totalInstallments}\n`;
  } else {
    description += `• Parcela: ${data.installmentNumber}/${data.totalInstallments}\n`;
  }
  description += `• Data: ${formatDate(data.paymentDate)}\n\n`;
  
  description += `📊 *SITUAÇÃO*\n`;
  if (data.totalContract) {
    description += `• Total Contrato: ${formatCurrency(data.totalContract)}\n`;
  }
  if (data.totalPaid) {
    description += `• Total Pago: ${formatCurrency(data.totalPaid)}\n`;
  }
  
  if (isFullyPaid) {
    description += `\n🎉 *CONTRATO QUITADO!*\n`;
  } else {
    description += `• Saldo: ${formatCurrency(data.remainingBalance)}\n`;
  }
  
  description += `\n━━━━━━━━━━━━━━━━\n`;
  description += `📲 Responda OK para continuar recebendo.`;

  const sections: ListSection[] = [
    {
      title: "💰 Pagamento",
      rows: [
        { title: "Valor Pago", description: formatCurrency(data.amountPaid), rowId: "amount" },
        { title: "Parcela", description: Array.isArray(data.installmentNumber) ? `${data.installmentNumber.join(', ')}/${data.totalInstallments}` : `${data.installmentNumber}/${data.totalInstallments}`, rowId: "inst" },
        { title: "Data", description: formatDate(data.paymentDate), rowId: "date" },
      ]
    },
    {
      title: "📊 Situação",
      rows: [
        { title: isFullyPaid ? "✅ Quitado" : "Saldo Restante", description: isFullyPaid ? "Contrato finalizado" : formatCurrency(data.remainingBalance), rowId: "balance" },
      ]
    }
  ];

  return {
    title: "✅ Pagamento Registrado",
    description,
    buttonText: "📋 Ver Detalhes",
    footerText: "CobraFácil",
    sections,
  };
};

export default function PaymentReceiptPrompt({ open, onOpenChange, data, clientPhone, installmentDates, paidCount }: PaymentReceiptPromptProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isSendingToClient, setIsSendingToClient] = useState(false);
  const [showSpamWarning, setShowSpamWarning] = useState(false);
  const [showPreviewForSelf, setShowPreviewForSelf] = useState(false);
  const [showPreviewForClient, setShowPreviewForClient] = useState(false);
  const { profile } = useProfile();
  const { user } = useAuth();

  if (!data) return null;

  // Open preview for self
  const handleSendToSelfClick = () => {
    if (!profile?.phone) {
      toast.error('Configure seu telefone no perfil para receber comprovantes');
      return;
    }
    setShowPreviewForSelf(true);
  };

  // Send to collector (after preview confirmation) - NOW USES LIST
  const handleConfirmSendToSelf = async () => {
    if (!profile?.phone) {
      toast.error('Configure seu telefone no perfil para receber comprovantes');
      return;
    }
    
    setIsSendingWhatsApp(true);
    try {
      const listData = generateCollectorListData(data, clientPhone);
      
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { phone: profile.phone, listData },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        toast.success('Comprovante enviado para seu WhatsApp!');
        setShowPreviewForSelf(false);
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

  // Open spam warning for client
  const handleClientButtonClick = () => {
    setShowSpamWarning(true);
  };

  // After spam warning, show preview for client
  const handleConfirmSpamWarning = () => {
    setShowSpamWarning(false);
    setShowPreviewForClient(true);
  };

  // Send to client (after preview confirmation) - NOW USES LIST
  const handleConfirmSendToClient = async () => {
    if (!clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    if (!profile?.whatsapp_connected_phone) {
      toast.error('Seu WhatsApp não está conectado. Reconecte nas configurações (QR Code).');
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
      const listData = generateClientListData(data, installmentDates, paidCount, profile?.company_name || undefined);
      
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp-to-client', {
        body: { 
          userId: user.id,
          clientPhone: clientPhone,
          listData 
        },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        toast.success('Comprovante enviado para o cliente!');
        setShowPreviewForClient(false);
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

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await generatePaymentReceipt({
        ...data,
        customLogoUrl: profile?.company_logo_url,
      });
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
  const canSendToClient =
    profile?.whatsapp_instance_id &&
    profile?.whatsapp_connected_phone &&
    profile?.whatsapp_to_clients_enabled &&
    clientPhone;

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
                <span className="text-muted-foreground">{Array.isArray(data.installmentNumber) ? 'Parcelas:' : 'Parcela:'}</span>
                <span className="font-medium">
                  {Array.isArray(data.installmentNumber) 
                    ? `${data.installmentNumber.join(', ')} de ${data.totalInstallments}`
                    : `${data.installmentNumber}/${data.totalInstallments}`
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor Pago:</span>
                <span className="font-semibold text-primary">{formatCurrency(data.amountPaid)}</span>
              </div>
              {data.penaltyAmount && data.penaltyAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Multa Inclusa:</span>
                  <span className="font-medium text-red-500">+{formatCurrency(data.penaltyAmount)}</span>
                </div>
              )}
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
              onClick={handleSendToSelfClick} 
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
        onConfirm={handleConfirmSpamWarning}
      />

      {/* Preview for self - show list preview */}
      <MessagePreviewDialog
        open={showPreviewForSelf}
        onOpenChange={setShowPreviewForSelf}
        initialMessage={generateCollectorListData(data, clientPhone).description}
        recipientName="Você"
        recipientType="self"
        onConfirm={handleConfirmSendToSelf}
        isSending={isSendingWhatsApp}
      />

      {/* Preview for client - show list preview */}
      <MessagePreviewDialog
        open={showPreviewForClient}
        onOpenChange={setShowPreviewForClient}
        initialMessage={generateClientListData(data, installmentDates, paidCount, profile?.company_name || undefined).description}
        recipientName={data.clientName}
        recipientType="client"
        onConfirm={handleConfirmSendToClient}
        isSending={isSendingToClient}
      />
    </>
  );
}
