import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/calculations';
import { Calculator, TrendingUp, Calendar as CalendarIcon, Percent, DollarSign, GitCompare, Zap } from 'lucide-react';
import { format, addDays, addMonths, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type PaymentType = 'single' | 'installment' | 'weekly' | 'biweekly' | 'daily';
type InterestMode = 'per_installment' | 'on_total' | 'compound';

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  single: 'Pagamento Único',
  installment: 'Parcelado (Mensal)',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  daily: 'Diário',
};

const INTEREST_MODE_LABELS: Record<InterestMode, string> = {
  per_installment: 'Por Parcela',
  on_total: 'Sobre o Total',
  compound: 'Juros Compostos',
};

const getMaxInstallments = (paymentType: PaymentType) => {
  switch (paymentType) {
    case 'single': return 1;
    case 'daily': return 365;
    case 'weekly': return 52;
    case 'biweekly': return 26;
    default: return 120;
  }
};

const getDateInterval = (paymentType: PaymentType) => {
  switch (paymentType) {
    case 'daily': return 1;
    case 'weekly': return 7;
    case 'biweekly': return 15;
    case 'installment': return 30;
    case 'single': return 30;
    default: return 30;
  }
};

export function LoanSimulator() {
  const [principal, setPrincipal] = useState(1000);
  const [interestRate, setInterestRate] = useState(10);
  const [installments, setInstallments] = useState(6);
  const [paymentType, setPaymentType] = useState<PaymentType>('installment');
  const [interestMode, setInterestMode] = useState<InterestMode>('per_installment');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [showComparison, setShowComparison] = useState(false);

  // Calculate interest based on mode
  const calculateInterest = (mode: InterestMode, p: number, rate: number, n: number) => {
    switch (mode) {
      case 'per_installment':
        return p * (rate / 100) * n;
      case 'on_total':
        return p * (rate / 100);
      case 'compound':
        return p * Math.pow(1 + (rate / 100), n) - p;
      default:
        return 0;
    }
  };

  // Generate dates based on payment type
  const generateDates = (start: Date, count: number, type: PaymentType) => {
    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      const interval = getDateInterval(type);
      if (type === 'installment') {
        dates.push(addMonths(start, i + 1));
      } else {
        dates.push(addDays(start, interval * (i + 1)));
      }
    }
    return dates;
  };

  const simulation = useMemo(() => {
    const effectiveInstallments = paymentType === 'single' ? 1 : installments;
    
    // Special handling for daily loans
    if (paymentType === 'daily') {
      const dailyInstallment = interestRate; // For daily, rate field represents daily profit amount
      const totalInterest = dailyInstallment * effectiveInstallments;
      const totalAmount = principal + totalInterest;
      const dates = generateDates(startDate, effectiveInstallments, paymentType);
      
      const schedule = dates.map((date, i) => {
        const isLast = i === effectiveInstallments - 1;
        const installmentValue = isLast ? dailyInstallment + principal : dailyInstallment;
        
        return {
          number: i + 1,
          dueDate: format(date, 'dd/MM/yyyy'),
          principal: isLast ? principal : 0,
          interest: dailyInstallment,
          total: installmentValue,
          remainingBalance: isLast ? 0 : principal,
        };
      });

      return {
        principal,
        interestRate,
        installments: effectiveInstallments,
        totalInterest,
        totalAmount,
        installmentValue: dailyInstallment,
        schedule,
        effectiveRate: (totalInterest / principal) * 100,
        paymentType,
        interestMode,
      };
    }

    // Standard calculation for other types
    const totalInterest = calculateInterest(interestMode, principal, interestRate, effectiveInstallments);
    const totalAmount = principal + totalInterest;
    const installmentValue = totalAmount / effectiveInstallments;
    const principalPerInstallment = principal / effectiveInstallments;
    const interestPerInstallment = totalInterest / effectiveInstallments;
    
    const dates = generateDates(startDate, effectiveInstallments, paymentType);
    
    const schedule = dates.map((date, i) => ({
      number: i + 1,
      dueDate: format(date, 'dd/MM/yyyy'),
      principal: principalPerInstallment,
      interest: interestPerInstallment,
      total: installmentValue,
      remainingBalance: principal - (principalPerInstallment * (i + 1)),
    }));

    return {
      principal,
      interestRate,
      installments: effectiveInstallments,
      totalInterest,
      totalAmount,
      installmentValue,
      schedule,
      effectiveRate: (totalInterest / principal) * 100,
      paymentType,
      interestMode,
    };
  }, [principal, interestRate, installments, paymentType, interestMode, startDate]);

  // Comparison of all interest modes
  const comparison = useMemo(() => {
    const effectiveInstallments = paymentType === 'single' ? 1 : installments;
    
    if (paymentType === 'daily') {
      return null; // No comparison for daily loans
    }

    return {
      per_installment: {
        interest: calculateInterest('per_installment', principal, interestRate, effectiveInstallments),
        total: principal + calculateInterest('per_installment', principal, interestRate, effectiveInstallments),
      },
      on_total: {
        interest: calculateInterest('on_total', principal, interestRate, effectiveInstallments),
        total: principal + calculateInterest('on_total', principal, interestRate, effectiveInstallments),
      },
      compound: {
        interest: calculateInterest('compound', principal, interestRate, effectiveInstallments),
        total: principal + calculateInterest('compound', principal, interestRate, effectiveInstallments),
      },
    };
  }, [principal, interestRate, installments, paymentType]);

  const handlePaymentTypeChange = (value: PaymentType) => {
    setPaymentType(value);
    const maxInstallments = getMaxInstallments(value);
    if (installments > maxInstallments) {
      setInstallments(maxInstallments);
    }
    if (value === 'single') {
      setInstallments(1);
    }
  };

  const getCardStyle = () => {
    if (interestMode === 'compound') return 'bg-cyan-500/10 border-cyan-400/30';
    if (interestMode === 'on_total') return 'bg-yellow-500/10 border-yellow-400/30';
    return 'bg-primary/5 border-primary/20';
  };

  const getTextColor = () => {
    if (interestMode === 'compound') return 'text-cyan-400';
    if (interestMode === 'on_total') return 'text-yellow-400';
    return 'text-primary';
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Simulador de Empréstimo
            {interestMode === 'compound' && (
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30">Juros Compostos</Badge>
            )}
            {paymentType === 'daily' && (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30">Diário</Badge>
            )}
            {paymentType === 'weekly' && (
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-400/30">Semanal</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Row */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Pagamento</Label>
              <Select value={paymentType} onValueChange={(v) => handlePaymentTypeChange(v as PaymentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Modo de Juros</Label>
              <Select 
                value={interestMode} 
                onValueChange={(v) => setInterestMode(v as InterestMode)}
                disabled={paymentType === 'daily'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INTEREST_MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paymentType === 'daily' && (
                <p className="text-xs text-muted-foreground">Diário usa valor fixo por dia</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Parcelas</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={installments}
                  onChange={(e) => setInstallments(Math.max(1, Math.min(getMaxInstallments(paymentType), Number(e.target.value))))}
                  min={1}
                  max={getMaxInstallments(paymentType)}
                  disabled={paymentType === 'single'}
                  className="font-semibold"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Máx: {getMaxInstallments(paymentType)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Main Input Controls */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Valor do Empréstimo
              </Label>
              <Input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(Math.max(100, Number(e.target.value)))}
                min={100}
                className="text-lg font-semibold"
              />
              <Slider
                value={[principal]}
                onValueChange={([val]) => setPrincipal(val)}
                min={100}
                max={100000}
                step={100}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">R$ 100 - R$ 100.000</p>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                {paymentType === 'daily' ? 'Valor Diário (R$)' : 'Taxa de Juros (%)'}
              </Label>
              <Input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(Math.max(0, Number(e.target.value)))}
                min={0}
                step={paymentType === 'daily' ? 1 : 0.5}
                className="text-lg font-semibold"
              />
              <Slider
                value={[interestRate]}
                onValueChange={([val]) => setInterestRate(val)}
                min={0}
                max={paymentType === 'daily' ? 500 : 100}
                step={paymentType === 'daily' ? 1 : 0.5}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">
                {paymentType === 'daily' ? 'Valor cobrado por dia' : 'Sem limite máximo'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Results Summary */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={cn("p-4 rounded-lg border", getCardStyle())}>
              <p className="text-sm text-muted-foreground">Valor da Parcela</p>
              <p className={cn("text-2xl font-bold", getTextColor())}>
                {formatCurrency(simulation.installmentValue)}
              </p>
              {paymentType === 'daily' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Última: {formatCurrency(simulation.installmentValue + principal)}
                </p>
              )}
            </div>
            <div className="p-4 rounded-lg bg-warning/5 border border-warning/20">
              <p className="text-sm text-muted-foreground">Total de Juros</p>
              <p className="text-2xl font-bold text-warning">
                {formatCurrency(simulation.totalInterest)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-success/5 border border-success/20">
              <p className="text-sm text-muted-foreground">Total a Receber</p>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(simulation.totalAmount)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">Taxa Efetiva Total</p>
              <p className="text-2xl font-bold">
                {simulation.effectiveRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Comparison Toggle */}
          {paymentType !== 'daily' && (
            <Button 
              variant="outline" 
              onClick={() => setShowComparison(!showComparison)}
              className="w-full"
            >
              <GitCompare className="w-4 h-4 mr-2" />
              {showComparison ? 'Ocultar' : 'Comparar'} Modos de Juros
            </Button>
          )}

          {/* Interest Mode Comparison */}
          {showComparison && comparison && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Comparativo: {installments} parcelas de {formatCurrency(principal)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Modo de Juros</th>
                        <th className="text-right p-3 font-medium">Juros Total</th>
                        <th className="text-right p-3 font-medium">Total a Receber</th>
                        <th className="text-right p-3 font-medium">Parcela</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={cn("border-t", interestMode === 'per_installment' && "bg-primary/10")}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                              Por Parcela
                            </Badge>
                            {interestMode === 'per_installment' && <span className="text-xs text-primary">✓ Selecionado</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right text-warning font-medium">{formatCurrency(comparison.per_installment.interest)}</td>
                        <td className="p-3 text-right text-success font-medium">{formatCurrency(comparison.per_installment.total)}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(comparison.per_installment.total / installments)}</td>
                      </tr>
                      <tr className={cn("border-t", interestMode === 'on_total' && "bg-yellow-500/10")}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-400/30">
                              Sobre o Total
                            </Badge>
                            {interestMode === 'on_total' && <span className="text-xs text-yellow-400">✓ Selecionado</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right text-warning font-medium">{formatCurrency(comparison.on_total.interest)}</td>
                        <td className="p-3 text-right text-success font-medium">{formatCurrency(comparison.on_total.total)}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(comparison.on_total.total / installments)}</td>
                      </tr>
                      <tr className={cn("border-t", interestMode === 'compound' && "bg-cyan-500/10")}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-400/30">
                              Juros Compostos
                            </Badge>
                            {interestMode === 'compound' && <span className="text-xs text-cyan-400">✓ Selecionado</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right text-warning font-medium">{formatCurrency(comparison.compound.interest)}</td>
                        <td className="p-3 text-right text-success font-medium">{formatCurrency(comparison.compound.total)}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(comparison.compound.total / installments)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Clique em "Modo de Juros" acima para alterar a simulação
                </p>
              </CardContent>
            </Card>
          )}

          {/* Installment Schedule */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Cronograma de Parcelas
              </h4>
              <Badge variant="secondary">
                {simulation.installments}x de {formatCurrency(simulation.installmentValue)}
              </Badge>
            </div>
            
            <div className="rounded-lg border overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Parcela</th>
                      <th className="text-left p-3 font-medium">Vencimento</th>
                      <th className="text-right p-3 font-medium">Principal</th>
                      <th className="text-right p-3 font-medium">Juros</th>
                      <th className="text-right p-3 font-medium">Total</th>
                      <th className="text-right p-3 font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulation.schedule.map((item) => (
                      <tr key={item.number} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <Badge variant="outline">{item.number}ª</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{item.dueDate}</td>
                        <td className="p-3 text-right">{formatCurrency(item.principal)}</td>
                        <td className="p-3 text-right text-warning">{formatCurrency(item.interest)}</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(item.total)}</td>
                        <td className="p-3 text-right text-muted-foreground">
                          {item.remainingBalance > 0 ? formatCurrency(item.remainingBalance) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50 font-semibold">
                    <tr className="border-t">
                      <td colSpan={2} className="p-3">Total</td>
                      <td className="p-3 text-right">{formatCurrency(simulation.principal)}</td>
                      <td className="p-3 text-right text-warning">{formatCurrency(simulation.totalInterest)}</td>
                      <td className="p-3 text-right text-primary">{formatCurrency(simulation.totalAmount)}</td>
                      <td className="p-3 text-right">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
