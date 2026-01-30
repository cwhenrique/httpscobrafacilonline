import { useMemo } from 'react';
import { format } from 'date-fns';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency, formatDate } from '@/lib/calculations';

interface HistoricalInstallment {
  index: number;
  date: string;
  interestAmount: number;
}

interface HistoricalInterestRecordsProps {
  installmentDates: string[];
  principalAmount: number;
  interestRate: number;
  interestMode: 'per_installment' | 'on_total' | 'compound';
  paymentType: string;
  dailyAmount?: number;
  selectedIndices: number[];
  onSelectionChange: (indices: number[]) => void;
  maxInstallments?: number;
}

export function HistoricalInterestRecords({
  installmentDates,
  principalAmount,
  interestRate,
  interestMode,
  paymentType,
  dailyAmount,
  selectedIndices,
  onSelectionChange,
  maxInstallments = 60,
}: HistoricalInterestRecordsProps) {
  // Calculate past installments with interest amounts
  const historicalData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const numInstallments = installmentDates.length;
    if (numInstallments === 0 || principalAmount <= 0) {
      return { installments: [], totalInterest: 0, interestPerInstallment: 0 };
    }
    
    // Filter dates in the past
    const pastDates = installmentDates.filter(d => {
      const date = new Date(d + 'T12:00:00');
      return date < today;
    });
    
    // Limit to maxInstallments for performance
    const limitedPastDates = pastDates.slice(0, maxInstallments);
    
    // Calculate interest per installment based on loan type
    let interestPerInstallment = 0;
    
    const isDaily = paymentType === 'daily';
    
    if (isDaily && dailyAmount) {
      // For daily loans: interest = daily_amount - (principal / installments)
      const principalPerInstallment = principalAmount / numInstallments;
      interestPerInstallment = dailyAmount - principalPerInstallment;
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
      
      interestPerInstallment = totalInterest / numInstallments;
    }
    
    // Ensure positive interest
    interestPerInstallment = Math.max(0, interestPerInstallment);
    
    // Build installment list
    const installments: HistoricalInstallment[] = limitedPastDates.map((date) => {
      const originalIndex = installmentDates.indexOf(date);
      return {
        index: originalIndex >= 0 ? originalIndex : 0,
        date,
        interestAmount: interestPerInstallment,
      };
    });
    
    // Calculate total selected interest
    const selectedTotal = selectedIndices.length * interestPerInstallment;
    
    return {
      installments,
      totalInterest: selectedTotal,
      interestPerInstallment,
    };
  }, [installmentDates, principalAmount, interestRate, interestMode, paymentType, dailyAmount, selectedIndices, maxInstallments]);
  
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
            <label 
              key={installment.index} 
              className="flex items-center gap-3 p-2 rounded hover:bg-purple-500/10 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedIndices.includes(installment.index)}
                onCheckedChange={(checked) => handleToggle(installment.index, !!checked)}
                className="border-purple-400 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
              />
              <span className="text-sm text-purple-200 flex-1">
                Parcela {installment.index + 1} - {formatDate(installment.date)}
              </span>
              <span className="text-sm text-purple-300 font-medium">
                Juros: {formatCurrency(installment.interestAmount)}
              </span>
            </label>
          ))}
        </div>
      </ScrollArea>
      
      <div className="p-3 rounded bg-purple-500/10 border border-purple-400/20 space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-sm text-purple-200 font-medium">
            Total de Juros Históricos:
          </p>
          <p className="text-lg font-bold text-purple-100">
            {formatCurrency(historicalData.totalInterest)}
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
