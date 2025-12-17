import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/calculations';

interface AddExtraInstallmentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  loan: {
    id: string;
    installments: number;
    installment_dates: string[];
    total_interest: number; // valor da parcela diária
    principal_amount: number;
    client?: { full_name?: string };
  };
  onConfirm: (loanId: string, extraCount: number, newDates: string[]) => Promise<any>;
}

// Gera datas extras pulando domingos
function generateExtraDailyDates(existingDates: string[], extraCount: number): string[] {
  if (existingDates.length === 0) return [];
  
  const lastDate = new Date(existingDates[existingDates.length - 1] + 'T12:00:00');
  const newDates: string[] = [];
  
  let currentDate = new Date(lastDate);
  for (let i = 0; i < extraCount; i++) {
    currentDate.setDate(currentDate.getDate() + 1);
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    newDates.push(`${year}-${month}-${day}`);
  }
  
  return newDates;
}

export default function AddExtraInstallmentsDialog({
  isOpen,
  onClose,
  loan,
  onConfirm,
}: AddExtraInstallmentsDialogProps) {
  const [extraCount, setExtraCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const existingDates = loan.installment_dates || [];
  const newDates = generateExtraDailyDates(existingDates, extraCount);
  const dailyAmount = loan.total_interest || 0;
  const totalExtraValue = dailyAmount * extraCount;
  
  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(loan.id, extraCount, newDates);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleIncrement = () => {
    if (extraCount < 30) setExtraCount(extraCount + 1);
  };
  
  const handleDecrement = () => {
    if (extraCount > 1) setExtraCount(extraCount - 1);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Adicionar Parcelas Extras
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Cliente */}
          <div className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{loan.client?.full_name || 'Cliente'}</span>
          </div>
          
          {/* Seletor de quantidade */}
          <div className="space-y-2">
            <Label>Quantas parcelas extras adicionar?</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleDecrement}
                disabled={extraCount <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                min={1}
                max={30}
                value={extraCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= 30) setExtraCount(val);
                }}
                className="w-20 text-center text-lg font-semibold"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleIncrement}
                disabled={extraCount >= 30}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">parcela(s)</span>
            </div>
          </div>
          
          {/* Preview das novas datas */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Novas datas que serão adicionadas:
            </Label>
            <div className="bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
              {newDates.map((date, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Parcela {loan.installments + idx + 1}
                  </span>
                  <span className="font-medium">{formatDate(date)}</span>
                  <span className="text-primary font-semibold">{formatCurrency(dailyAmount)}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Resumo */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Valor por parcela:</span>
              <span className="font-semibold">{formatCurrency(dailyAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total extras ({extraCount}x):</span>
              <span className="font-semibold text-primary">{formatCurrency(totalExtraValue)}</span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-primary/20">
              <span>Novo total de parcelas:</span>
              <span className="font-bold">{loan.installments + extraCount} parcelas</span>
            </div>
          </div>
          
          {/* Aviso */}
          <p className="text-xs text-muted-foreground">
            ⚠️ O cliente terá {extraCount} dia(s) extra(s) para pagar. 
            O saldo devedor será aumentado em {formatCurrency(totalExtraValue)}.
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? 'Adicionando...' : 'Adicionar Parcelas'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
