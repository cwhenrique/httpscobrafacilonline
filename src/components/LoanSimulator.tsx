import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/calculations';
import { Calculator, TrendingUp, Calendar, Percent, DollarSign } from 'lucide-react';

export function LoanSimulator() {
  const [principal, setPrincipal] = useState(1000);
  const [interestRate, setInterestRate] = useState(5);
  const [installments, setInstallments] = useState(3);

  const simulation = useMemo(() => {
    // Interest per installment calculation
    const interestPerInstallment = principal * (interestRate / 100);
    const totalInterest = interestPerInstallment * installments;
    const totalAmount = principal + totalInterest;
    
    // Calculate installment value
    const installmentValue = totalAmount / installments;
    const principalPerInstallment = principal / installments;
    
    // Generate installment schedule
    const schedule = Array.from({ length: installments }, (_, i) => {
      const installmentNumber = i + 1;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (15 * installmentNumber)); // 15 days interval
      
      return {
        number: installmentNumber,
        dueDate: dueDate.toLocaleDateString('pt-BR'),
        principal: principalPerInstallment,
        interest: interestPerInstallment,
        total: installmentValue,
        remainingBalance: principal - (principalPerInstallment * installmentNumber),
      };
    });

    return {
      principal,
      interestRate,
      installments,
      interestPerInstallment,
      totalInterest,
      totalAmount,
      installmentValue,
      principalPerInstallment,
      schedule,
      effectiveRate: ((totalAmount / principal) - 1) * 100,
    };
  }, [principal, interestRate, installments]);

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          Simulador de Empréstimo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Controls */}
        <div className="grid md:grid-cols-3 gap-6">
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
              max={50000}
              step={100}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground">R$ 100 - R$ 50.000</p>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Taxa de Juros (% por parcela)
            </Label>
            <Input
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(Math.max(0, Math.min(30, Number(e.target.value))))}
              min={0}
              max={30}
              step={0.5}
              className="text-lg font-semibold"
            />
            <Slider
              value={[interestRate]}
              onValueChange={([val]) => setInterestRate(val)}
              min={0}
              max={30}
              step={0.5}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground">0% - 30% por parcela</p>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Número de Parcelas
            </Label>
            <Input
              type="number"
              value={installments}
              onChange={(e) => setInstallments(Math.max(1, Math.min(24, Number(e.target.value))))}
              min={1}
              max={24}
              className="text-lg font-semibold"
            />
            <Slider
              value={[installments]}
              onValueChange={([val]) => setInstallments(val)}
              min={1}
              max={24}
              step={1}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground">1 - 24 parcelas</p>
          </div>
        </div>

        <Separator />

        {/* Results Summary */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">Valor da Parcela</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(simulation.installmentValue)}
            </p>
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

        {/* Installment Schedule */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Cronograma de Parcelas
            </h4>
            <Badge variant="secondary">
              {installments}x de {formatCurrency(simulation.installmentValue)}
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
  );
}
