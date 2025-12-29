import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { CreateVehicleData, InstallmentDate, Vehicle, VehiclePayment } from '@/hooks/useVehicles';
import { addMonths, format, setDate, getDate, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClientSelector, formatFullAddress } from '@/components/ClientSelector';
import { Client } from '@/types/database';

interface VehicleFormProps {
  billType: 'receivable' | 'payable';
  onSubmit: (data: CreateVehicleData) => Promise<void>;
  isPending: boolean;
  initialData?: Vehicle;
  existingPayments?: VehiclePayment[];
  isEditing?: boolean;
}

// Subcomponente para lista de parcelas com scroll automático
function InstallmentsList({
  installmentDates,
  isHistorical,
  isEditing,
  today,
  updateInstallmentDate,
  toggleInstallmentPaid,
}: {
  installmentDates: InstallmentDate[];
  isHistorical: boolean;
  isEditing?: boolean;
  today: Date;
  updateInstallmentDate: (index: number, field: 'due_date' | 'amount', value: string | number) => void;
  toggleInstallmentPaid: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstUnpaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Se for contrato histórico ou editando, rolar para primeira parcela não paga
    if ((isHistorical || isEditing) && firstUnpaidRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = firstUnpaidRef.current;
      const offsetTop = element.offsetTop - container.offsetTop;
      container.scrollTop = Math.max(0, offsetTop - 10);
    }
  }, [isHistorical, isEditing, installmentDates]);

  // Encontrar índice da primeira parcela não paga
  const firstUnpaidIndex = installmentDates.findIndex(inst => !inst.isPaid);

  return (
    <Card className="mt-3">
      <CardContent className="p-3">
        <div
          ref={scrollRef}
          className="h-[180px] overflow-y-auto space-y-2 pr-1"
          style={{ scrollBehavior: 'smooth' }}
        >
          {installmentDates.map((inst, index) => {
            const instDate = new Date(inst.due_date);
            instDate.setHours(0, 0, 0, 0);
            const isPastDate = instDate < today;
            const showPaidCheckbox = isEditing || (isHistorical && isPastDate);
            const isFirstUnpaid = index === firstUnpaidIndex;

            return (
              <div
                key={index}
                ref={isFirstUnpaid ? firstUnpaidRef : undefined}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg",
                  inst.isPaid ? "bg-primary/10 border border-primary/30" : "bg-background border border-border"
                )}
              >
                <span
                  className={cn(
                    "font-semibold text-sm w-8",
                    inst.isPaid && "text-primary"
                  )}
                >
                  {inst.installment_number}ª
                </span>
                <Input
                  type="date"
                  value={inst.due_date}
                  onChange={(e) => updateInstallmentDate(index, 'due_date', e.target.value)}
                  className="flex-1 h-10 text-sm touch-manipulation"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={inst.amount}
                    onChange={(e) =>
                      updateInstallmentDate(index, 'amount', parseFloat(e.target.value) || 0)
                    }
                    className="w-24 h-8 text-sm"
                  />
                </div>
                {showPaidCheckbox && (
                  <Button
                    type="button"
                    variant={inst.isPaid ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => toggleInstallmentPaid(index)}
                  >
                    {inst.isPaid ? '✓ Paga' : 'Marcar'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Você pode editar a data e valor de cada parcela individualmente
        </p>
      </CardContent>
    </Card>
  );
}

export function VehicleForm({ billType, onSubmit, isPending, initialData, existingPayments, isEditing }: VehicleFormProps) {
  const [showInstallments, setShowInstallments] = useState(isEditing || false);
  const [installmentDates, setInstallmentDates] = useState<InstallmentDate[]>([]);
  const [isHistorical, setIsHistorical] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  const [form, setForm] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    plate: '',
    chassis: '',
    seller_name: '',
    buyer_name: '',
    buyer_phone: '',
    buyer_email: '',
    buyer_cpf: '',
    buyer_rg: '',
    buyer_address: '',
    purchase_date: '',
    cost_value: 0,
    purchase_value: 0,
    down_payment: 0,
    installments: 12,
    installment_value: 0,
    first_due_date: '',
    notes: '',
    send_creation_notification: false,
  });

  // Initialize form with existing data when editing
  useEffect(() => {
    if (isEditing && initialData && !initialized) {
      setForm({
        brand: initialData.brand || '',
        model: initialData.model || '',
        year: initialData.year || new Date().getFullYear(),
        color: initialData.color || '',
        plate: initialData.plate || '',
        chassis: initialData.chassis || '',
        seller_name: initialData.seller_name || '',
        buyer_name: initialData.buyer_name || '',
        buyer_phone: initialData.buyer_phone || '',
        buyer_email: initialData.buyer_email || '',
        buyer_cpf: initialData.buyer_cpf || '',
        buyer_rg: initialData.buyer_rg || '',
        buyer_address: initialData.buyer_address || '',
        purchase_date: initialData.purchase_date || '',
        cost_value: initialData.cost_value || 0,
        purchase_value: initialData.purchase_value || 0,
        down_payment: initialData.down_payment || 0,
        installments: initialData.installments || 12,
        installment_value: initialData.installment_value || 0,
        first_due_date: initialData.first_due_date || '',
        notes: initialData.notes || '',
        send_creation_notification: false,
      });

      // Initialize installment dates from existing payments
      if (existingPayments && existingPayments.length > 0) {
        const sortedPayments = [...existingPayments].sort((a, b) => a.installment_number - b.installment_number);
        const dates: InstallmentDate[] = sortedPayments.map(p => ({
          installment_number: p.installment_number,
          due_date: p.due_date,
          amount: p.amount,
          isPaid: p.status === 'paid',
        }));
        setInstallmentDates(dates);
      }

      setInitialized(true);
    }
  }, [isEditing, initialData, existingPayments, initialized]);

  // Handler for client selection
  const handleClientSelect = (client: Client | null) => {
    if (client) {
      setSelectedClientId(client.id);
      setForm(prev => ({
        ...prev,
        buyer_name: client.full_name,
        buyer_phone: client.phone || '',
        buyer_cpf: client.cpf || '',
        buyer_rg: client.rg || '',
        buyer_email: client.email || '',
        buyer_address: formatFullAddress(client),
      }));
    } else {
      setSelectedClientId(null);
    }
  };

  // Generate installment dates when relevant fields change (only for new vehicles)
  useEffect(() => {
    // Skip auto-generation if editing and already initialized with existing payments
    if (isEditing && initialized && existingPayments && existingPayments.length > 0) {
      return;
    }
    
    if (form.first_due_date && form.installments > 0 && form.installment_value > 0) {
      const firstDate = parseISO(form.first_due_date);
      const dayOfMonth = getDate(firstDate);
      
      const dates: InstallmentDate[] = [];
      for (let i = 0; i < form.installments; i++) {
        let dueDate = addMonths(firstDate, i);
        // Keep the same day of month
        try {
          dueDate = setDate(dueDate, dayOfMonth);
        } catch {
          // If day doesn't exist in month (e.g., 31 in Feb), use last day
          dueDate = addMonths(firstDate, i);
        }
        
        dates.push({
          installment_number: i + 1,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          amount: form.installment_value,
        });
      }
      setInstallmentDates(dates);
    }
  }, [form.first_due_date, form.installments, form.installment_value, isEditing, initialized, existingPayments]);

  const updateInstallmentDate = (index: number, field: 'due_date' | 'amount', value: string | number) => {
    setInstallmentDates(prev => {
      const updated = [...prev];
      if (field === 'due_date') {
        updated[index] = { ...updated[index], due_date: value as string };
      } else {
        updated[index] = { ...updated[index], amount: value as number };
      }
      return updated;
    });
  };
  
  const toggleInstallmentPaid = (index: number) => {
    setInstallmentDates(prev => 
      prev.map((item, i) => i === index ? { ...item, isPaid: !item.isPaid } : item)
    );
  };
  
  // Check if there are past installments
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasPastInstallments = installmentDates.some(inst => {
    const instDate = new Date(inst.due_date);
    instDate.setHours(0, 0, 0, 0);
    return instDate < today;
  });
  
  const paidHistoricalCount = installmentDates.filter(inst => inst.isPaid).length;
  const paidHistoricalAmount = installmentDates.filter(inst => inst.isPaid).reduce((sum, inst) => sum + inst.amount, 0);

  const handlePurchaseValueChange = (value: number) => {
    const downPayment = form.down_payment || 0;
    const remaining = value - downPayment;
    const installmentValue = form.installments > 0 ? remaining / form.installments : 0;
    setForm({ ...form, purchase_value: value, installment_value: installmentValue });
  };

  const handleDownPaymentChange = (downPayment: number) => {
    const remaining = form.purchase_value - downPayment;
    const installmentValue = form.installments > 0 ? remaining / form.installments : 0;
    setForm({ ...form, down_payment: downPayment, installment_value: installmentValue });
  };

  const handleInstallmentsChange = (installments: number) => {
    const remaining = form.purchase_value - (form.down_payment || 0);
    const installmentValue = installments > 0 ? remaining / installments : 0;
    setForm({ ...form, installments, installment_value: installmentValue });
  };

  const handleSubmit = async () => {
    const requiredBuyer = billType === 'receivable' ? form.buyer_name : form.seller_name;
    if (!form.brand || !form.model || !requiredBuyer || !form.purchase_value || !form.first_due_date) return;
    
    await onSubmit({
      ...form,
      custom_installments: installmentDates.length > 0 ? installmentDates : undefined,
      send_creation_notification: form.send_creation_notification,
      is_historical: isHistorical,
    });
  };

  const isReceivable = billType === 'receivable';
  const primaryColor = isReceivable ? 'text-primary' : 'text-blue-600';
  const bgColor = isReceivable ? 'bg-primary/10' : 'bg-blue-500/10';

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Marca *</Label>
          <Input placeholder="Ex: Honda, Toyota..." value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Modelo *</Label>
          <Input placeholder="Ex: Civic, Corolla..." value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Ano *</Label>
          <Input type="number" min="1900" max="2030" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })} />
        </div>
        <div className="space-y-2">
          <Label>Cor</Label>
          <Input placeholder="Ex: Preto, Branco..." value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Placa</Label>
          <Input placeholder="ABC-1234" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Chassis</Label>
        <Input placeholder="Número do chassis" value={form.chassis} onChange={(e) => setForm({ ...form, chassis: e.target.value })} />
      </div>
      
      <div className="border-t pt-4">
        <h4 className={cn("font-semibold mb-3", primaryColor)}>
          {isReceivable ? 'Dados da Venda' : 'Dados da Compra'}
        </h4>
        
        {/* Client Selector - only for receivable (sale) */}
        {isReceivable && (
          <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5 mb-4">
            <Label className="text-primary font-medium">👤 Usar cliente cadastrado</Label>
            <ClientSelector
              onSelect={handleClientSelect}
              selectedClientId={selectedClientId}
              placeholder="Selecionar comprador..."
            />
            <p className="text-xs text-muted-foreground">
              Selecione um cliente para preencher os dados do comprador automaticamente.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{isReceivable ? 'Vendido para (Comprador) *' : 'Vendedor (Comprado de) *'}</Label>
            <Input 
              placeholder={isReceivable ? "Nome do comprador" : "Nome do vendedor"} 
              value={isReceivable ? form.buyer_name : form.seller_name} 
              onChange={(e) => isReceivable 
                ? setForm({ ...form, buyer_name: e.target.value })
                : setForm({ ...form, seller_name: e.target.value })
              } 
            />
          </div>
          <div className="space-y-2">
            <Label>{isReceivable ? 'Origem (Comprado de)' : 'Comprador (Vendido para)'}</Label>
            <Input 
              placeholder={isReceivable ? "Nome do vendedor original" : "Nome do comprador"} 
              value={isReceivable ? form.seller_name : form.buyer_name} 
              onChange={(e) => isReceivable 
                ? setForm({ ...form, seller_name: e.target.value })
                : setForm({ ...form, buyer_name: e.target.value })
              } 
            />
          </div>
        </div>
        
        {/* Contact fields */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Telefone do {isReceivable ? 'comprador' : 'vendedor'}</Label>
            <Input 
              placeholder="(00) 00000-0000" 
              value={form.buyer_phone} 
              onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail do {isReceivable ? 'comprador' : 'vendedor'}</Label>
            <Input 
              type="email"
              placeholder="email@exemplo.com" 
              value={form.buyer_email} 
              onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} 
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input 
              placeholder="000.000.000-00" 
              value={form.buyer_cpf} 
              onChange={(e) => setForm({ ...form, buyer_cpf: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <Label>RG</Label>
            <Input 
              placeholder="00.000.000-0" 
              value={form.buyer_rg} 
              onChange={(e) => setForm({ ...form, buyer_rg: e.target.value })} 
            />
          </div>
        </div>
        <div className="space-y-2 mt-4">
          <Label>Endereço</Label>
          <Input 
            placeholder="Rua, número, bairro, cidade..." 
            value={form.buyer_address} 
            onChange={(e) => setForm({ ...form, buyer_address: e.target.value })} 
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Data da {isReceivable ? 'venda' : 'compra'}</Label>
            <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Custo de aquisição (R$)</Label>
            <Input type="number" step="0.01" min="0" placeholder="Quanto você pagou" value={form.cost_value || ''} onChange={(e) => setForm({ ...form, cost_value: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Valor de venda (R$) *</Label>
            <Input type="number" step="0.01" min="0" placeholder="Quanto está vendendo" value={form.purchase_value || ''} onChange={(e) => handlePurchaseValueChange(parseFloat(e.target.value) || 0)} />
          </div>
          {form.cost_value > 0 && form.purchase_value > 0 && (
            <div className="space-y-2">
              <Label>Lucro estimado</Label>
              <div className={cn("h-10 px-3 py-2 rounded-md border flex items-center font-bold", 
                form.purchase_value - form.cost_value >= 0 ? "bg-primary/10 text-primary border-primary/30" : "bg-destructive/10 text-destructive border-destructive/30"
              )}>
                R$ {(form.purchase_value - form.cost_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                <span className="ml-2 text-xs font-normal">
                  ({form.cost_value > 0 ? (((form.purchase_value - form.cost_value) / form.cost_value) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className={cn("font-semibold mb-3", primaryColor)}>Parcelamento</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Entrada (R$)</Label>
            <Input type="number" step="0.01" min="0" value={form.down_payment || ''} onChange={(e) => handleDownPaymentChange(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Nº de parcelas *</Label>
            <Input type="number" min="1" value={form.installments || ''} onChange={(e) => handleInstallmentsChange(parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Valor da parcela *</Label>
            <Input type="number" step="0.01" min="0" value={form.installment_value || ''} onChange={(e) => setForm({ ...form, installment_value: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label>Primeiro vencimento *</Label>
          <Input type="date" value={form.first_due_date} onChange={(e) => setForm({ ...form, first_due_date: e.target.value })} />
          <p className="text-xs text-muted-foreground">As demais parcelas serão geradas no mesmo dia do mês</p>
        </div>
      </div>

      {/* Historical Contract Checkbox - only show when creating, not editing */}
      {!isEditing && hasPastInstallments && installmentDates.length > 0 && (
        <div className="p-3 rounded-lg border border-amber-500/50 bg-amber-500/10 space-y-3">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="is_historical_vehicle"
              checked={isHistorical}
              onChange={(e) => setIsHistorical(e.target.checked)}
              className="mt-0.5 rounded border-input"
            />
            <div className="flex-1">
              <label htmlFor="is_historical_vehicle" className="text-sm font-medium cursor-pointer text-amber-600">
                É uma venda antiga que está registrando na plataforma?
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Marque as parcelas que já foram pagas antes de registrar na plataforma
              </p>
            </div>
          </div>
          
          {isHistorical && paidHistoricalCount > 0 && (
            <div className="p-2 rounded bg-primary/10 border border-primary/30">
              <p className="text-sm text-primary font-medium">
                {paidHistoricalCount} parcela(s) marcada(s) como paga(s) = R$ {paidHistoricalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Edit mode summary of paid installments */}
      {isEditing && paidHistoricalCount > 0 && (
        <div className="p-2 rounded bg-primary/10 border border-primary/30">
          <p className="text-sm text-primary font-medium">
            {paidHistoricalCount} parcela(s) paga(s) = R$ {paidHistoricalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      {/* Installments List */}
      {installmentDates.length > 0 && (
        <div className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={() => setShowInstallments(!showInstallments)}
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Ver/Editar Parcelas ({installmentDates.length})
            </span>
            {showInstallments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          
          {showInstallments && (
            <InstallmentsList
              installmentDates={installmentDates}
              isHistorical={isHistorical}
              isEditing={isEditing}
              today={today}
              updateInstallmentDate={updateInstallmentDate}
              toggleInstallmentPaid={toggleInstallmentPaid}
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea placeholder="Notas adicionais sobre o veículo..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      {form.purchase_value > 0 && (
        <div className={cn("p-3 rounded-lg", bgColor)}>
          <p className="text-sm text-muted-foreground">Resumo:</p>
          {form.cost_value > 0 && (
            <div className="flex justify-between mt-1">
              <span>Custo:</span>
              <span className="font-semibold">R$ {form.cost_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between mt-1">
            <span>Valor de venda:</span>
            <span className="font-bold">R$ {form.purchase_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          {form.cost_value > 0 && (
            <div className={cn("flex justify-between mt-1 p-2 rounded", form.purchase_value - form.cost_value >= 0 ? "bg-primary/20" : "bg-destructive/20")}>
              <span>Lucro:</span>
              <span className={cn("font-bold", form.purchase_value - form.cost_value >= 0 ? "text-primary" : "text-destructive")}>
                R$ {(form.purchase_value - form.cost_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({form.cost_value > 0 ? (((form.purchase_value - form.cost_value) / form.cost_value) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Entrada:</span>
            <span className="font-semibold">R$ {(form.down_payment || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span>A {isReceivable ? 'receber' : 'pagar'}:</span>
            <span className="font-semibold">R$ {(form.purchase_value - (form.down_payment || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className={cn("flex justify-between font-bold", primaryColor)}>
            <span>{form.installments}x de:</span>
            <span>R$ {form.installment_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {/* WhatsApp Notification Option */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-muted/30">
        <input
          type="checkbox"
          id="send_creation_notification_vehicle"
          checked={form.send_creation_notification}
          onChange={(e) => setForm({ ...form, send_creation_notification: e.target.checked })}
          className="mt-0.5 rounded border-input"
        />
        <div className="flex-1">
          <label htmlFor="send_creation_notification_vehicle" className="text-sm font-medium cursor-pointer">
            Receber notificação WhatsApp deste contrato
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Alertas de atraso e relatórios serão enviados normalmente mesmo que você não marque essa opção
          </p>
        </div>
      </div>

      <Button 
        onClick={handleSubmit} 
        disabled={
          !form.brand || 
          !form.model || 
          !(isReceivable ? form.buyer_name : form.seller_name) || 
          !form.purchase_value || 
          !form.first_due_date || 
          isPending
        } 
        className={cn("w-full", !isReceivable && "bg-blue-600 hover:bg-blue-700")}
      >
        {isPending ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Veículo'}
      </Button>
    </div>
  );
}
