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
import { MessageCircle, FileText, X, Package, User, Calendar, DollarSign, Users, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateClientSaleReceipt } from '@/lib/pdfGenerator';
import { ProductSale } from '@/hooks/useProductSales';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import SpamWarningDialog from './SpamWarningDialog';

interface SaleCreatedReceiptPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: ProductSale | null;
  companyName: string;
  userPhone?: string;
  installmentDates?: { number: number; date: string; isPaid?: boolean }[];
}

export default function SaleCreatedReceiptPrompt({
  open,
  onOpenChange,
  sale,
  companyName,
  userPhone,
  installmentDates,
}: SaleCreatedReceiptPromptProps) {
  const [isSending, setIsSending] = useState(false);
  const [isSendingToClient, setIsSendingToClient] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showSpamWarning, setShowSpamWarning] = useState(false);
  const { profile } = useProfile();
  const { user } = useAuth();

  if (!sale) return null;

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

  // Generate list data for CLIENT (simple, no cost/profit)
  const generateClientListData = (): ListData => {
    const downPayment = sale.down_payment || 0;
    
    let description = `Olá *${sale.client_name}*!\n`;
    description += `━━━━━━━━━━━━━━━━\n\n`;
    description += `📦 *COMPROVANTE DE VENDA*\n\n`;
    description += `📋 *Produto:* ${sale.product_name}\n`;
    description += `💵 *Valor Total:* ${formatCurrency(sale.total_amount)}\n`;
    
    if (downPayment > 0) {
      description += `📥 *Entrada:* ${formatCurrency(downPayment)}\n`;
    }
    
    description += `📊 *Parcelas:* ${sale.installments}x de ${formatCurrency(sale.installment_value)}\n`;
    description += `📅 *Primeiro Vencimento:* ${formatDate(sale.first_due_date)}\n`;
    
    description += `\n━━━━━━━━━━━━━━━━`;

    const sections: ListSection[] = [{
      title: "📋 Detalhes",
      rows: [
        { title: "Produto", description: sale.product_name, rowId: "product" },
        { title: "Valor", description: formatCurrency(sale.total_amount), rowId: "total" },
        { title: "Parcelas", description: `${sale.installments}x ${formatCurrency(sale.installment_value)}`, rowId: "inst" },
      ]
    }];

    return {
      title: "📦 Comprovante de Venda",
      description,
      buttonText: "📋 Ver Detalhes",
      footerText: companyName || 'CobraFácil',
      sections,
    };
  };

  // Generate list data for COLLECTOR (full details)
  const generateCollectorListData = (): ListData => {
    const contractId = `PRD-${sale.id.substring(0, 4).toUpperCase()}`;
    const downPayment = sale.down_payment || 0;
    const costValue = sale.cost_value || 0;
    const profit = sale.total_amount - costValue;
    
    let description = `📋 *Contrato:* ${contractId}\n`;
    description += `━━━━━━━━━━━━━━━━\n\n`;
    description += `👤 *Cliente:* ${sale.client_name}\n`;
    if (sale.client_phone) {
      description += `📱 *Telefone:* ${sale.client_phone}\n`;
    }
    description += `\n📦 *Produto:* ${sale.product_name}\n`;
    if (sale.product_description) {
      description += `   ${sale.product_description}\n`;
    }
    description += `\n💰 *VALORES*\n`;
    description += `• Valor Total: ${formatCurrency(sale.total_amount)}\n`;
    if (costValue > 0) {
      description += `• Custo: ${formatCurrency(costValue)}\n`;
      description += `• Lucro: ${formatCurrency(profit)}\n`;
    }
    if (downPayment > 0) {
      description += `• Entrada: ${formatCurrency(downPayment)}\n`;
    }
    description += `• Parcelas: ${sale.installments}x de ${formatCurrency(sale.installment_value)}\n`;
    
    description += `\n━━━━━━━━━━━━━━━━\n`;
    description += `📲 Responda OK para continuar recebendo.`;

    const sections: ListSection[] = [
      {
        title: "💰 Valores",
        rows: [
          { title: "Total", description: formatCurrency(sale.total_amount), rowId: "total" },
          { title: "Parcelas", description: `${sale.installments}x ${formatCurrency(sale.installment_value)}`, rowId: "inst" },
        ]
      }
    ];
    
    if (costValue > 0) {
      sections.push({
        title: "📊 Financeiro",
        rows: [
          { title: "Custo", description: formatCurrency(costValue), rowId: "cost" },
          { title: "Lucro", description: formatCurrency(profit), rowId: "profit" },
        ]
      });
    }

    return {
      title: "📦 Venda Registrada",
      description,
      buttonText: "📋 Ver Detalhes",
      footerText: "CobraFácil",
      sections,
    };
  };

  // Send to collector - NOW USES LIST
  const handleSendWhatsApp = async () => {
    if (!userPhone) {
      toast.error('Telefone não configurado no perfil');
      return;
    }

    setIsSending(true);
    try {
      const listData = generateCollectorListData();
      
      await supabase.functions.invoke('send-whatsapp', {
        body: { phone: userPhone, listData },
      });
      
      toast.success('Comprovante enviado via WhatsApp!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      toast.error('Erro ao enviar comprovante');
    } finally {
      setIsSending(false);
    }
  };

  // Send to client - NOW USES LIST
  const handleSendToClient = async () => {
    if (!sale.client_phone) {
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
      const listData = generateClientListData();
      
      const { data: result, error } = await supabase.functions.invoke('send-whatsapp-to-client', {
        body: { 
          userId: user.id,
          clientPhone: sale.client_phone,
          listData 
        },
      });
      
      if (error) throw error;
      
      if (result?.success) {
        toast.success('Comprovante enviado para o cliente!');
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

  const handleClientButtonClick = () => {
    setShowSpamWarning(true);
  };

  const handleConfirmSendToClient = () => {
    setShowSpamWarning(false);
    handleSendToClient();
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const dates = installmentDates?.map(d => d.date) || [];
      
      await generateClientSaleReceipt({
        contractId: sale.id,
        companyName,
        customLogoUrl: profile?.company_logo_url,
        client: {
          name: sale.client_name,
          phone: sale.client_phone || undefined,
          cpf: sale.client_cpf || undefined,
          rg: sale.client_rg || undefined,
          email: sale.client_email || undefined,
          address: sale.client_address || undefined,
        },
        product: {
          name: sale.product_name,
          description: sale.product_description || undefined,
        },
        sale: {
          totalAmount: sale.total_amount,
          downPayment: sale.down_payment || 0,
          installments: sale.installments,
          installmentValue: sale.installment_value,
          saleDate: sale.sale_date,
        },
        dueDates: dates,
      });
      
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
    sale.client_phone;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Package className="w-5 h-5" />
              Venda Registrada!
            </DialogTitle>
            <DialogDescription>
              Deseja enviar comprovante ao cliente?
            </DialogDescription>
          </DialogHeader>

          {/* Sale summary preview - WITHOUT cost/profit */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{sale.client_name}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span>{sale.product_name}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span>Total: {formatCurrency(sale.total_amount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{sale.installments}x {formatCurrency(sale.installment_value)}</span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground italic">
                * Comprovante para o cliente não inclui informações de custo e lucro
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 mt-4">
            <Button 
              onClick={handleSendWhatsApp} 
              disabled={isSending || !userPhone}
              className="w-full"
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
            
            <Button 
              variant="outline" 
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="w-full"
            >
              <FileText className="w-4 h-4 mr-2" />
              {isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>
          </div>
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
