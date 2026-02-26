import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Check, RefreshCw, ChevronDown, User, Users, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { PaymentsSummaryCards } from '@/components/payments/PaymentsSummaryCards';
import { PaymentsTable, PaymentRecord, getPaymentType } from '@/components/payments/PaymentsTable';
import { generatePaymentsReport } from '@/lib/paymentsReportPdf';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

type PeriodType = 'today' | 'week' | 'month' | 'custom';

interface EmployeeInfo {
  employee_user_id: string;
  name: string;
}

export function PaymentsHistoryTab() {
  const { user } = useAuth();
  const { effectiveUserId, isOwner, loading: employeeLoading } = useEmployeeContext();
  const { profile } = useProfile();
  const [isDownloading, setIsDownloading] = useState(false);
  
  const today = new Date();
  const [period, setPeriod] = useState<PeriodType>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>({ from: today, to: today });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const { startDate, endDate } = useMemo(() => {
    switch (period) {
      case 'today': return { startDate: startOfDay(today), endDate: endOfDay(today) };
      case 'week': return { startDate: startOfWeek(today, { locale: ptBR }), endDate: endOfDay(today) };
      case 'month': return { startDate: startOfMonth(today), endDate: endOfDay(today) };
      case 'custom': return { 
        startDate: customRange?.from ? startOfDay(customRange.from) : startOfDay(today), 
        endDate: customRange?.to ? endOfDay(customRange.to) : endOfDay(today) 
      };
      default: return { startDate: startOfDay(today), endDate: endOfDay(today) };
    }
  }, [period, customRange, today]);

  // Fetch active employees (only for owners)
  const { data: employees = [] } = useQuery({
    queryKey: ['active-employees', effectiveUserId],
    queryFn: async (): Promise<EmployeeInfo[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select('employee_user_id, name')
        .eq('owner_id', effectiveUserId!)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveUserId && isOwner,
    staleTime: 1000 * 60 * 5,
  });

  const hasActiveEmployees = isOwner && employees.length > 0;

  // Fetch payments
  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ['payments-history', effectiveUserId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<PaymentRecord[]> => {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('loan_payments')
        .select(`
          id, loan_id, amount, principal_paid, interest_paid,
          payment_date, notes, created_at, created_by,
          loans!inner ( client_id, payment_type, clients!inner ( full_name ) )
        `)
        .gte('payment_date', startStr)
        .lte('payment_date', endStr)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((p: any) => ({
        id: p.id,
        loan_id: p.loan_id,
        amount: p.amount,
        principal_paid: p.principal_paid || 0,
        interest_paid: p.interest_paid || 0,
        payment_date: p.payment_date,
        notes: p.notes,
        created_at: p.created_at,
        created_by: p.created_by || '',
        client_name: p.loans?.clients?.full_name || 'Cliente',
        payment_type: getPaymentType(p.notes),
        loan_payment_type: p.loans?.payment_type || 'single',
      }));
    },
    enabled: !!user && !employeeLoading && !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });

  // Summary totals
  const summary = useMemo(() => {
    const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
    const totalPrincipal = payments.reduce((s, p) => s + p.principal_paid, 0);
    return {
      totalReceived,
      totalInterest: totalReceived - totalPrincipal,
      totalPrincipal,
      count: payments.length,
    };
  }, [payments]);

  // Group payments by creator when owner has employees
  const groupedPayments = useMemo(() => {
    if (!hasActiveEmployees) return null;

    const employeeUserIds = new Set(employees.map(e => e.employee_user_id));
    const ownerPayments = payments.filter(p => !employeeUserIds.has(p.created_by));
    
    const byEmployee = employees.map(emp => ({
      ...emp,
      payments: payments.filter(p => p.created_by === emp.employee_user_id),
    })).filter(g => g.payments.length > 0);

    return { ownerPayments, byEmployee };
  }, [payments, employees, hasActiveEmployees]);

  const calcSummary = (list: PaymentRecord[]) => {
    const totalReceived = list.reduce((s, p) => s + p.amount, 0);
    const totalPrincipal = list.reduce((s, p) => s + p.principal_paid, 0);
    return {
      totalReceived,
      totalInterest: totalReceived - totalPrincipal,
      totalPrincipal,
      count: list.length,
    };
  };

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCalendarOpenChange = (open: boolean) => {
    setCalendarOpen(open);
    if (open) setTempRange(undefined);
  };

  const handleConfirmRange = () => {
    if (tempRange?.from) {
      setCustomRange(tempRange);
      setPeriod('custom');
    }
    setCalendarOpen(false);
  };

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

  const handleDownloadReport = async () => {
    if (payments.length === 0) {
      toast.info('Nenhum pagamento para exportar neste período.');
      return;
    }
    setIsDownloading(true);
    try {
      await generatePaymentsReport({
        payments,
        periodLabel,
        summary,
        companyName: profile?.company_name || profile?.full_name || undefined,
        customLogoUrl: profile?.company_logo_url,
      });
      toast.success('Relatório baixado com sucesso!');
    } catch (e) {
      console.error('Erro ao gerar relatório:', e);
      toast.error('Erro ao gerar relatório.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Period Filters */}
      <Card className="shadow-soft">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Período:</span>
            <div className="flex flex-wrap gap-1.5">
              {(['today', 'week', 'month'] as PeriodType[]).map((p) => (
                <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setPeriod(p)}>
                  {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
                </Button>
              ))}
              <Popover open={calendarOpen} onOpenChange={handleCalendarOpenChange}>
                <PopoverTrigger asChild>
                  <Button variant={period === 'custom' ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1.5">
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
                  <Calendar mode="range" selected={tempRange} onSelect={setTempRange} numberOfMonths={2} initialFocus className="pointer-events-auto" />
                  <div className="p-3 border-t flex justify-end">
                    <Button size="sm" onClick={handleConfirmRange} disabled={!tempRange?.from} className="gap-2">
                      <Check className="w-4 h-4" /> Confirmar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="ghost" size="sm" className="h-8" onClick={handleDownloadReport} disabled={isDownloading || isLoading}>
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consolidated Summary */}
      <PaymentsSummaryCards summary={summary} isLoading={isLoading} />

      {/* Content: grouped or flat */}
      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      ) : groupedPayments ? (
        <div className="space-y-3">
          {/* Owner Section */}
          <CollapsibleSection
            title="Meus Recebimentos"
            icon={<User className="w-4 h-4" />}
            payments={groupedPayments.ownerPayments}
            isOpen={openSections['owner'] !== false}
            onToggle={() => toggleSection('owner')}
            periodLabel={periodLabel}
          />

          {/* Employee Sections */}
          {groupedPayments.byEmployee.map(group => (
            <CollapsibleSection
              key={group.employee_user_id}
              title={`Funcionário: ${group.name}`}
              icon={<Users className="w-4 h-4" />}
              payments={group.payments}
              isOpen={openSections[group.employee_user_id] !== false}
              onToggle={() => toggleSection(group.employee_user_id)}
              periodLabel={periodLabel}
            />
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pagamentos - {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PaymentsTable payments={payments} maxHeight="calc(100vh - 350px)" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Collapsible section sub-component
function CollapsibleSection({ 
  title, icon, payments, isOpen, onToggle, periodLabel 
}: { 
  title: string; 
  icon: React.ReactNode; 
  payments: PaymentRecord[]; 
  isOpen: boolean; 
  onToggle: () => void; 
  periodLabel: string;
}) {
  const sectionSummary = useMemo(() => {
    const totalReceived = payments.reduce((s, p) => s + p.amount, 0);
    const totalPrincipal = payments.reduce((s, p) => s + p.principal_paid, 0);
    return {
      totalReceived,
      totalInterest: totalReceived - totalPrincipal,
      totalPrincipal,
      count: payments.length,
    };
  }, [payments]);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="shadow-soft">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {icon}
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
                <span className="text-xs text-muted-foreground">({payments.length})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(sectionSummary.totalReceived)}
                </span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <PaymentsSummaryCards summary={sectionSummary} isLoading={false} compact />
            <div className="border rounded-md">
              <PaymentsTable 
                payments={payments} 
                maxHeight="300px" 
                emptyMessage={`Nenhum recebimento registrado - ${periodLabel}`} 
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
