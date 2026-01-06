import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, FileText, X, User, Calendar, DollarSign, Users, Loader2, Percent, CreditCard, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateContractReceipt, ContractReceiptData } from '@/lib/pdfGenerator';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import SpamWarningDialog from './SpamWarningDialog';
import MessagePreviewDialog from './MessagePreviewDialog';
import WhatsAppNotConnectedDialog from './WhatsAppNotConnectedDialog';


interface LoanData {
  id: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  principalAmount: number;
  interestRate: number;
  totalInterest: number;
  totalToReceive: number;
  installments: number;
  installmentValue: number;
  contractDate: string; // Data do contrato (quando foi fechado)
  startDate: string; // Data da primeira parcela (primeiro vencimento)
  dueDate: string;
  paymentType: string;
}

interface LoanCreatedReceiptPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanData | null;
  companyName: string;
  userPhone?: string;
  installmentDates?: string[];
}

export default function LoanCreatedReceiptPrompt({
  open,
  onOpenChange,
  loan,
  companyName,
  userPhone,
  installmentDates,
}: LoanCreatedReceiptPromptProps) {
  const [isSending, setIsSending] = useState(false);
  const [isSendingToClient, setIsSendingToClient] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showSpamWarning, setShowSpamWarning] = useState(false);
  const [showPreviewForSelf, setShowPreviewForSelf] = useState(false);
  const [showPreviewForClient, setShowPreviewForClient] = useState(false);
  const [showWhatsAppNotConnected, setShowWhatsAppNotConnected] = useState(false);
  const [showCopyPreview, setShowCopyPreview] = useState(false);
  const { profile } = useProfile();
  const { user } = useAuth();

  const hasWhatsAppConnected = profile?.whatsapp_instance_id && profile?.whatsapp_connected_phone;

  if (!loan) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'single': return 'Pagamento Único';
      case 'installment': return 'Parcelado';
      case 'daily': return 'Diário';
      case 'weekly': return 'Semanal';
      default: return type;
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
  const generateClientMessage = (): string => {
    let message = `Olá *${loan.clientName}*!\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    message += `📄 *CONTRATO DE EMPRÉSTIMO*\n\n`;
    message += `💵 *Valor Emprestado:* ${formatCurrency(loan.principalAmount)}\n`;
    message += `💰 *Total a Pagar:* ${formatCurrency(loan.totalToReceive)}\n`;
    
    if (loan.installments > 1) {
      message += `📊 *Parcelas:* ${loan.installments}x de ${formatCurrency(loan.installmentValue)}\n`;
    }
    
    message += `📅 *Primeiro Vencimento:* ${formatDate(loan.startDate)}\n`;
    
    // Status das parcelas com emojis
    if (installmentDates && installmentDates.length > 0) {
      message += `\n📊 *VENCIMENTOS:*\n`;
      installmentDates.forEach((dateStr, index) => {
        const installmentNum = index + 1;
        message += `${installmentNum}️⃣ ⏳ ${formatDate(dateStr)} - Em Aberto\n`;
      });
      
      // Barra de progresso (0% quando criado)
      message += `\n📈 *Progresso:* ${'░'.repeat(10)} 0%\n`;
    }
    
    const signatureName = profile?.billing_signature_name || companyName;
    if (signatureName) {
      message += `\n━━━━━━━━━━━━━━━━\n`;
      message += `_${signatureName}_`;
    }

    return message;
  };

  // Generate complete message for SELF (direct send, no OK confirmation)
  const generateSelfMessage = (): string => {
    const contractId = `EMP-${loan.id.substring(0, 4).toUpperCase()}`;
    
    let message = `📄 *EMPRÉSTIMO REGISTRADO*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    message += `📋 *Contrato:* ${contractId}\n`;
    message += `📅 *Data:* ${formatDate(loan.contractDate)}\n\n`;
    message += `👤 *Cliente:* ${loan.clientName}\n`;
    if (loan.clientPhone) {
      message += `📱 *Telefone:* ${loan.clientPhone}\n`;
    }
    
    message += `\n💰 *VALORES*\n`;
    message += `• Emprestado: ${formatCurrency(loan.principalAmount)}\n`;
    message += `• Juros: ${loan.interestRate}%\n`;
    message += `• Total Juros: ${formatCurrency(loan.totalInterest)}\n`;
    message += `• Total a Receber: ${formatCurrency(loan.totalToReceive)}\n`;
    
    if (loan.installments > 1) {
      message += `• Parcelas: ${loan.installments}x de ${formatCurrency(loan.installmentValue)}\n`;
    }
    
    message += `\n📅 *1º Vencimento:* ${formatDate(loan.startDate)}\n`;
    
    // Add installment status with emojis
    if (installmentDates && installmentDates.length > 0) {
      message += `\n📊 *STATUS DAS PARCELAS:*\n`;
      installmentDates.forEach((date, index) => {
        const emoji = '⏳'; // All are open when loan is just created
        message += `${index + 1}️⃣ ${emoji} ${formatDate(date)} - Em Aberto\n`;
      });
    }
    
    message += `\n━━━━━━━━━━━━━━━━\n`;
    message += `_CobraFácil_`;
    
    return message;
  };

  // Open preview for self
  const handleSendToSelfClick = () => {
    if (!userPhone) {
      toast.error('Telefone não configurado no perfil');
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
    if (!userPhone) {
      toast.error('Telefone não configurado no perfil');
      return;
    }

    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    setIsSending(true);
    try {
      const message = generateSelfMessage();
      
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp-to-self', {
        body: { userId: user.id, message },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        toast.success('Comprovante enviado para você!');
        setShowPreviewForSelf(false);
        onOpenChange(false);
      } else if (result?.error === 'whatsapp_not_connected') {
        setShowWhatsAppNotConnected(true);
      } else {
        throw new Error(result?.error || 'Erro ao enviar');
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      toast.error('Erro ao enviar comprovante');
    } finally {
      setIsSending(false);
    }
  };

  // Open spam warning first for client
  const handleClientButtonClick = () => {
    setShowSpamWarning(true);
  };

  // After spam warning, show preview for client
  const handleConfirmSpamWarning = () => {
    setShowSpamWarning(false);
    setShowPreviewForClient(true);
  };

  // Send to client - DIRECT MESSAGE (no confirmation needed)
  const handleConfirmSendToClient = async () => {
    if (!loan.clientPhone) {
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
      const message = generateClientMessage();
      
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp-to-client', {
        body: { 
          userId: user.id,
          clientPhone: loan.clientPhone,
          message
        },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        toast.success('Comprovante enviado para o cliente!');
        setShowPreviewForClient(false);
        onOpenChange(false);
      } else {
        throw new Error(result?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Erro ao enviar WhatsApp para cliente:', error);
      toast.error('Erro ao enviar para cliente: ' + (error.message || 'Tente novamente'));
    } finally {
      setIsSendingToClient(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const receiptData: ContractReceiptData = {
        type: 'loan',
        contractId: loan.id,
        companyName,
        customLogoUrl: profile?.company_logo_url,
        client: {
          name: loan.clientName,
          phone: loan.clientPhone,
          address: loan.clientAddress,
        },
        negotiation: {
          principal: loan.principalAmount,
          interestRate: loan.interestRate,
          installments: loan.installments,
          installmentValue: loan.installmentValue,
          totalToReceive: loan.totalToReceive,
          startDate: loan.startDate,
          contractDate: loan.contractDate,
        },
        dueDates: installmentDates || [],
      };
      
      await generateContractReceipt(receiptData);
      
      toast.success('PDF baixado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const canSendToClient =
    profile?.whatsapp_instance_id &&
    profile?.whatsapp_connected_phone &&
    profile?.whatsapp_to_clients_enabled &&
    loan.clientPhone;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CreditCard className="w-5 h-5" />
              Empréstimo Criado!
            </DialogTitle>
            <DialogDescription>
              Deseja enviar comprovante ao cliente?
            </DialogDescription>
          </DialogHeader>

          {/* Loan summary preview */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{loan.clientName}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span>Valor: {formatCurrency(loan.principalAmount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-muted-foreground" />
                  <span>Juros: {loan.interestRate}%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span>{loan.installments}x {formatCurrency(loan.installmentValue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Venc: {formatDate(loan.startDate)}</span>
                </div>
              </div>
              
              <div className="pt-2 border-t border-primary/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total a Receber:</span>
                  <span className="font-bold text-primary">{formatCurrency(loan.totalToReceive)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 mt-4">
            {/* Botão Copiar - SEMPRE aparece */}
            <Button 
              variant="outline"
              onClick={() => setShowCopyPreview(true)} 
              className="w-full bg-amber-500 hover:bg-amber-600 text-white border-amber-500 hover:border-amber-600"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Texto
            </Button>

            {/* Botões de WhatsApp - condicionais */}
            {hasWhatsAppConnected ? (
              <>
                <Button 
                  onClick={handleSendToSelfClick} 
                  disabled={isSending || !userPhone}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MessageCircle className="w-4 h-4 mr-2" />
                  )}
                  {isSending ? 'Enviando...' : 'Enviar para Mim'}
                </Button>

                {canSendToClient && (
                  <Button 
                    variant="outline"
                    onClick={handleClientButtonClick} 
                    disabled={isSendingToClient}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700"
                  >
                    {isSendingToClient ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Users className="w-4 h-4 mr-2" />
                    )}
                    {isSendingToClient ? 'Enviando...' : 'Enviar para o Cliente'}
                  </Button>
                )}
              </>
            ) : (
              <Button 
                variant="outline"
                onClick={() => setShowWhatsAppNotConnected(true)}
                className="w-full border-green-600 text-green-600 hover:bg-green-50"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Conecte o WhatsApp
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="w-full"
            >
              <FileText className="w-4 h-4 mr-2" />
              {isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}
            </Button>
            
          </div>
        </DialogContent>
      </Dialog>

      <SpamWarningDialog
        open={showSpamWarning}
        onOpenChange={setShowSpamWarning}
        onConfirm={handleConfirmSpamWarning}
      />

      {/* Preview for self */}
      <MessagePreviewDialog
        open={showPreviewForSelf}
        onOpenChange={setShowPreviewForSelf}
        initialMessage={generateSelfMessage()}
        recipientName="Você"
        recipientType="self"
        onConfirm={handleConfirmSendToSelf}
        isSending={isSending}
      />

      {/* Preview for client - plain text */}
      <MessagePreviewDialog
        open={showPreviewForClient}
        onOpenChange={setShowPreviewForClient}
        initialMessage={generateClientMessage()}
        recipientName={loan.clientName}
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
        initialMessage={generateSelfMessage()}
        recipientName="Você"
        recipientType="self"
        onConfirm={() => setShowCopyPreview(false)}
        mode="copy"
      />
    </>
  );
}
