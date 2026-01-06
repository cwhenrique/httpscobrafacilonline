import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, FileText, MessageCircle, Loader2, Users, Copy } from 'lucide-react';
import { generatePaymentReceipt, PaymentReceiptData } from '@/lib/pdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SpamWarningDialog from './SpamWarningDialog';
import MessagePreviewDialog from './MessagePreviewDialog';
import WhatsAppNotConnectedDialog from './WhatsAppNotConnectedDialog';


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

// Interface for list data (used for collector messages)
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

// Generate plain text message for CLIENT
const generateClientMessage = (data: PaymentReceiptData, installmentDates?: string[], paidCount?: number, companyName?: string): string => {
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
  
  let message = `Olá *${data.clientName}*!\n`;
  message += `━━━━━━━━━━━━━━━━\n\n`;
  message += `✅ *PAGAMENTO CONFIRMADO*\n\n`;
  message += `💰 *Valor Pago:* ${formatCurrency(data.amountPaid)}\n`;
  if (data.penaltyAmount && data.penaltyAmount > 0) {
    message += `⚠️ *Multa Inclusa:* ${formatCurrency(data.penaltyAmount)}\n`;
  }
  if (data.discountAmount && data.discountAmount > 0) {
    message += `🏷️ *Desconto:* ${formatCurrency(data.discountAmount)}\n`;
  }
  
  if (Array.isArray(installments)) {
    message += `📊 *Parcelas Pagas:* ${installments.join(', ')} de ${totalCount}\n`;
  } else {
    message += `📊 *Parcela:* ${installments}/${totalCount}\n`;
  }
  message += `📅 *Data:* ${formatDate(data.paymentDate)}\n\n`;
  
  // Progress bar
  const filledBlocks = Math.round(progressPercent / 10);
  const emptyBlocks = 10 - filledBlocks;
  message += `📈 *Progresso:* ${'▓'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${progressPercent}%\n`;
  
  // Status das parcelas com emojis (para mensagem do cliente)
  if (installmentDates && installmentDates.length > 0) {
    const actualPaidCount = paidCount ?? maxPaidInstallment;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    message += `\n📊 *STATUS DAS PARCELAS:*\n`;
    installmentDates.forEach((dateStr, index) => {
      const installmentNum = index + 1;
      const dueDate = new Date(dateStr + 'T12:00:00');
      
      let emoji: string;
      let status: string;
      
      if (installmentNum <= actualPaidCount) {
        emoji = '✅';
        status = 'Paga';
      } else if (dueDate < today) {
        emoji = '❌';
        status = 'Em Atraso';
      } else {
        emoji = '⏳';
        status = 'Em Aberto';
      }
      
      message += `${installmentNum}️⃣ ${emoji} ${formatDate(dateStr)} - ${status}\n`;
    });
  }
  message += `\n`;
  
  if (isFullyPaid) {
    message += `🎉 *CONTRATO QUITADO!*\n`;
    message += `Obrigado pela confiança!\n`;
  } else {
    message += `📊 *Saldo Restante:* ${formatCurrency(data.remainingBalance)}\n`;
    if (data.nextDueDate) {
      message += `📅 *Próximo Vencimento:* ${formatDate(data.nextDueDate)}\n`;
    }
  }
  
  const signatureName = data.billingSignatureName || companyName;
  if (signatureName) {
    message += `\n━━━━━━━━━━━━━━━━\n`;
    message += `_${signatureName}_`;
  }

  return message;
};

// Generate complete message for SELF (direct send, with progress bar and emojis)
const generateSelfMessage = (
  data: PaymentReceiptData, 
  clientPhone?: string, 
  installmentDates?: string[], 
  paidCount?: number
): string => {
  const prefix = getContractPrefix(data.type);
  const contractNumber = `${prefix}-${data.contractId.substring(0, 8).toUpperCase()}`;
  const isFullyPaid = data.remainingBalance <= 0;
  
  const maxPaidInstallment = Array.isArray(data.installmentNumber) 
    ? Math.max(...data.installmentNumber) 
    : data.installmentNumber;
  
  // Calculate progress
  let progressPercent: number;
  if (isFullyPaid) {
    progressPercent = 100;
  } else if (data.totalContract && data.totalPaid) {
    progressPercent = Math.min(100, Math.round((data.totalPaid / data.totalContract) * 100));
  } else {
    progressPercent = Math.round((maxPaidInstallment / data.totalInstallments) * 100);
  }
  
  let message = `✅ *PAGAMENTO REGISTRADO*\n`;
  message += `━━━━━━━━━━━━━━━━\n\n`;
  message += `📋 *Contrato:* ${contractNumber}\n`;
  message += `👤 *Cliente:* ${data.clientName}\n`;
  if (clientPhone) {
    message += `📱 *Telefone:* ${clientPhone}\n`;
  }
  
  message += `\n💰 *PAGAMENTO*\n`;
  message += `• Valor Pago: ${formatCurrency(data.amountPaid)}\n`;
  if (data.penaltyAmount && data.penaltyAmount > 0) {
    message += `• Multa: ${formatCurrency(data.penaltyAmount)}\n`;
  }
  if (data.discountAmount && data.discountAmount > 0) {
    message += `• Desconto: ${formatCurrency(data.discountAmount)}\n`;
  }
  if (Array.isArray(data.installmentNumber)) {
    message += `• Parcelas Pagas: ${data.installmentNumber.join(', ')} de ${data.totalInstallments}\n`;
  } else {
    message += `• Parcela: ${data.installmentNumber}/${data.totalInstallments}\n`;
  }
  message += `• Data: ${formatDate(data.paymentDate)}\n`;
  
  // Progress bar
  const filledBlocks = Math.round(progressPercent / 10);
  const emptyBlocks = 10 - filledBlocks;
  message += `\n📈 *Progresso:* ${'▓'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)} ${progressPercent}%\n`;
  
  // Installment status with emojis
  if (installmentDates && installmentDates.length > 0) {
    const actualPaidCount = paidCount ?? maxPaidInstallment;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    message += `\n📊 *STATUS DAS PARCELAS:*\n`;
    installmentDates.forEach((dateStr, index) => {
      const installmentNum = index + 1;
      const dueDate = new Date(dateStr + 'T12:00:00');
      
      let emoji: string;
      let status: string;
      
      if (installmentNum <= actualPaidCount) {
        emoji = '✅';
        status = 'Paga';
      } else if (dueDate < today) {
        emoji = '🔴';
        status = 'Em Atraso';
      } else {
        emoji = '⏳';
        status = 'Em Aberto';
      }
      
      message += `${installmentNum}️⃣ ${emoji} ${formatDate(dateStr)} - ${status}\n`;
    });
  }
  
  message += `\n`;
  if (isFullyPaid) {
    message += `🎉 *CONTRATO QUITADO!*\n`;
  } else {
    message += `📊 *Saldo Restante:* ${formatCurrency(data.remainingBalance)}\n`;
    if (data.nextDueDate) {
      message += `📅 *Próximo Vencimento:* ${formatDate(data.nextDueDate)}\n`;
    }
  }
  
  message += `\n━━━━━━━━━━━━━━━━\n`;
  message += `_CobraFácil_`;
  
  return message;
};

export default function PaymentReceiptPrompt({ open, onOpenChange, data, clientPhone, installmentDates, paidCount }: PaymentReceiptPromptProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isSendingToClient, setIsSendingToClient] = useState(false);
  const [showSpamWarning, setShowSpamWarning] = useState(false);
  const [showPreviewForSelf, setShowPreviewForSelf] = useState(false);
  const [showPreviewForClient, setShowPreviewForClient] = useState(false);
  const [showWhatsAppNotConnected, setShowWhatsAppNotConnected] = useState(false);
  const [showCopyPreview, setShowCopyPreview] = useState(false);
  const { profile } = useProfile();
  const { user } = useAuth();

  const hasWhatsAppConnected = profile?.whatsapp_instance_id && profile?.whatsapp_connected_phone;

  if (!data) return null;

  // Open preview for self
  const handleSendToSelfClick = () => {
    if (!profile?.phone) {
      toast.error('Configure seu telefone no perfil para receber comprovantes');
      return;
    }
    // Check if user has WhatsApp connected
    if (!profile?.whatsapp_instance_id || !profile?.whatsapp_connected_phone) {
      setShowWhatsAppNotConnected(true);
      return;
    }
    setShowPreviewForSelf(true);
  };

  // Send complete message directly to self (no OK confirmation needed)
  const handleConfirmSendToSelf = async () => {
    if (!profile?.phone) {
      toast.error('Configure seu telefone no perfil para receber comprovantes');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }
    
    setIsSendingWhatsApp(true);
    try {
      const message = generateSelfMessage(data, clientPhone, installmentDates, paidCount);
      
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp-to-self', {
        body: { userId: user.id, message },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        toast.success('Comprovante enviado para você!');
        setShowPreviewForSelf(false);
      } else if (result?.error === 'whatsapp_not_connected') {
        setShowWhatsAppNotConnected(true);
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

  // Send to client (after preview confirmation) - USES PLAIN TEXT
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
      const message = generateClientMessage(data, installmentDates, paidCount, profile?.company_name || undefined);
      
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
            {/* Botão Copiar - SEMPRE aparece */}
            <Button 
              variant="outline" 
              onClick={() => setShowCopyPreview(true)}
              className="text-xs sm:text-sm bg-amber-500 hover:bg-amber-600 text-white border-amber-500 hover:border-amber-600"
            >
              <Copy className="w-4 h-4 mr-1 sm:mr-2" />
              Copiar
            </Button>
            
            {/* Botões de WhatsApp - condicionais */}
            {hasWhatsAppConnected ? (
              <>
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
                    {isSendingToClient ? 'Enviando...' : 'Cliente'}
                  </Button>
                )}
              </>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => setShowWhatsAppNotConnected(true)}
                className="text-xs sm:text-sm border-green-600 text-green-600 hover:bg-green-50"
              >
                <MessageCircle className="w-4 h-4 mr-1 sm:mr-2" />
                Conecte o WhatsApp
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

      {/* Preview for self - show complete message */}
      <MessagePreviewDialog
        open={showPreviewForSelf}
        onOpenChange={setShowPreviewForSelf}
        initialMessage={generateSelfMessage(data, clientPhone, installmentDates, paidCount)}
        recipientName="Você"
        recipientType="self"
        onConfirm={handleConfirmSendToSelf}
        isSending={isSendingWhatsApp}
      />

      {/* Preview for client - plain text */}
      <MessagePreviewDialog
        open={showPreviewForClient}
        onOpenChange={setShowPreviewForClient}
        initialMessage={generateClientMessage(data, installmentDates, paidCount, profile?.company_name || undefined)}
        recipientName={data.clientName}
        recipientType="client"
        onConfirm={handleConfirmSendToClient}
        isSending={isSendingToClient}
      />

      {/* WhatsApp not connected dialog */}
      <WhatsAppNotConnectedDialog
        open={showWhatsAppNotConnected}
        onOpenChange={setShowWhatsAppNotConnected}
      />

      {/* Copy preview for users without WhatsApp */}
      <MessagePreviewDialog
        open={showCopyPreview}
        onOpenChange={setShowCopyPreview}
        initialMessage={generateSelfMessage(data, clientPhone, installmentDates, paidCount)}
        recipientName="Você"
        recipientType="self"
        onConfirm={() => setShowCopyPreview(false)}
        mode="copy"
      />
    </>
  );
}
