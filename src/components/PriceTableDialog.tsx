import { useState, useEffect, useMemo } from 'react';
import { format, addMonths } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Table2, Calculator, Calendar as CalendarIcon, User, DollarSign, Percent, FileText, Plus, TrendingUp, TrendingDown, Wallet, Download } from 'lucide-react';
import { formatCurrency, formatDate, generatePriceTable, PriceTableRow } from '@/lib/calculations';
import { generatePriceTablePDF } from '@/lib/pdfGenerator';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

interface Client {
  id: string;
  full_name: string;
  phone?: string | null;
  client_type: string;
}

interface PriceTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onCreateLoan: (loanData: {
    client_id: string;
    principal_amount: number;
    interest_rate: number;
    interest_type: 'simple' | 'compound';
    interest_mode: 'compound';
    payment_type: 'installment';
    installments: number;
    contract_date: string;
    start_date: string;
    due_date: string;
    notes: string;
    installment_dates: string[];
    total_interest: number;
    send_notification: boolean;
  }) => Promise<{ data?: any; error?: any }>;
  onNewClientClick: () => void;
}

export default function PriceTableDialog({
  open,
  onOpenChange,
  clients,
  onCreateLoan,
  onNewClientClick,
}: PriceTableDialogProps) {
  const { profile } = useProfile();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    principal_amount: '',
    interest_rate: '',
    installments: '6',
    contract_date: format(new Date(), 'yyyy-MM-dd'),
    start_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    send_notification: false,
  });

  const loanClients = clients.filter(c => c.client_type === 'loan' || c.client_type === 'both');

  // Calculate Price table when values change
  const priceTableData = useMemo(() => {
    const principal = parseFloat(formData.principal_amount);
    const rate = parseFloat(formData.interest_rate);
    const installments = parseInt(formData.installments) || 1;

    if (!principal || principal <= 0 || !rate || rate <= 0 || installments <= 0) {
      return null;
    }

    return generatePriceTable(principal, rate, installments);
  }, [formData.principal_amount, formData.interest_rate, formData.installments]);

  // Generate installment dates
  const installmentDates = useMemo(() => {
    if (!formData.start_date) return [];
    
    const numInstallments = parseInt(formData.installments) || 1;
    const startDate = new Date(formData.start_date + 'T12:00:00');
    const startDay = startDate.getDate();
    const dates: string[] = [];
    
    for (let i = 0; i < numInstallments; i++) {
      // Usar addMonths do date-fns para evitar bugs na virada de ano/mês
      const date = addMonths(startDate, i);
      dates.push(format(date, 'yyyy-MM-dd'));
    }
    
    return dates;
  }, [formData.start_date, formData.installments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }

    if (!priceTableData) {
      toast.error('Preencha os valores corretamente');
      return;
    }

    const principal = parseFloat(formData.principal_amount);
    const rate = parseFloat(formData.interest_rate);
    const installments = parseInt(formData.installments);

    // Create notes with price table tag
    let notes = formData.notes || '';
    notes = `[PRICE_TABLE]\n${notes}`;

    const result = await onCreateLoan({
      client_id: formData.client_id,
      principal_amount: principal,
      interest_rate: rate,
      interest_type: 'compound',
      interest_mode: 'compound',
      payment_type: 'installment',
      installments: installments,
      contract_date: formData.contract_date,
      start_date: formData.start_date,
      due_date: installmentDates[installmentDates.length - 1] || formData.start_date,
      notes: notes.trim(),
      installment_dates: installmentDates,
      total_interest: priceTableData.totalInterest,
      send_notification: formData.send_notification,
    });

    // O Loans.tsx controla o fechamento do diálogo e abertura do prompt de comprovante
    // Reset do formulário após sucesso
    if (result.data) {
      setFormData({
        client_id: '',
        principal_amount: '',
        interest_rate: '',
        installments: '6',
        contract_date: format(new Date(), 'yyyy-MM-dd'),
        start_date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
        send_notification: false,
      });
    }
  };

  const handleExportPDF = async () => {
    if (!priceTableData) return;
    
    setIsGeneratingPDF(true);
    try {
      const selectedClient = clients.find(c => c.id === formData.client_id);
      
      await generatePriceTablePDF({
        companyName: profile?.company_name || profile?.full_name || undefined,
        customLogoUrl: profile?.company_logo_url,
        clientName: selectedClient?.full_name,
        principal: parseFloat(formData.principal_amount),
        interestRate: parseFloat(formData.interest_rate),
        installments: parseInt(formData.installments),
        pmt: priceTableData.pmt,
        rows: priceTableData.rows,
        totalPayment: priceTableData.totalPayment,
        totalInterest: priceTableData.totalInterest,
        installmentDates: installmentDates,
      });
      
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto mx-2 sm:mx-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-xl">
            <Table2 className="w-5 h-5 text-blue-600" />
            Novo Empréstimo - Tabela Price
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <User className="w-4 h-4" /> Cliente
            </Label>
            <div className="flex gap-2">
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
              >
                <SelectTrigger className="flex-1 h-10">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {loanClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={onNewClientClick}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Main Values */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Valor do Capital
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="2500.00"
                value={formData.principal_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, principal_amount: e.target.value }))}
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Percent className="w-4 h-4" /> Taxa Mensal (%)
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="20"
                value={formData.interest_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, interest_rate: e.target.value }))}
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Calculator className="w-4 h-4" /> Parcelas
              </Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={formData.installments}
                onChange={(e) => setFormData(prev => ({ ...prev, installments: e.target.value }))}
                className="h-10"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4" /> Data do Contrato
              </Label>
              <Input
                type="date"
                value={formData.contract_date}
                onChange={(e) => setFormData(prev => ({ ...prev, contract_date: e.target.value }))}
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4" /> 1ª Parcela
              </Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="h-10"
              />
            </div>
          </div>

          {/* Price Table Preview */}
          {priceTableData && (
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-4">
                {/* Summary Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Table2 className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">Prévia da Tabela Price</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="flex items-center gap-1">
                      <Wallet className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium text-foreground">Parcela: {formatCurrency(priceTableData.pmt)}</span>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleExportPDF}
                      disabled={isGeneratingPDF}
                      className="h-8"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      {isGeneratingPDF ? 'Gerando...' : 'Exportar PDF'}
                    </Button>
                  </div>
                </div>

                {/* Amortization Table */}
                <ScrollArea className="h-[200px] sm:h-[250px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">#</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Parcela</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                          <span className="hidden sm:inline">Amortização</span>
                          <span className="sm:hidden">Amort.</span>
                        </th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Juros</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground">Saldo</th>
                        <th className="px-2 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">Vencimento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {priceTableData.rows.map((row, index) => (
                        <tr key={row.installmentNumber} className="hover:bg-muted/30">
                          <td className="px-2 py-1.5 text-primary font-medium">{row.installmentNumber}</td>
                          <td className="px-2 py-1.5 text-right font-medium text-foreground">{formatCurrency(row.payment)}</td>
                          <td className="px-2 py-1.5 text-right text-emerald-500">
                            <span className="flex items-center justify-end gap-0.5">
                              <TrendingUp className="w-3 h-3 hidden sm:inline" />
                              {formatCurrency(row.amortization)}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right text-orange-500">
                            <span className="flex items-center justify-end gap-0.5">
                              <TrendingDown className="w-3 h-3 hidden sm:inline" />
                              {formatCurrency(row.interest)}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right text-foreground">{formatCurrency(row.balance)}</td>
                          <td className="px-2 py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                            {installmentDates[index] ? formatDate(installmentDates[index]) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>

                {/* Totals */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-3 border-t border-border">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      <span className="text-muted-foreground">Total a Receber:</span>
                      <span className="font-bold text-emerald-500">
                        {formatCurrency(priceTableData.totalPayment)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Juros Total:</span>
                    <span className="font-bold text-primary">
                      {formatCurrency(priceTableData.totalInterest)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Observações
            </Label>
            <Textarea
              placeholder="Notas sobre o empréstimo..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="min-h-[60px]"
            />
          </div>

          {/* WhatsApp Notification */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="send_notification"
              checked={formData.send_notification}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, send_notification: !!checked }))}
            />
            <Label htmlFor="send_notification" className="text-sm cursor-pointer">
              Enviar notificação WhatsApp ao criar
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="h-10 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!priceTableData}
            >
              <Table2 className="w-4 h-4 mr-1.5" />
              Criar Empréstimo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
