import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wallet, TrendingUp, Landmark, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmployeeActivityLog } from '@/hooks/useEmployeeActivityLog';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

export default function EmployeeReceiptSummary() {
  const { receiptSummaries, loadingSummaries, fetchReceiptSummaries } = useEmployeeActivityLog();
  const [period, setPeriod] = useState<string>('today');

  useEffect(() => {
    loadSummaries();
  }, [period]);

  function loadSummaries() {
    const today = new Date();
    let dateFrom: string;
    let dateTo: string;

    switch (period) {
      case 'today':
        dateFrom = format(today, 'yyyy-MM-dd');
        dateTo = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        dateFrom = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        dateTo = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        break;
      case 'month':
        dateFrom = format(startOfMonth(today), 'yyyy-MM-dd');
        dateTo = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case '7days':
        dateFrom = format(subDays(today, 7), 'yyyy-MM-dd');
        dateTo = format(today, 'yyyy-MM-dd');
        break;
      default:
        dateFrom = format(today, 'yyyy-MM-dd');
        dateTo = format(today, 'yyyy-MM-dd');
    }

    fetchReceiptSummaries(dateFrom, dateTo);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const totalReceived = receiptSummaries.reduce((s, r) => s + r.total_received, 0);
  const totalPrincipal = receiptSummaries.reduce((s, r) => s + r.total_principal, 0);
  const totalInterest = receiptSummaries.reduce((s, r) => s + r.total_interest, 0);
  const totalPayments = receiptSummaries.reduce((s, r) => s + r.payment_count, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-primary" />
            <CardTitle>Recebimentos por Funcionário</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadSummaries} disabled={loadingSummaries}>
              <RefreshCw className={`w-4 h-4 ${loadingSummaries ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingSummaries ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : receiptSummaries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum funcionário cadastrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Totals */}
            {totalPayments > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-primary/10 text-center">
                  <p className="text-xs text-muted-foreground">Total Recebido</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(totalReceived)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground">Principal</p>
                  <p className="text-lg font-bold">{formatCurrency(totalPrincipal)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground">Juros</p>
                  <p className="text-lg font-bold text-green-500">{formatCurrency(totalInterest)}</p>
                </div>
              </div>
            )}

            {/* Per employee */}
            <div className="space-y-3">
              {receiptSummaries.map(summary => (
                <div key={summary.employee_id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {summary.employee_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{summary.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{summary.payment_count} pagamento{summary.payment_count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(summary.total_received)}</p>
                  </div>
                  {summary.payment_count > 0 && (
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Landmark className="w-3 h-3" />
                        Principal: {formatCurrency(summary.total_principal)}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Juros: {formatCurrency(summary.total_interest)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
