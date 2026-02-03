import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, DollarSign, TrendingUp, Percent, Hash, Check, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

type PeriodType = 'today' | 'week' | 'month' | 'custom';

interface PaymentRecord {
  id: string;
  loan_id: string;
  amount: number;
  principal_paid: number;
  interest_paid: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
  client_name: string;
  payment_type: 'normal' | 'interest_only' | 'partial_interest' | 'amortization' | 'installment' | 'historical';
}

// Helper para categorizar tipo de pagamento pelas tags no notes
const getPaymentType = (notes: string | null): PaymentRecord['payment_type'] => {
  if (!notes) return 'normal';
  if (notes.includes('[INTEREST_ONLY_PAYMENT]')) return 'interest_only';
  if (notes.includes('[PARTIAL_INTEREST_PAYMENT]')) return 'partial_interest';
  if (notes.includes('[AMORTIZATION]')) return 'amortization';
  if (notes.includes('[HISTORICAL_INTEREST]')) return 'historical';
  if (notes.match(/Parcela \d+ de \d+/)) return 'installment';
  return 'normal';
};

// Helper para label do tipo de pagamento
const getPaymentTypeLabel = (type: PaymentRecord['payment_type']): string => {
  switch (type) {
    case 'interest_only': return 'Só Juros';
    case 'partial_interest': return 'Juros Parcial';
    case 'amortization': return 'Amortização';
    case 'installment': return 'Parcela';
    case 'historical': return 'Juros Histórico';
    default: return 'Pagamento';
  }
};

// Helper para cor do badge do tipo de pagamento
const getPaymentTypeBadgeClass = (type: PaymentRecord['payment_type']): string => {
  switch (type) {
    case 'interest_only': return 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30';
    case 'partial_interest': return 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30';
    case 'amortization': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30';
    case 'installment': return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30';
    case 'historical': return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30';
    default: return 'bg-muted text-muted-foreground border-muted';
  }
};

// Extrair número da parcela do notes
const extractInstallmentNumber = (notes: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/Parcela (\d+ de \d+)/);
  return match ? match[1] : null;
};

export function PaymentsHistoryTab() {
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();
  
  const today = new Date();
  const [period, setPeriod] = useState<PeriodType>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>({ 
    from: today, 
    to: today 
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>();

  // Calcular datas do período
  const { startDate, endDate } = useMemo(() => {
    switch (period) {
      case 'today':
        return { startDate: startOfDay(today), endDate: endOfDay(today) };
      case 'week':
        return { startDate: startOfWeek(today, { locale: ptBR }), endDate: endOfDay(today) };
      case 'month':
        return { startDate: startOfMonth(today), endDate: endOfDay(today) };
      case 'custom':
        return { 
          startDate: customRange?.from ? startOfDay(customRange.from) : startOfDay(today), 
          endDate: customRange?.to ? endOfDay(customRange.to) : endOfDay(today) 
        };
      default:
        return { startDate: startOfDay(today), endDate: endOfDay(today) };
    }
  }, [period, customRange, today]);

  // Query para buscar pagamentos com join de clientes
  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['payments-history', effectiveUserId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<PaymentRecord[]> => {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('loan_payments')
        .select(`
          id,
          loan_id,
          amount,
          principal_paid,
          interest_paid,
          payment_date,
          notes,
          created_at,
          loans!inner (
            client_id,
            clients!inner (
              full_name
            )
          )
        `)
        .gte('payment_date', startStr)
        .lte('payment_date', endStr)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Erro ao carregar pagamentos:', error);
        throw error;
      }

      return (data || []).map((p: any) => ({
        id: p.id,
        loan_id: p.loan_id,
        amount: p.amount,
        principal_paid: p.principal_paid || 0,
        interest_paid: p.interest_paid || 0,
        payment_date: p.payment_date,
        notes: p.notes,
        created_at: p.created_at,
        client_name: p.loans?.clients?.full_name || 'Cliente',
        payment_type: getPaymentType(p.notes),
      }));
    },
    enabled: !!user && !employeeLoading && !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });

  // Calcular resumo
  const summary = useMemo(() => {
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalInterest = payments.reduce((sum, p) => sum + p.interest_paid, 0);
    const totalPrincipal = payments.reduce((sum, p) => sum + p.principal_paid, 0);
    const count = payments.length;

    return { totalReceived, totalInterest, totalPrincipal, count };
  }, [payments]);

  const handlePeriodClick = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
  };

  const handleCalendarOpenChange = (open: boolean) => {
    setCalendarOpen(open);
    if (open) {
      setTempRange(undefined);
    }
  };

  const handleConfirmRange = () => {
    if (tempRange?.from) {
      setCustomRange(tempRange);
      setPeriod('custom');
    }
    setCalendarOpen(false);
  };

  // Label do período
  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today': return 'Hoje';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mês';
      case 'custom': 
        if (customRange?.from && customRange?.to) {
          return `${format(customRange.from, 'dd/MM')} - ${format(customRange.to, 'dd/MM')}`;
        }
        return 'Personalizado';
      default: return 'Hoje';
    }
  }, [period, customRange]);

  return (
    <div className="space-y-4">
      {/* Filtros de Período */}
      <Card className="shadow-soft">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Período:</span>
            
            <div className="flex flex-wrap gap-1.5">
              <Button 
                variant={period === 'today' ? 'default' : 'outline'} 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => handlePeriodClick('today')}
              >
                Hoje
              </Button>
              <Button 
                variant={period === 'week' ? 'default' : 'outline'} 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => handlePeriodClick('week')}
              >
                Semana
              </Button>
              <Button 
                variant={period === 'month' ? 'default' : 'outline'} 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => handlePeriodClick('month')}
              >
                Mês
              </Button>

              <Popover open={calendarOpen} onOpenChange={handleCalendarOpenChange}>
                <PopoverTrigger asChild>
                  <Button 
                    variant={period === 'custom' ? 'default' : 'outline'} 
                    size="sm" 
                    className="h-8 text-xs gap-1.5"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {period === 'custom' ? periodLabel : 'Período'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b">
                    <p className="text-sm text-muted-foreground">
                      {!tempRange?.from ? 'Selecione a data inicial' : !tempRange?.to ? 'Selecione a data final' : 'Período selecionado'}
                    </p>
                    {tempRange?.from && (
                      <p className="text-sm font-medium text-primary mt-1">
                        {format(tempRange.from, 'dd/MM/yyyy', { locale: ptBR })}
                        {tempRange?.to && ` - ${format(tempRange.to, 'dd/MM/yyyy', { locale: ptBR })}`}
                      </p>
                    )}
                  </div>
                  <Calendar
                    mode="range"
                    selected={tempRange}
                    onSelect={setTempRange}
                    numberOfMonths={2}
                    initialFocus
                    className="pointer-events-auto"
                  />
                  <div className="p-3 border-t flex justify-end">
                    <Button 
                      size="sm" 
                      onClick={handleConfirmRange}
                      disabled={!tempRange?.from}
                      className="gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Confirmar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Button variant="ghost" size="sm" className="h-8 ml-auto" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-soft">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Total Recebido</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(summary.totalReceived)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Juros Recebido</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(summary.totalInterest)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Percent className="w-4 h-4" />
              <span className="text-xs font-medium">Principal Pago</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(summary.totalPrincipal)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Hash className="w-4 h-4" />
              <span className="text-xs font-medium">Qtd. Pagamentos</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-lg sm:text-xl font-bold">
                {summary.count}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Pagamentos */}
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Pagamentos - {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Nenhum pagamento registrado neste período.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const installmentNum = extractInstallmentNumber(payment.notes);
                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(parseISO(payment.payment_date), 'dd/MM', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm truncate max-w-[150px] sm:max-w-none">
                              {payment.client_name}
                            </span>
                            {installmentNum && (
                              <span className="text-xs text-muted-foreground">
                                Parcela {installmentNum}
                              </span>
                            )}
                            {/* Badge mobile */}
                            <div className="sm:hidden mt-1">
                              <Badge 
                                variant="outline" 
                                className={cn("text-[10px] px-1.5 py-0", getPaymentTypeBadgeClass(payment.payment_type))}
                              >
                                {getPaymentTypeLabel(payment.payment_type)}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getPaymentTypeBadgeClass(payment.payment_type))}
                          >
                            {getPaymentTypeLabel(payment.payment_type)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
