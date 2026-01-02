import { useState, useMemo, useEffect } from 'react';
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
import { generateSimulationPDF } from '@/lib/pdfGenerator';
import { Calculator, TrendingUp, Calendar as CalendarIcon, Percent, DollarSign, GitCompare, Zap, FileDown } from 'lucide-react';
import { format, addDays, addMonths, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';

type PaymentType = 'single' | 'installment' | 'weekly' | 'biweekly' | 'daily';
type InterestMode = 'per_installment' | 'on_total' | 'compound_pure' | 'compound_price';

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
  compound_pure: 'Juros Compostos Puro',
  compound_price: 'Tabela Price',
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


export function LoanSimulator() {
  const { profile } = useProfile();
  const [principal, setPrincipal] = useState(1000);
  const [interestRate, setInterestRate] = useState(10);
  const [installments, setInstallments] = useState(6);
  const [paymentType, setPaymentType] = useState<PaymentType>('installment');
  const [interestMode, setInterestMode] = useState<InterestMode>('per_installment');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [firstDueDate, setFirstDueDate] = useState<Date>(addMonths(new Date(), 1));
  const [showComparison, setShowComparison] = useState(false);

  // Estados intermediários para permitir campo vazio durante digitação
  const [principalInput, setPrincipalInput] = useState('1000');
  const [interestRateInput, setInterestRateInput] = useState('10');
  const [installmentsInput, setInstallmentsInput] = useState('6');

  // Calculate interest based on mode
  const calculateInterest = (mode: InterestMode, p: number, rate: number, n: number) => {
    switch (mode) {
      case 'per_installment':
        return p * (rate / 100) * n;
      case 'on_total':
        return p * (rate / 100);
      case 'compound_pure': {
        // Juros Compostos Puro: M = P × (1 + i)^n - P
        const i = rate / 100;
        if (i === 0 || !isFinite(i)) return 0;
        return p * Math.pow(1 + i, n) - p;
      }
      case 'compound_price': {
        // Tabela Price (PMT): Parcelas fixas amortizadas
        const i = rate / 100;
        if (i === 0 || !isFinite(i)) return 0;
        const factor = Math.pow(1 + i, n);
        const pmt = p * (i * factor) / (factor - 1);
        return (pmt * n) - p;
      }
      default:
        return 0;
    }
  };

  // Generate dates based on first due date
  const generateDates = (firstDue: Date, count: number, type: PaymentType) => {
    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      if (type === 'installment') {
        dates.push(addMonths(firstDue, i));
      } else if (type === 'weekly') {
        dates.push(addDays(firstDue, 7 * i));
      } else if (type === 'biweekly') {
        dates.push(addDays(firstDue, 15 * i));
      } else if (type === 'daily') {
        dates.push(addDays(firstDue, i));
      } else {
        // single payment
        dates.push(firstDue);
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
      const dates = generateDates(firstDueDate, effectiveInstallments, paymentType);
      
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
    
    const dates = generateDates(firstDueDate, effectiveInstallments, paymentType);
    
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
  }, [principal, interestRate, installments, paymentType, interestMode, firstDueDate]);

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
      compound_pure: {
        interest: calculateInterest('compound_pure', principal, interestRate, effectiveInstallments),
        total: principal + calculateInterest('compound_pure', principal, interestRate, effectiveInstallments),
      },
      compound_price: {
        interest: calculateInterest('compound_price', principal, interestRate, effectiveInstallments),
        total: principal + calculateInterest('compound_price', principal, interestRate, effectiveInstallments),
      },
    };
  }, [principal, interestRate, installments, paymentType]);

  // Sincronizar inputs quando valores mudam via slider ou handlePaymentTypeChange
  useEffect(() => {
    setPrincipalInput(String(principal));
  }, [principal]);

  useEffect(() => {
    setInterestRateInput(String(interestRate));
  }, [interestRate]);

  useEffect(() => {
    setInstallmentsInput(String(installments));
  }, [installments]);

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
    if (interestMode === 'compound_pure') return 'bg-purple-500/10 border-purple-400/30';
    if (interestMode === 'compound_price') return 'bg-cyan-500/10 border-cyan-400/30';
    if (interestMode === 'on_total') return 'bg-yellow-500/10 border-yellow-400/30';
    return 'bg-primary/5 border-primary/20';
  };

  const getTextColor = () => {
    if (interestMode === 'compound_pure') return 'text-purple-400';
    if (interestMode === 'compound_price') return 'text-cyan-400';
    if (interestMode === 'on_total') return 'text-yellow-400';
    return 'text-primary';
  };

  const handleExportPDF = async () => {
    try {
      await generateSimulationPDF({
        principal: simulation.principal,
        interestRate: simulation.interestRate,
        installments: simulation.installments,
        totalInterest: simulation.totalInterest,
        totalAmount: simulation.totalAmount,
        installmentValue: simulation.installmentValue,
        paymentType: PAYMENT_TYPE_LABELS[paymentType],
        interestMode: INTEREST_MODE_LABELS[interestMode],
        effectiveRate: simulation.effectiveRate,
        startDate: format(startDate, 'dd/MM/yyyy'),
        firstDueDate: format(firstDueDate, 'dd/MM/yyyy'),
        schedule: simulation.schedule.map(item => ({
          number: item.number,
          dueDate: item.dueDate,
          total: item.total,
        })),
        customLogoUrl: profile?.company_logo_url,
      });
      toast.success('PDF da simulação gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Simulador de Empréstimo
            {interestMode === 'compound_pure' && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30">Juros Compostos Puro</Badge>
            )}
            {interestMode === 'compound_price' && (
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30">Tabela Price</Badge>
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <Label>Nº de Parcelas</Label>
              <Input
                type="number"
                value={installmentsInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setInstallmentsInput(value);
                  const numValue = Number(value);
                  if (value !== '' && !isNaN(numValue) && numValue >= 1) {
                    setInstallments(numValue);
                  }
                }}
                onBlur={() => {
                  if (installmentsInput === '' || Number(installmentsInput) < 1) {
                    setInstallmentsInput('1');
                    setInstallments(1);
                  }
                }}
                min={1}
                disabled={paymentType === 'single'}
                className="font-semibold"
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Início</Label>
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
              <Label>Primeiro Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(firstDueDate, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={firstDueDate}
                    onSelect={(date) => date && setFirstDueDate(date)}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Próximas parcelas calculadas a partir desta data
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
                value={principalInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setPrincipalInput(value);
                  const numValue = Number(value);
                  if (value !== '' && !isNaN(numValue) && numValue >= 100) {
                    setPrincipal(numValue);
                  }
                }}
                onBlur={() => {
                  if (principalInput === '' || Number(principalInput) < 100) {
                    setPrincipalInput('100');
                    setPrincipal(100);
                  }
                }}
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
                value={interestRateInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setInterestRateInput(value);
                  const numValue = Number(value);
                  if (value !== '' && !isNaN(numValue) && numValue >= 0) {
                    setInterestRate(numValue);
                  }
                }}
                onBlur={() => {
                  if (interestRateInput === '' || Number(interestRateInput) < 0) {
                    setInterestRateInput('0');
                    setInterestRate(0);
                  }
                }}
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
                      <tr className={cn("border-t", interestMode === 'compound_pure' && "bg-purple-500/10")}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-400/30">
                              Juros Compostos Puro
                            </Badge>
                            {interestMode === 'compound_pure' && <span className="text-xs text-purple-400">✓ Selecionado</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right text-warning font-medium">{formatCurrency(comparison.compound_pure.interest)}</td>
                        <td className="p-3 text-right text-success font-medium">{formatCurrency(comparison.compound_pure.total)}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(comparison.compound_pure.total / installments)}</td>
                      </tr>
                      <tr className={cn("border-t", interestMode === 'compound_price' && "bg-cyan-500/10")}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-400/30">
                              Tabela Price
                            </Badge>
                            {interestMode === 'compound_price' && <span className="text-xs text-cyan-400">✓ Selecionado</span>}
                          </div>
                        </td>
                        <td className="p-3 text-right text-warning font-medium">{formatCurrency(comparison.compound_price.interest)}</td>
                        <td className="p-3 text-right text-success font-medium">{formatCurrency(comparison.compound_price.total)}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(comparison.compound_price.total / installments)}</td>
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
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
                <Badge variant="secondary">
                  {simulation.installments}x de {formatCurrency(simulation.installmentValue)}
                </Badge>
              </div>
            </div>
            
            <div className="rounded-lg border overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-center p-3 font-medium">Parcela</th>
                      <th className="text-center p-3 font-medium">Vencimento</th>
                      <th className="text-center p-3 font-medium">Valor da Parcela</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulation.schedule.map((item) => (
                      <tr key={item.number} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-center">
                          <Badge variant="outline">{item.number}/{simulation.installments}</Badge>
                        </td>
                        <td className="p-3 text-center text-muted-foreground">{item.dueDate}</td>
                        <td className="p-3 text-center font-semibold text-primary">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50 font-semibold">
                    <tr className="border-t">
                      <td colSpan={2} className="p-3">Total a Receber</td>
                      <td className="p-3 text-center text-primary">{formatCurrency(simulation.totalAmount)}</td>
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
