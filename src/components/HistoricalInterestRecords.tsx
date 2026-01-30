import { useMemo, useState } from 'react';
import { format, addMonths } from 'date-fns';
import { History, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, formatDate } from '@/lib/calculations';

interface HistoricalInstallment {
  index: number;
  date: string;
  interestAmount: number;
}

interface HistoricalInterestRecordsProps {
  startDate: string;
  paymentFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  principalAmount: number;
  interestRate: number;
  interestMode: 'per_installment' | 'on_total' | 'compound';
  dailyAmount?: number;
  selectedIndices: number[];
  onSelectionChange: (indices: number[]) => void;
  customInterestAmounts: Record<number, number>;
  onInterestChange: (index: number, amount: number) => void;
  maxInstallments?: number;
}

export function HistoricalInterestRecords({
  startDate,
  paymentFrequency,
  principalAmount,
  interestRate,
  interestMode,
  dailyAmount,
  selectedIndices,
  onSelectionChange,
  customInterestAmounts,
  onInterestChange,
  maxInstallments = 60,
}: HistoricalInterestRecordsProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Calculate past installments automatically based on start date and frequency
  const historicalData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Validate start date
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return { installments: [], defaultInterestPerInstallment: 0 };
    }
    
    const start = new Date(startDate + 'T12:00:00');
    if (isNaN(start.getTime()) || start >= today) {
      return { installments: [], defaultInterestPerInstallment: 0 };
    }
    
    if (principalAmount <= 0) {
      return { installments: [], defaultInterestPerInstallment: 0 };
    }
    
    // Generate installments from start date until today
    const installments: HistoricalInstallment[] = [];
    let currentDate = new Date(start);
    let index = 0;
    
    while (currentDate < today && index < maxInstallments) {
      installments.push({
        index,
        date: format(currentDate, 'yyyy-MM-dd'),
        interestAmount: 0, // Will be calculated below
      });
      
      // Advance to next installment based on frequency
      if (paymentFrequency === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (paymentFrequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (paymentFrequency === 'biweekly') {
        currentDate.setDate(currentDate.getDate() + 14);
      } else {
        // monthly
        currentDate = addMonths(currentDate, 1);
      }
      
      index++;
    }
    
    // Calculate default interest per installment
    let defaultInterestPerInstallment = 0;
    const numInstallments = installments.length;
    
    if (numInstallments === 0) {
      return { installments: [], defaultInterestPerInstallment: 0 };
    }
    
    const isDaily = paymentFrequency === 'daily';
    
    if (isDaily && dailyAmount) {
      // For daily loans: interest = daily_amount - (principal / installments)
      const principalPerInstallment = principalAmount / numInstallments;
      defaultInterestPerInstallment = dailyAmount - principalPerInstallment;
    } else {
      // For regular loans, calculate based on interest mode
      let totalInterest = 0;
      
      if (interestMode === 'per_installment') {
        totalInterest = principalAmount * (interestRate / 100) * numInstallments;
      } else if (interestMode === 'compound') {
        totalInterest = principalAmount * Math.pow(1 + (interestRate / 100), numInstallments) - principalAmount;
      } else {
        // on_total
        totalInterest = principalAmount * (interestRate / 100);
      }
      
      defaultInterestPerInstallment = totalInterest / numInstallments;
    }
    
    // Ensure positive interest
    defaultInterestPerInstallment = Math.max(0, defaultInterestPerInstallment);
    
    // Set interest amount for each installment
    installments.forEach(inst => {
      inst.interestAmount = defaultInterestPerInstallment;
    });
    
    return {
      installments,
      defaultInterestPerInstallment,
    };
  }, [startDate, paymentFrequency, principalAmount, interestRate, interestMode, dailyAmount, maxInstallments]);
  
  // Get effective interest for an installment (custom or default)
  const getInterestAmount = (index: number): number => {
    if (customInterestAmounts[index] !== undefined) {
      return customInterestAmounts[index];
    }
    return historicalData.defaultInterestPerInstallment;
  };
  
  // Calculate total selected interest
  const totalSelectedInterest = useMemo(() => {
    return selectedIndices.reduce((sum, idx) => sum + getInterestAmount(idx), 0);
  }, [selectedIndices, customInterestAmounts, historicalData.defaultInterestPerInstallment]);
  
  // Don't render if no past installments
  if (historicalData.installments.length === 0) {
    return null;
  }
  
  const handleSelectAll = () => {
    onSelectionChange(historicalData.installments.map(i => i.index));
  };
  
  const handleSelectNone = () => {
    onSelectionChange([]);
  };
  
  const handleToggle = (index: number, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIndices, index]);
    } else {
      onSelectionChange(selectedIndices.filter(i => i !== index));
    }
  };
  
  const handleEditStart = (index: number) => {
    setEditingIndex(index);
    setEditValue(getInterestAmount(index).toFixed(2));
  };
  
  const handleEditSave = (index: number) => {
    const value = parseFloat(editValue) || 0;
    onInterestChange(index, Math.max(0, value));
    setEditingIndex(null);
    setEditValue('');
  };
  
  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditValue('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      handleEditSave(index);
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };
  
  return (
    <div className="p-4 rounded-lg bg-purple-500/20 border border-purple-400/30 space-y-3">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <Label className="text-sm text-purple-200 flex items-center gap-2">
            <History className="h-4 w-4" />
            Registros Históricos de Juros
          </Label>
          <p className="text-xs text-purple-300/70">
            Este contrato possui {historicalData.installments.length} parcela(s) anterior(es) à data atual
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
            onClick={handleSelectAll}
          >
            Todas
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
            onClick={handleSelectNone}
          >
            Nenhuma
          </Button>
        </div>
      </div>
      
      <ScrollArea className="h-48">
        <div className="space-y-1 pr-2">
          {historicalData.installments.map((installment) => (
            <div 
              key={installment.index} 
              className="flex items-center gap-3 p-2 rounded hover:bg-purple-500/10 transition-colors"
            >
              <Checkbox
                checked={selectedIndices.includes(installment.index)}
                onCheckedChange={(checked) => handleToggle(installment.index, !!checked)}
                className="border-purple-400 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
              />
              <span className="text-sm text-purple-200 flex-1">
                Parcela {installment.index + 1} - {formatDate(installment.date)}
              </span>
              
              {editingIndex === installment.index ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-purple-300">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, installment.index)}
                    onBlur={() => handleEditSave(installment.index)}
                    autoFocus
                    className="w-24 h-7 text-sm bg-purple-500/20 border-purple-400/50 text-purple-100"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleEditStart(installment.index)}
                  className="flex items-center gap-1 text-sm text-purple-300 font-medium hover:text-purple-100 transition-colors group"
                >
                  <span>Juros: {formatCurrency(getInterestAmount(installment.index))}</span>
                  <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="p-3 rounded bg-purple-500/10 border border-purple-400/20 space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-sm text-purple-200 font-medium">
            Total de Juros Históricos:
          </p>
          <p className="text-lg font-bold text-purple-100">
            {formatCurrency(totalSelectedInterest)}
          </p>
        </div>
        <p className="text-xs text-purple-300/70">
          {selectedIndices.length} parcela(s) selecionada(s). Estes valores serão registrados como juros já recebidos 
          (o principal <span className="font-medium">não será alterado</span>).
        </p>
      </div>
    </div>
  );
}

export default HistoricalInterestRecords;
