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
import { MessageCircle, FileText, X, Package, User, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateClientSaleReceipt } from '@/lib/pdfGenerator';
import { ProductSale } from '@/hooks/useProductSales';

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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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

  // Generate client-facing message (WITHOUT cost/profit)
  const generateClientMessage = () => {
    const contractId = `PRD-${sale.id.substring(0, 4).toUpperCase()}`;
    const downPayment = sale.down_payment || 0;
    
    let message = `📦 *COMPROVANTE DE VENDA*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    
    message += `👤 *Cliente:* ${sale.client_name}\n`;
    message += `📋 *Produto:* ${sale.product_name}\n\n`;
    
    message += `💰 *VALORES*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `💵 Valor Total: ${formatCurrency(sale.total_amount)}\n`;
    
    if (downPayment > 0) {
      message += `📥 Entrada: ${formatCurrency(downPayment)}\n`;
    }
    
    message += `📊 Parcelas: ${sale.installments}x de ${formatCurrency(sale.installment_value)}\n`;
    message += `📅 Primeira Parcela: ${formatDate(sale.first_due_date)}\n\n`;
    
    message += `📅 *VENCIMENTOS*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    
    // Show installment dates
    const dates = installmentDates || [];
    const maxDatesToShow = 6;
    dates.slice(0, maxDatesToShow).forEach((inst, index) => {
      message += `${index + 1}ª: ${formatDate(inst.date)}\n`;
    });
    
    if (dates.length > maxDatesToShow) {
      message += `... e mais ${dates.length - maxDatesToShow} parcela(s)\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━\n`;
    message += `_${companyName} - ${contractId}_`;
    
    return message;
  };

  const handleSendWhatsApp = async () => {
    if (!userPhone) {
      toast.error('Telefone não configurado no perfil');
      return;
    }

    setIsSending(true);
    try {
      const message = generateClientMessage();
      
      await supabase.functions.invoke('send-whatsapp', {
        body: { phone: userPhone, message },
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

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const dates = installmentDates?.map(d => d.date) || [];
      
      await generateClientSaleReceipt({
        contractId: sale.id,
        companyName,
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

  return (
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
            <MessageCircle className="w-4 h-4 mr-2" />
            {isSending ? 'Enviando...' : 'Enviar via WhatsApp'}
          </Button>
          
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
  );
}
