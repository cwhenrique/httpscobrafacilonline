import { useState, useMemo } from 'react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLoans } from '@/hooks/useLoans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/calculations';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  AlertTriangle,
  CheckCircle,
  Clock,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Loan } from '@/types/database';

interface DueDateInfo {
  loan: Loan;
  installmentNumber?: number;
  isOverdue: boolean;
  installmentValue: number;
  interestOnlyValue: number;
  principalAmount: number;
  totalToReceive: number;
}

export default function CalendarView() {
  const { loans, loading } = useLoans();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Calculate installment and interest values for a loan
  const calculateLoanValues = (loan: Loan) => {
    const principal = loan.principal_amount;
    const rate = loan.interest_rate;
    const installments = loan.installments || 1;
    const interestMode = loan.interest_mode || 'on_total';
    
    let totalInterest = 0;
    let installmentValue = 0;
    let interestOnlyValue = 0;
    
    if (loan.payment_type === 'daily') {
      // For daily loans: total_interest stores daily amount, interest_rate stores profit
      const dailyAmount = loan.total_interest || 0;
      const dailyDates = Array.isArray(loan.installment_dates) ? loan.installment_dates.length : 1;
      installmentValue = dailyAmount;
      totalInterest = (dailyAmount * dailyDates) - principal;
      interestOnlyValue = dailyAmount - (principal / dailyDates);
    } else if (interestMode === 'per_installment') {
      // Per installment: interest applied to each installment
      totalInterest = principal * (rate / 100) * installments;
      const total = principal + totalInterest;
      installmentValue = total / installments;
      interestOnlyValue = (principal * (rate / 100));
    } else {
      // On total: interest on total amount
      totalInterest = principal * (rate / 100);
      const total = principal + totalInterest;
      installmentValue = total / installments;
      interestOnlyValue = totalInterest / installments;
    }
    
    const totalToReceive = principal + totalInterest;
    
    return {
      installmentValue,
      interestOnlyValue,
      principalAmount: principal,
      totalToReceive
    };
  };

  // Get all due dates from loans
  const dueDates = useMemo(() => {
    const dates: Map<string, DueDateInfo[]> = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    loans.forEach(loan => {
      if (loan.status === 'paid') return;

      const values = calculateLoanValues(loan);

      // For installment loans, check each installment date
      if ((loan.payment_type === 'installment' || loan.payment_type === 'daily') && loan.installment_dates) {
        const installmentDates = Array.isArray(loan.installment_dates) 
          ? loan.installment_dates 
          : [];
        
        installmentDates.forEach((dateStr, index) => {
          const dateKey = dateStr as string;
          const dueDate = parseISO(dateKey);
          const isOverdue = isBefore(dueDate, today);
          
          if (!dates.has(dateKey)) {
            dates.set(dateKey, []);
          }
          dates.get(dateKey)!.push({
            loan,
            installmentNumber: index + 1,
            isOverdue,
            ...values
          });
        });
      } else {
        // Single payment loan
        const dateKey = loan.due_date;
        const dueDate = parseISO(dateKey);
        const isOverdue = isBefore(dueDate, today);
        
        if (!dates.has(dateKey)) {
          dates.set(dateKey, []);
        }
        dates.get(dateKey)!.push({
          loan,
          isOverdue,
          ...values
        });
      }
    });

    return dates;
  }, [loans]);

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return dueDates.get(dateKey) || [];
  }, [selectedDate, dueDates]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding days from previous month
    const startDay = start.getDay();
    const paddingDays = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(start);
      date.setDate(date.getDate() - (i + 1));
      paddingDays.push({ date, isOutside: true });
    }
    
    return [
      ...paddingDays,
      ...days.map(date => ({ date, isOutside: false })),
    ];
  }, [currentMonth]);

  const getDayStatus = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const events = dueDates.get(dateKey);
    if (!events || events.length === 0) return null;
    
    const hasOverdue = events.some(e => e.isOverdue);
    const allPaid = events.every(e => e.loan.status === 'paid');
    
    if (allPaid) return 'paid';
    if (hasOverdue) return 'overdue';
    return 'pending';
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'paid': return 'bg-success text-success-foreground';
      case 'overdue': return 'bg-destructive text-destructive-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return '';
    }
  };

  // Stats for current month
  const monthStats = useMemo(() => {
    let totalDue = 0;
    let overdueCount = 0;
    let pendingCount = 0;

    calendarDays.forEach(({ date, isOutside }) => {
      if (isOutside) return;
      const dateKey = format(date, 'yyyy-MM-dd');
      const events = dueDates.get(dateKey);
      if (!events) return;

      events.forEach(event => {
        if (event.loan.status !== 'paid') {
          totalDue += event.installmentValue;
          if (event.isOverdue) {
            overdueCount++;
          } else {
            pendingCount++;
          }
        }
      });
    });

    return { totalDue, overdueCount, pendingCount };
  }, [calendarDays, dueDates]);

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Calendário de Vencimentos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Visualize todos os vencimentos dos seus empréstimos</p>
        </div>

        {/* Month Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="shadow-soft">
            <CardContent className="p-2.5 sm:pt-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-warning/10">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">A Vencer</p>
                  <p className="text-lg sm:text-xl font-bold">{monthStats.pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-2.5 sm:pt-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Vencidos</p>
                  <p className="text-lg sm:text-xl font-bold">{monthStats.overdueCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="p-2.5 sm:pt-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="text-center sm:text-left min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total no Mês</p>
                  <p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(monthStats.totalDue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg capitalize">
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 hidden sm:block" />
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7 sm:h-9 sm:w-9"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-7 text-xs sm:h-9 sm:text-sm px-2 sm:px-3"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Hoje
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-7 w-7 sm:h-9 sm:w-9"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {loading ? (
                <Skeleton className="h-[280px] sm:h-[400px] w-full" />
              ) : (
                <>
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 mb-1 sm:mb-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center text-[10px] sm:text-sm font-medium text-muted-foreground py-1 sm:py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {calendarDays.map(({ date, isOutside }, index) => {
                      const status = getDayStatus(date);
                      const dateKey = format(date, 'yyyy-MM-dd');
                      const eventCount = dueDates.get(dateKey)?.length || 0;
                      const isSelected = selectedDate && isSameDay(date, selectedDate);
                      
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedDate(date)}
                          className={cn(
                            'relative aspect-square p-0.5 sm:p-1 rounded-md sm:rounded-lg transition-all hover:bg-muted/50 border border-primary/20',
                            isOutside && 'opacity-30',
                            isToday(date) && 'ring-1 sm:ring-2 ring-primary ring-offset-1 sm:ring-offset-2 border-primary',
                            isSelected && 'bg-primary/10 ring-1 sm:ring-2 ring-primary border-primary',
                          )}
                        >
                          <span className={cn(
                            'text-xs sm:text-sm',
                            isToday(date) && 'font-bold text-primary'
                          )}>
                            {format(date, 'd')}
                          </span>
                          
                          {eventCount > 0 && (
                            <div className={cn(
                              'absolute bottom-0.5 sm:bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold',
                              getStatusColor(status)
                            )}>
                              {eventCount}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex justify-center gap-3 sm:gap-6 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-warning" />
                      <span>A vencer</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-destructive" />
                      <span>Vencido</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-success" />
                      <span>Pago</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Selected Date Details */}
          <Card className="shadow-soft">
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">
                {selectedDate 
                  ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                  : 'Selecione uma data'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              {selectedDate ? (
                selectedDateEvents.length > 0 ? (
                  <ScrollArea className="h-[250px] sm:h-[400px] pr-2 sm:pr-4">
                    <div className="space-y-2 sm:space-y-3">
                      {selectedDateEvents.map((event, index) => (
                        <div 
                          key={index}
                          className={cn(
                            'p-2.5 sm:p-3 rounded-lg border',
                            event.isOverdue 
                              ? 'bg-destructive/5 border-destructive/20' 
                              : 'bg-warning/5 border-warning/20'
                          )}
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className={cn(
                              'p-1.5 sm:p-2 rounded-full flex-shrink-0',
                              event.isOverdue ? 'bg-destructive/10' : 'bg-warning/10'
                            )}>
                              {event.isOverdue 
                                ? <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                                : <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-warning" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                                <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium truncate text-sm sm:text-base">
                                  {event.loan.client?.full_name}
                                </span>
                                {event.installmentNumber && (
                                  <Badge variant="secondary" className="text-[10px] sm:text-xs ml-auto">
                                    {event.installmentNumber}/{event.loan.installments || 1}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="space-y-1.5 text-xs sm:text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Parcela:</span>
                                  <span className="font-bold text-base sm:text-lg">{formatCurrency(event.installmentValue)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Só Juros:</span>
                                  <span className="font-medium text-purple-400">{formatCurrency(event.interestOnlyValue)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Emprestado:</span>
                                  <span className="font-medium">{formatCurrency(event.principalAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-border/50">
                                  <span className="text-muted-foreground">Total a Receber:</span>
                                  <span className="font-bold text-primary">{formatCurrency(event.totalToReceive)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground/30 mb-2 sm:mb-3" />
                    <p className="text-sm sm:text-base text-muted-foreground">Nenhum vencimento nesta data</p>
                  </div>
                )
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <CalendarIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground/30 mb-2 sm:mb-3" />
                  <p className="text-sm sm:text-base text-muted-foreground">Clique em uma data para ver os vencimentos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
