import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, X, MessageCircle, Loader2 } from 'lucide-react';
import { generateContractReceipt, ContractReceiptData } from '@/lib/pdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

interface ReceiptPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ContractReceiptData | null;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
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

const getContractTypeName = (type: 'loan' | 'product' | 'vehicle' | 'contract'): string => {
  switch (type) {
    case 'loan': return 'EMPRÉSTIMO';
    case 'product': return 'VENDA DE PRODUTO';
    case 'vehicle': return 'VENDA DE VEÍCULO';
    case 'contract': return 'CONTRATO';
    default: return 'DOCUMENTO';
  }
};

const generateWhatsAppMessage = (data: ContractReceiptData): string => {
  const prefix = getContractPrefix(data.type);
  const typeName = getContractTypeName(data.type);
  const contractNumber = `${prefix}-${data.contractId.substring(0, 8).toUpperCase()}`;
  
  let message = `📄 *COMPROVANTE DE ${typeName}*\n`;
  message += `━━━━━━━━━━━━━━━━\n\n`;
  message += `📋 *Contrato:* ${contractNumber}\n`;
  message += `👤 *Cliente:* ${data.client.name}\n`;
  
  if (data.client.cpf) {
    message += `🪪 *CPF:* ${data.client.cpf}\n`;
  }
  
  message += `\n💰 *DADOS DA NEGOCIAÇÃO*\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `💵 ${data.type === 'loan' ? 'Valor Emprestado' : 'Valor Total'}: ${formatCurrency(data.negotiation.principal)}\n`;
  
  if (data.type === 'loan' && data.negotiation.interestRate !== undefined) {
    message += `📈 Taxa de Juros: ${data.negotiation.interestRate.toFixed(2)}%\n`;
  }
  
  message += `📊 Parcelas: ${data.negotiation.installments}x de ${formatCurrency(data.negotiation.installmentValue)}\n`;
  message += `📅 Início: ${formatDate(data.negotiation.startDate)}\n`;
  message += `\n✅ *TOTAL A RECEBER: ${formatCurrency(data.negotiation.totalToReceive)}*\n`;
  
  if (data.type === 'vehicle' && data.vehicleInfo) {
    message += `\n🚗 *VEÍCULO*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `${data.vehicleInfo.brand} ${data.vehicleInfo.model} ${data.vehicleInfo.year}\n`;
    if (data.vehicleInfo.plate) {
      message += `Placa: ${data.vehicleInfo.plate}\n`;
    }
  }
  
  if (data.type === 'product' && data.productInfo) {
    message += `\n📦 *PRODUTO*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `${data.productInfo.name}\n`;
  }
  
  if (data.dueDates.length > 0) {
    message += `\n📅 *VENCIMENTOS*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    const maxDates = Math.min(data.dueDates.length, 6);
    for (let i = 0; i < maxDates; i++) {
      message += `${i + 1}ª parcela: ${formatDate(data.dueDates[i])}\n`;
    }
    if (data.dueDates.length > 6) {
      message += `... e mais ${data.dueDates.length - 6} parcela(s)\n`;
    }
  }
  
  message += `\n━━━━━━━━━━━━━━━━\n`;
  message += `_${data.companyName || 'CobraFácil'}_\n`;
  message += `_Sistema de Gestão de Cobranças_`;
  
  return message;
};

export default function ReceiptPreviewDialog({ open, onOpenChange, data }: ReceiptPreviewDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const { profile } = useProfile();

  if (!data) return null;

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

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await generateContractReceipt(data);
      toast.success('Comprovante baixado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Erro ao gerar comprovante');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="bg-primary text-primary-foreground p-4">
          <DialogTitle className="text-center">Pré-visualização do Comprovante</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[55vh]">
          <div className="p-4 space-y-4">
            {/* Header Preview */}
            <div className="bg-primary rounded-lg p-4 text-primary-foreground text-center">
              <h3 className="font-bold text-lg">CobraFácil</h3>
              {data.companyName && <p className="text-sm opacity-90">{data.companyName}</p>}
            </div>

            {/* Document Title */}
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <h4 className="font-bold text-primary">COMPROVANTE DE {getContractTypeName(data.type)}</h4>
              <p className="text-sm text-muted-foreground">
                Nº: {getContractPrefix(data.type)}-{data.contractId.substring(0, 8).toUpperCase()}
              </p>
            </div>

            {/* Client Data */}
            <div className="border border-primary/30 rounded-lg p-3 space-y-2">
              <h5 className="font-semibold text-primary text-sm">DADOS DO CLIENTE</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium">{data.client.name}</p>
                </div>
                {data.client.phone && (
                  <div>
                    <span className="text-muted-foreground">Telefone:</span>
                    <p className="font-medium">{data.client.phone}</p>
                  </div>
                )}
                {data.client.cpf && (
                  <div>
                    <span className="text-muted-foreground">CPF:</span>
                    <p className="font-medium">{data.client.cpf}</p>
                  </div>
                )}
                {data.client.rg && (
                  <div>
                    <span className="text-muted-foreground">RG:</span>
                    <p className="font-medium">{data.client.rg}</p>
                  </div>
                )}
              </div>
              {data.client.address && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Endereço:</span>
                  <p className="font-medium">{data.client.address}</p>
                </div>
              )}
            </div>

            {/* Vehicle Info */}
            {data.type === 'vehicle' && data.vehicleInfo && (
              <div className="border border-primary/30 rounded-lg p-3 space-y-2">
                <h5 className="font-semibold text-primary text-sm">DADOS DO VEÍCULO</h5>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Veículo:</span>
                    <p className="font-medium">{data.vehicleInfo.brand} {data.vehicleInfo.model} {data.vehicleInfo.year}</p>
                  </div>
                  {data.vehicleInfo.plate && (
                    <div>
                      <span className="text-muted-foreground">Placa:</span>
                      <p className="font-medium font-mono">{data.vehicleInfo.plate}</p>
                    </div>
                  )}
                  {data.vehicleInfo.color && (
                    <div>
                      <span className="text-muted-foreground">Cor:</span>
                      <p className="font-medium">{data.vehicleInfo.color}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Product Info */}
            {data.type === 'product' && data.productInfo && (
              <div className="border border-primary/30 rounded-lg p-3">
                <h5 className="font-semibold text-primary text-sm">PRODUTO</h5>
                <p className="font-medium">{data.productInfo.name}</p>
                {data.productInfo.description && (
                  <p className="text-sm text-muted-foreground">{data.productInfo.description}</p>
                )}
              </div>
            )}

            {/* Negotiation Data */}
            <div className="border border-primary/30 rounded-lg p-3 space-y-2">
              <h5 className="font-semibold text-primary text-sm">DADOS DA NEGOCIAÇÃO</h5>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{data.type === 'loan' ? 'Valor Emprestado:' : 'Valor Total:'}</span>
                  <p className="font-medium">{formatCurrency(data.negotiation.principal)}</p>
                </div>
                {data.negotiation.interestRate !== undefined && data.type === 'loan' && (
                  <div>
                    <span className="text-muted-foreground">Taxa de Juros:</span>
                    <p className="font-medium">{data.negotiation.interestRate.toFixed(2)}%</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Parcelas:</span>
                  <p className="font-medium">{data.negotiation.installments}x de {formatCurrency(data.negotiation.installmentValue)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Início:</span>
                  <p className="font-medium">{formatDate(data.negotiation.startDate)}</p>
                </div>
              </div>
              
              <div className="bg-primary/10 rounded-lg p-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-primary">Total a Receber:</span>
                  <span className="font-bold text-primary text-lg">{formatCurrency(data.negotiation.totalToReceive)}</span>
                </div>
              </div>
            </div>

            {/* Due Dates */}
            {data.dueDates.length > 0 && (
              <div className="bg-primary/5 rounded-lg p-3">
                <h5 className="font-semibold text-primary text-sm mb-2">DATAS DE VENCIMENTO</h5>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {data.dueDates.slice(0, 9).map((date, index) => (
                    <div key={index} className="bg-background rounded p-1 text-center">
                      <span className="font-medium">{index + 1}ª:</span> {formatDate(date)}
                    </div>
                  ))}
                  {data.dueDates.length > 9 && (
                    <div className="col-span-3 text-center text-muted-foreground">
                      ... e mais {data.dueDates.length - 9} parcela(s)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Signatures placeholder */}
            <div className="flex justify-between px-4 pt-4">
              <div className="text-center">
                <div className="border-t border-muted-foreground/50 w-24 mb-1"></div>
                <span className="text-xs text-muted-foreground">Assin. Cliente</span>
              </div>
              <div className="text-center">
                <div className="border-t border-muted-foreground/50 w-24 mb-1"></div>
                <span className="text-xs text-muted-foreground">Assin. Empresa</span>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-primary rounded-lg p-2 text-primary-foreground text-center text-xs">
              CobraFácil - Sistema de Gestão de Cobranças
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSendWhatsApp} 
            disabled={isSendingWhatsApp}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
          >
            {isSendingWhatsApp ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4 mr-2" />
            )}
            {isSendingWhatsApp ? 'Enviando...' : 'Enviar p/ meu WhatsApp'}
          </Button>
          <Button onClick={handleDownload} disabled={isGenerating} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            {isGenerating ? 'Gerando...' : 'Baixar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
