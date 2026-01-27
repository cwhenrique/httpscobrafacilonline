import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useOperationalStats } from '@/hooks/useOperationalStats';
import { useProfile } from '@/hooks/useProfile';
import { CashFlowCard } from '@/components/reports/CashFlowCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency, formatDate, isLoanOverdue, getDaysOverdue, calculateDynamicOverdueInterest } from '@/lib/calculations';
import { generateOperationsReport, OperationsReportData, LoanOperationData, InstallmentDetail } from '@/lib/pdfGenerator';
import { toast } from 'sonner';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Banknote, 
  CheckCircle, 
  Clock,
  RefreshCw,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CalendarIcon,
  PiggyBank,
  Calendar as CalendarDays,
  CalendarRange,
  CalendarCheck,
  Filter,
  ChevronDown,
  Download,
  Check
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from 'react-day-picker';

// Stat Card Component
const StatCard = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  bgColor = 'bg-primary/10',
  subtitle,
  trend,
  compact = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor?: string;
  bgColor?: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  compact?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="border-primary/30 bg-card shadow-lg hover:shadow-xl transition-shadow h-full">
      <CardContent className={cn("p-3 sm:p-4", compact && "p-2 sm:p-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={cn("p-2 sm:p-3 rounded-xl shrink-0", bgColor)}>
              <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{label}</p>
              <p className={cn("text-sm sm:text-lg lg:text-xl font-bold mt-0.5", compact && "text-xs sm:text-base")}>{value}</p>
              {subtitle && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
              trend === 'up' && "bg-emerald-500/10 text-emerald-500",
              trend === 'down' && "bg-destructive/10 text-destructive",
              trend === 'neutral' && "bg-muted text-muted-foreground"
            )}>
              {trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
              {trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

// Loading skeleton
const StatCardSkeleton = () => (
  <Card className="border-primary/30">
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16 sm:w-20" />
          <Skeleton className="h-5 w-20 sm:w-24" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function ReportsLoans() {
  const { stats, refetch } = useOperationalStats();
  const { profile, updateProfile, refetch: refetchProfile } = useProfile();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined);

  const handleCalendarOpenChange = (open: boolean) => {
    setCalendarOpen(open);
    if (open) {
      // Reset para começar seleção do zero
      setTempDateRange(undefined);
    }
  };

  const handleConfirmDateRange = () => {
    if (tempDateRange?.from) {
      setDateRange({
        from: tempDateRange.from,
        to: tempDateRange.to || tempDateRange.from,
      });
    }
    setCalendarOpen(false);
  };

  // Payment type labels
  const paymentTypeLabels: Record<string, string> = {
    all: 'Todos',
    daily: 'Diário',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    installment: 'Mensal',
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Helper function to get partial payments from notes
  const getPartialPaymentsFromNotesForPDF = (notes: string | null | undefined): Record<number, number> => {
    if (!notes) return {};
    const partialPayments: Record<number, number> = {};
    const regex = /\[PARTIAL_PAID:(\d+):([\d.]+)\]/g;
    let match;
    while ((match = regex.exec(notes)) !== null) {
      const index = parseInt(match[1], 10);
      const amount = parseFloat(match[2]);
      partialPayments[index] = (partialPayments[index] || 0) + amount;
    }
    return partialPayments;
  };

  // Export PDF function
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Use filteredLoans (filtered by period AND type) to include ALL loans (paid + active)
      const loansToExport = filteredLoans;
      
      // Transform loans to the format expected by generateOperationsReport
      const loansData: LoanOperationData[] = loansToExport.map(loan => {
        const isDaily = loan.payment_type === 'daily';
        const installmentDates = (loan as any).installment_dates || [];
        const payments = (loan as any).payments || [];
        const partialPayments = getPartialPaymentsFromNotesForPDF(loan.notes);
        const numInstallments = Number(loan.installments) || installmentDates.length || 1;
        
        // Calculate installment value
        let installmentValue: number;
        if (isDaily) {
          installmentValue = Number(loan.total_interest) || 0;
        } else if (loan.interest_mode === 'on_total') {
          const totalInterest = Number(loan.principal_amount) * (Number(loan.interest_rate) / 100);
          installmentValue = (Number(loan.principal_amount) + totalInterest) / numInstallments;
        } else {
          const totalInterest = Number(loan.principal_amount) * (Number(loan.interest_rate) / 100) * numInstallments;
          installmentValue = (Number(loan.principal_amount) + totalInterest) / numInstallments;
        }
        
        // Build installment details
        const installmentDetails: InstallmentDetail[] = installmentDates.map((dateStr: string, index: number) => {
          const paidAmount = partialPayments[index] || 0;
          const isPaid = paidAmount >= installmentValue * 0.99;
          const dueDate = parseISO(dateStr);
          const isOverdue = !isPaid && dueDate < new Date();
          
          // Find payment for this installment
          const matchingPayment = payments.find((p: any) => {
            if (!p.notes) return false;
            return p.notes.includes(`[PARTIAL_PAID:${index}:`);
          });
          
          return {
            number: index + 1,
            dueDate: dateStr,
            amount: installmentValue,
            status: isPaid ? 'paid' as const : isOverdue ? 'overdue' as const : 'pending' as const,
            paidDate: matchingPayment?.payment_date || null,
            paidAmount: paidAmount,
          };
        });
        
        // Count paid and overdue installments
        const paidInstallments = installmentDetails.filter(i => i.status === 'paid').length;
        const overdueInstallments = installmentDetails.filter(i => i.status === 'overdue').length;
        
        // Calculate total interest
        const totalInterestCalc = isDaily
          ? (Number(loan.remaining_balance) + Number(loan.total_paid || 0)) - Number(loan.principal_amount)
          : loan.interest_mode === 'per_installment'
            ? Number(loan.principal_amount) * (Number(loan.interest_rate) / 100) * numInstallments
            : Number(loan.principal_amount) * (Number(loan.interest_rate) / 100);
        
        // Determine status - now correctly includes 'paid'
        const loanIsOverdue = isLoanOverdue(loan);
        const status = loan.status === 'paid' ? 'paid' : loanIsOverdue ? 'overdue' : 'pending';
        
        const pendingInstallments = installmentDetails.filter(i => i.status === 'pending').length;
        
        return {
          id: loan.id,
          clientName: (loan as any).client?.full_name || 'Cliente',
          principalAmount: Number(loan.principal_amount),
          interestRate: Number(loan.interest_rate),
          interestMode: loan.interest_mode || 'per_installment',
          totalInterest: totalInterestCalc,
          totalToReceive: Number(loan.principal_amount) + totalInterestCalc,
          totalPaid: Number(loan.total_paid || 0),
          remainingBalance: Number(loan.remaining_balance || 0),
          paymentType: loan.payment_type,
          installments: numInstallments,
          paidInstallments,
          pendingInstallments,
          overdueInstallments,
          startDate: loan.start_date,
          dueDate: loan.due_date,
          status,
          installmentDetails,
          payments: payments.map((p: any) => ({
            date: p.payment_date,
            amount: Number(p.amount || 0),
            principalPaid: Number(p.principal_paid || 0),
            interestPaid: Number(p.interest_paid || 0),
            notes: p.notes,
          })),
        };
      });
      
      // Use the same data as displayed in the StatCards
      const paidLoansCount = filteredLoans.filter(l => l.status === 'paid').length;
      const activeLoansInExport = filteredLoans.filter(l => l.status !== 'paid');
      const pendingLoansCount = activeLoansInExport.filter(l => !isLoanOverdue(l)).length;
      const overdueLoansCount = activeLoansInExport.filter(l => isLoanOverdue(l)).length;
      
      const reportData: OperationsReportData = {
        companyName: profile?.company_name || profile?.full_name || '',
        userName: profile?.full_name || '',
        generatedAt: new Date().toISOString(),
        loans: loansData,
        summary: {
          // Use filteredLoans.length for total contracts (same as displayed)
          totalLoans: filteredLoans.length,
          // Use the exact same values from filteredStats (displayed in StatCards)
          totalLent: filteredStats.totalLent,
          totalInterest: filteredStats.pendingInterest,
          totalToReceive: filteredStats.totalOnStreet + filteredStats.pendingInterest,
          totalReceived: filteredStats.totalReceived,
          totalPending: filteredStats.pendingAmount,
          paidLoans: paidLoansCount,
          pendingLoans: pendingLoansCount,
          overdueLoans: overdueLoansCount,
        },
      };
      
      await generateOperationsReport(reportData);
      
      // Build period description for toast
      const periodDesc = dateRange?.from && dateRange?.to 
        ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
        : 'Todos os períodos';
      const typeDesc = paymentTypeLabels[paymentTypeFilter];
      
      toast.success(`PDF gerado com sucesso!`, {
        description: `Período: ${periodDesc} | Tipo: ${typeDesc} | ${loansData.length} contratos`,
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF', {
        description: 'Tente novamente.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Filter loans by date range and payment type
  const filteredLoans = useMemo(() => {
    let loans = stats.allLoans;
    
    // Filter by date range - usar contract_date (quando o dinheiro saiu) com fallback para start_date
    if (dateRange?.from && dateRange?.to) {
      loans = loans.filter(loan => {
        const loanDate = parseISO(loan.contract_date || loan.start_date);
        return isWithinInterval(loanDate, { start: dateRange.from!, end: dateRange.to! });
      });
    }
    
    // Filter by payment type
    if (paymentTypeFilter !== 'all') {
      if (paymentTypeFilter === 'installment') {
        // Mensal inclui 'installment' e 'single'
        loans = loans.filter(loan => 
          loan.payment_type === 'installment' || loan.payment_type === 'single'
        );
      } else {
        loans = loans.filter(loan => loan.payment_type === paymentTypeFilter);
      }
    }
    
    return loans;
  }, [stats.allLoans, dateRange, paymentTypeFilter]);

  // Stats by payment type (for the type cards)
  const statsByPaymentType = useMemo(() => {
    const types = ['daily', 'weekly', 'biweekly', 'installment'];
    
    return types.map(type => {
      // Mensal inclui 'installment' e 'single'
      const typeLoans = stats.allLoans.filter(loan => {
        if (type === 'installment') {
          return loan.payment_type === 'installment' || loan.payment_type === 'single';
        }
        return loan.payment_type === type;
      });
      const activeLoans = typeLoans.filter(loan => loan.status !== 'paid');
      const totalOnStreet = activeLoans.reduce((sum, loan) => {
        const principal = Number(loan.principal_amount);
        const payments = (loan as any).payments || [];
        const totalPrincipalPaid = payments.reduce((s: number, p: any) => s + Number(p.principal_paid || 0), 0);
        return sum + (principal - totalPrincipalPaid);
      }, 0);
      const totalReceived = typeLoans.reduce((sum, loan) => sum + Number(loan.total_paid || 0), 0);
      
      // Calculate realized profit from payments
      let realizedProfit = 0;
      typeLoans.forEach(loan => {
        const payments = (loan as any).payments || [];
        realizedProfit += payments.reduce((sum: number, p: any) => sum + Number(p.interest_paid || 0), 0);
      });
      
      return {
        type,
        label: paymentTypeLabels[type],
        count: activeLoans.length,
        totalCount: typeLoans.length,
        totalOnStreet,
        totalReceived,
        realizedProfit,
      };
    });
  }, [stats.allLoans]);

  // Filter loans by payment type only (for current state metrics)
  const loansFilteredByType = useMemo(() => {
    if (paymentTypeFilter === 'all') return stats.allLoans;
    
    if (paymentTypeFilter === 'installment') {
      return stats.allLoans.filter(loan => 
        loan.payment_type === 'installment' || loan.payment_type === 'single'
      );
    }
    return stats.allLoans.filter(loan => loan.payment_type === paymentTypeFilter);
  }, [stats.allLoans, paymentTypeFilter]);

  // Payments received within the selected date range
  const paymentsInPeriod = useMemo(() => {
    const payments: Array<{
      loanId: string;
      amount: number;
      interestPaid: number;
      principalPaid: number;
      paymentDate: Date;
    }> = [];
    
    loansFilteredByType.forEach(loan => {
      const loanPayments = (loan as any).payments || [];
      loanPayments.forEach((payment: any) => {
        if (!payment.payment_date) return;
        const paymentDate = parseISO(payment.payment_date);
        
        if (dateRange?.from && dateRange?.to) {
          // Normalize dates for comparison without time issues
          const startDate = startOfDay(dateRange.from);
          const endDate = endOfDay(dateRange.to);
          if (isWithinInterval(paymentDate, { start: startDate, end: endDate })) {
            payments.push({
              loanId: loan.id,
              amount: Number(payment.amount || 0),
              interestPaid: Number(payment.interest_paid || 0),
              principalPaid: Number(payment.principal_paid || 0),
              paymentDate,
            });
          }
        } else {
          payments.push({
            loanId: loan.id,
            amount: Number(payment.amount || 0),
            interestPaid: Number(payment.interest_paid || 0),
            principalPaid: Number(payment.principal_paid || 0),
            paymentDate,
          });
        }
      });
    });
    
    return payments;
  }, [loansFilteredByType, dateRange]);

  // Calculate comprehensive filtered stats
  const filteredStats = useMemo(() => {
    // For current state metrics (Capital na Rua, Em Atraso) - use ALL data filtered by type only
    const allActiveLoans = loansFilteredByType.filter(loan => loan.status !== 'paid');
    const allOverdueLoans = allActiveLoans.filter(loan => isLoanOverdue(loan));
    
    // Capital na Rua - CURRENT STATE (not filtered by period)
    const totalOnStreet = allActiveLoans.reduce((sum, loan) => {
      const principal = Number(loan.principal_amount);
      const payments = (loan as any).payments || [];
      const totalPrincipalPaid = payments.reduce((s: number, p: any) => s + Number(p.principal_paid || 0), 0);
      return sum + (principal - totalPrincipalPaid);
    }, 0);
    
    // Juros a Receber - FILTERED BY PERIOD (based on installment due dates)
    const pendingInterest = allActiveLoans.reduce((sum, loan) => {
      const principal = Number(loan.principal_amount);
      const remainingBalance = Number(loan.remaining_balance || 0);
      const totalPaid = Number(loan.total_paid || 0);
      const rate = Number(loan.interest_rate);
      const installments = Number(loan.installments) || 1;
      const interestMode = loan.interest_mode || 'per_installment';
      const isDaily = loan.payment_type === 'daily';
      const installmentDates = (loan as any).installment_dates || [];
      
      const payments = (loan as any).payments || [];
      const interestPaid = payments.reduce((s: number, p: any) => 
        s + Number(p.interest_paid || 0), 0);
      
      // Calculate interest per installment
      let interestPerInstallment = 0;
      let totalInterest = 0;
      
      if (isDaily) {
        // For daily loans, total_interest is the installment value (principal + interest)
        const dailyInstallment = Number(loan.total_interest) || 0;
        const principalPerInstallment = principal / installments;
        interestPerInstallment = dailyInstallment - principalPerInstallment;
        totalInterest = remainingBalance + totalPaid - principal;
      } else if (interestMode === 'per_installment') {
        // Interest charged per installment
        interestPerInstallment = principal * (rate / 100);
        totalInterest = interestPerInstallment * installments;
      } else {
        // Interest on total (divided across installments)
        totalInterest = principal * (rate / 100);
        interestPerInstallment = totalInterest / installments;
      }
      
      // If period is selected and loan has installment dates, filter by due dates
      if (dateRange?.from && dateRange?.to && installmentDates.length > 0) {
        const startDate = startOfDay(dateRange.from);
        const endDate = endOfDay(dateRange.to);
        
        // Count how many installments are already paid
        const paidInstallmentsCount = interestPerInstallment > 0 
          ? Math.min(Math.floor(interestPaid / interestPerInstallment), installments)
          : 0;
        
        let interestInPeriod = 0;
        installmentDates.forEach((dateStr: string, index: number) => {
          const dueDate = parseISO(dateStr);
          // Only count unpaid installments within the period
          if (index >= paidInstallmentsCount && isWithinInterval(dueDate, { start: startDate, end: endDate })) {
            interestInPeriod += interestPerInstallment;
          }
        });
        
        return sum + Math.max(0, interestInPeriod);
      }
      
      // No period selected - show all pending interest (current state)
      return sum + Math.max(0, totalInterest - interestPaid);
    }, 0);
    
    // Helper para extrair pagamentos parciais das notas
    const getPartialPaymentsFromNotes = (notes: string | null | undefined): Record<number, number> => {
      if (!notes) return {};
      const partialPayments: Record<number, number> = {};
      const regex = /\[PARTIAL_PAID:(\d+):([\d.]+)\]/g;
      let match;
      while ((match = regex.exec(notes)) !== null) {
        const index = parseInt(match[1], 10);
        const amount = parseFloat(match[2]);
        partialPayments[index] = (partialPayments[index] || 0) + amount;
      }
      return partialPayments;
    };
    
    // Falta Receber - INSTALLMENTS DUE IN PERIOD (lógica corrigida)
    const pendingAmount = allActiveLoans.reduce((sum, loan) => {
      const isDaily = loan.payment_type === 'daily';
      const isInstallment = loan.payment_type === 'installment' || 
                            loan.payment_type === 'weekly' || 
                            loan.payment_type === 'biweekly';
      const installmentDates = (loan as any).installment_dates || [];
      
      if ((isDaily || isInstallment) && installmentDates.length > 0) {
        const partialPayments = getPartialPaymentsFromNotes(loan.notes);
        const numInstallments = Number(loan.installments) || installmentDates.length;
        
        // Calcular valor por parcela corretamente
        let installmentValue: number;
        if (isDaily) {
          // Para diário, total_interest É o valor da parcela
          installmentValue = Number(loan.total_interest) || 0;
        } else if (loan.interest_mode === 'on_total') {
          const totalInterest = Number(loan.principal_amount) * (Number(loan.interest_rate) / 100);
          installmentValue = (Number(loan.principal_amount) + totalInterest) / numInstallments;
        } else {
          const totalInterest = Number(loan.principal_amount) * (Number(loan.interest_rate) / 100) * numInstallments;
          installmentValue = (Number(loan.principal_amount) + totalInterest) / numInstallments;
        }
        
        let pendingInPeriod = 0;
        installmentDates.forEach((dateStr: string, index: number) => {
          const dueDate = parseISO(dateStr);
          const paidAmount = partialPayments[index] || 0;
          const isInstallmentPaid = paidAmount >= installmentValue * 0.99;
          
          if (!isInstallmentPaid) {
            if (dateRange?.from && dateRange?.to) {
              const startDate = startOfDay(dateRange.from);
              const endDate = endOfDay(dateRange.to);
              if (isWithinInterval(dueDate, { start: startDate, end: endDate })) {
                pendingInPeriod += Math.max(0, installmentValue - paidAmount);
              }
            } else {
              pendingInPeriod += Math.max(0, installmentValue - paidAmount);
            }
          }
        });
        return sum + pendingInPeriod;
      } else {
        // Empréstimo com parcela única
        const dueDate = parseISO(loan.due_date);
        if (dateRange?.from && dateRange?.to) {
          const startDate = startOfDay(dateRange.from);
          const endDate = endOfDay(dateRange.to);
          if (isWithinInterval(dueDate, { start: startDate, end: endDate })) {
            return sum + Number(loan.remaining_balance || 0);
          }
          return sum;
        }
        return sum + Number(loan.remaining_balance || 0);
      }
    }, 0);
    
    // Em Atraso - CURRENT STATE (inclui juros por atraso dinâmicos)
    const overdueAmount = allOverdueLoans.reduce((sum, loan) => {
      const daysOver = getDaysOverdue(loan);
      const dynamicInterest = calculateDynamicOverdueInterest(loan, daysOver);
      return sum + Number(loan.remaining_balance || 0) + dynamicInterest;
    }, 0);
    
    // Total Recebido - PAYMENTS IN PERIOD
    const totalReceivedInPeriod = paymentsInPeriod.reduce((sum, p) => sum + p.amount, 0);
    
    // Lucro Realizado - PAYMENTS IN PERIOD (interest received)
    const realizedProfitInPeriod = paymentsInPeriod.reduce((sum, p) => sum + p.interestPaid, 0);

    // Loans created in period (for table display) - usar contract_date para fluxo de caixa
    const loansInPeriod = dateRange?.from && dateRange?.to
      ? loansFilteredByType.filter(loan => {
          const loanDate = parseISO(loan.contract_date || loan.start_date);
          return isWithinInterval(loanDate, { start: dateRange.from!, end: dateRange.to! });
        })
      : loansFilteredByType;
    
    // Total emprestado no período
    const totalLent = loansInPeriod.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
    
    // Active and overdue from loans in period (for tables)
    const activeLoansInPeriod = loansInPeriod.filter(loan => loan.status !== 'paid');
    const overdueLoansInPeriod = activeLoansInPeriod.filter(loan => isLoanOverdue(loan));
    
    return {
      totalOnStreet,
      pendingInterest,
      totalReceivedAllTime: totalReceivedInPeriod,
      pendingAmount,
      overdueAmount,
      realizedProfit: realizedProfitInPeriod,
      activeLoansCount: allActiveLoans.length,
      overdueCount: allOverdueLoans.length,
      activeLoans: activeLoansInPeriod,
      overdueLoans: overdueLoansInPeriod,
      totalLent,
      totalProfit: realizedProfitInPeriod,
      totalReceived: totalReceivedInPeriod,
    };
  }, [loansFilteredByType, paymentsInPeriod, dateRange]);

  // Monthly evolution data - filtered by payment type
  const monthlyEvolution = useMemo(() => {
    const months: { month: string; naRua: number; recebido: number; lucro: number }[] = [];
    
    // Get base loans filtered by payment type only (not date range for evolution)
    const baseLoans = paymentTypeFilter !== 'all' 
      ? stats.allLoans.filter(loan => {
          if (paymentTypeFilter === 'installment') {
            // Mensal inclui 'installment' e 'single'
            return loan.payment_type === 'installment' || loan.payment_type === 'single';
          }
          return loan.payment_type === paymentTypeFilter;
        })
      : stats.allLoans;
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, 'MMM', { locale: ptBR });

      let monthNaRua = 0;
      let monthRecebido = 0;
      let monthPrincipal = 0;

      baseLoans.forEach(loan => {
        // Usar contract_date para fluxo de caixa (quando o dinheiro saiu)
        const loanDate = parseISO(loan.contract_date || loan.start_date);
        if (isWithinInterval(loanDate, { start: monthStart, end: monthEnd })) {
          if (loan.status !== 'paid') {
            monthNaRua += Number(loan.principal_amount);
          }
          monthRecebido += Number(loan.total_paid || 0);
          if (loan.status === 'paid') {
            monthPrincipal += Number(loan.principal_amount);
          }
        }
      });

      months.push({
        month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        naRua: Math.round(monthNaRua),
        recebido: Math.round(monthRecebido),
        lucro: Math.round(monthRecebido - monthPrincipal),
      });
    }

    return months;
  }, [stats.allLoans, paymentTypeFilter]);

  // Cash Flow calculations
  const initialCashBalance = profile?.cash_flow_initial_balance || 0;
  
  const cashFlowStats = useMemo(() => {
    const loanedInPeriod = filteredStats.totalLent;
    const receivedInPeriod = filteredStats.totalReceived;
    const interestReceived = filteredStats.realizedProfit;
    const currentBalance = initialCashBalance - loanedInPeriod + receivedInPeriod;
    
    return {
      initialBalance: initialCashBalance,
      loanedInPeriod,
      receivedInPeriod,
      interestReceived,
      currentBalance,
    };
  }, [initialCashBalance, filteredStats]);

  const handleUpdateCashFlowBalance = async (value: number) => {
    const { error } = await updateProfile({ cash_flow_initial_balance: value });
    if (error) {
      toast.error('Erro ao atualizar saldo inicial');
    } else {
      await refetchProfile();
      toast.success('Saldo inicial atualizado!');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Quitado</Badge>;
      case 'overdue':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Em Atraso</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Em Dia</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display">Relatório Operacional</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Acompanhe seus empréstimos em tempo real
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                Atualizado: {format(lastUpdated, "HH:mm", { locale: ptBR })}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="gap-1.5 text-xs"
              >
                <Download className={cn("w-3.5 h-3.5", isExporting && "animate-pulse")} />
                <span className="hidden sm:inline">{isExporting ? 'Gerando...' : 'Baixar PDF'}</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>

          {/* Period Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={calendarOpen} onOpenChange={handleCalendarOpenChange}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    "Selecionar período"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    {!tempDateRange?.from 
                      ? 'Selecione a data inicial' 
                      : !tempDateRange?.to 
                        ? 'Agora selecione a data final' 
                        : 'Período selecionado'}
                  </p>
                  {tempDateRange?.from && (
                    <p className="text-sm font-medium text-primary mt-1">
                      {format(tempDateRange.from, 'dd/MM/yyyy', { locale: ptBR })}
                      {tempDateRange.to && ` - ${format(tempDateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`}
                    </p>
                  )}
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={tempDateRange}
                  onSelect={setTempDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
                <div className="p-3 border-t flex justify-end">
                  <Button 
                    size="sm" 
                    onClick={handleConfirmDateRange}
                    disabled={!tempDateRange?.from}
                    className="gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Confirmar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {dateRange?.from && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setDateRange({ from: startOfMonth(new Date()), to: new Date() })}
                className="text-xs text-muted-foreground"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Payment Type Filter Cards - Collapsible */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tipo de Pagamento:</span>
              {(() => {
                const activeFilterConfig: Record<string, { color: string; bgColor: string }> = {
                  all: { color: 'text-violet-500', bgColor: 'bg-violet-500/10 border-violet-500/30' },
                  daily: { color: 'text-orange-500', bgColor: 'bg-orange-500/10 border-orange-500/30' },
                  weekly: { color: 'text-blue-500', bgColor: 'bg-blue-500/10 border-blue-500/30' },
                  biweekly: { color: 'text-cyan-500', bgColor: 'bg-cyan-500/10 border-cyan-500/30' },
                  installment: { color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/30' },
                };
                const config = activeFilterConfig[paymentTypeFilter] || activeFilterConfig.all;
                
                // Calculate value for active filter
                let activeValue = 0;
                if (paymentTypeFilter === 'all') {
                  const allActiveLoans = stats.allLoans.filter(loan => loan.status !== 'paid');
                  activeValue = allActiveLoans.reduce((sum, loan) => {
                    const principal = Number(loan.principal_amount);
                    const payments = (loan as any).payments || [];
                    const totalPrincipalPaid = payments.reduce((s: number, p: any) => s + Number(p.principal_paid || 0), 0);
                    return sum + (principal - totalPrincipalPaid);
                  }, 0);
                } else {
                  const typeStat = statsByPaymentType.find(t => t.type === paymentTypeFilter);
                  activeValue = typeStat?.totalOnStreet || 0;
                }
                
                return (
                  <>
                    <Badge variant="outline" className={cn("border", config.bgColor, config.color)}>
                      {paymentTypeLabels[paymentTypeFilter]}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      Na Rua: <span className="font-semibold text-blue-500">{formatCurrency(activeValue)}</span>
                    </span>
                  </>
                );
              })()}
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <span className="hidden sm:inline">{filtersOpen ? 'Ocultar' : 'Ver Filtros'}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", filtersOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent className="pt-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {/* Card Todos */}
              {(() => {
                const isActive = paymentTypeFilter === 'all';
                const allActiveLoans = stats.allLoans.filter(loan => loan.status !== 'paid');
                const allTotalOnStreet = allActiveLoans.reduce((sum, loan) => {
                  const principal = Number(loan.principal_amount);
                  const payments = (loan as any).payments || [];
                  const totalPrincipalPaid = payments.reduce((s: number, p: any) => s + Number(p.principal_paid || 0), 0);
                  return sum + (principal - totalPrincipalPaid);
                }, 0);
                const allRealizedProfit = stats.allLoans.reduce((sum, loan) => {
                  const payments = (loan as any).payments || [];
                  return sum + payments.reduce((s: number, p: any) => s + Number(p.interest_paid || 0), 0);
                }, 0);
                
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card 
                      className={cn(
                        "cursor-pointer transition-all border-2",
                        isActive 
                          ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20" 
                          : "border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5"
                      )}
                      onClick={() => setPaymentTypeFilter('all')}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn(
                            "p-1.5 rounded-lg",
                            isActive ? "bg-violet-500/20" : "bg-violet-500/10"
                          )}>
                            <Users className={cn(
                              "w-3.5 h-3.5",
                              isActive ? "text-violet-500" : "text-violet-400"
                            )} />
                          </div>
                          <span className={cn(
                            "text-xs font-medium",
                            isActive ? "text-violet-500" : "text-foreground"
                          )}>
                            Todos
                          </span>
                          {isActive && (
                            <Badge className="ml-auto bg-violet-500 text-white text-[10px] px-1.5 py-0">
                              Ativo
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Na Rua</span>
                            <span className="text-xs font-bold text-blue-500">
                              {formatCurrency(allTotalOnStreet)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Lucro</span>
                            <span className="text-xs font-bold text-emerald-500">
                              {formatCurrency(allRealizedProfit)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-border/50">
                            <span className="text-[10px] text-muted-foreground">Contratos</span>
                            <span className="text-xs font-medium">
                              {allActiveLoans.length} ativos
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })()}

              {/* Cards por tipo */}
              {statsByPaymentType.map((typeStat) => {
                const isActive = paymentTypeFilter === typeStat.type;
                const typeConfig: Record<string, { icon: React.ElementType; borderColor: string; bgColor: string; textColor: string }> = {
                  daily: { 
                    icon: CalendarDays, 
                    borderColor: 'border-orange-500', 
                    bgColor: 'bg-orange-500', 
                    textColor: 'text-orange-500' 
                  },
                  weekly: { 
                    icon: CalendarRange, 
                    borderColor: 'border-blue-500', 
                    bgColor: 'bg-blue-500', 
                    textColor: 'text-blue-500' 
                  },
                  biweekly: { 
                    icon: CalendarCheck, 
                    borderColor: 'border-cyan-500', 
                    bgColor: 'bg-cyan-500', 
                    textColor: 'text-cyan-500' 
                  },
                  installment: { 
                    icon: CalendarIcon, 
                    borderColor: 'border-emerald-500', 
                    bgColor: 'bg-emerald-500', 
                    textColor: 'text-emerald-500' 
                  },
                };
                const config = typeConfig[typeStat.type] || typeConfig.installment;
                const TypeIcon = config.icon;
                
                return (
                  <motion.div
                    key={typeStat.type}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card 
                      className={cn(
                        "cursor-pointer transition-all border-2",
                        isActive 
                          ? `${config.borderColor} ${config.bgColor}/10 shadow-lg` 
                          : `${config.borderColor}/30 hover:${config.borderColor}/60 hover:${config.bgColor}/5`
                      )}
                      onClick={() => setPaymentTypeFilter(isActive ? 'all' : typeStat.type)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn(
                            "p-1.5 rounded-lg",
                            isActive ? `${config.bgColor}/20` : `${config.bgColor}/10`
                          )}>
                            <TypeIcon className={cn(
                              "w-3.5 h-3.5",
                              isActive ? config.textColor : `${config.textColor}/70`
                            )} />
                          </div>
                          <span className={cn(
                            "text-xs font-medium",
                            isActive ? config.textColor : "text-foreground"
                          )}>
                            {typeStat.label}
                          </span>
                          {isActive && (
                            <Badge className={cn("ml-auto text-white text-[10px] px-1.5 py-0", config.bgColor)}>
                              Ativo
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Na Rua</span>
                            <span className="text-xs font-bold text-blue-500">
                              {formatCurrency(typeStat.totalOnStreet)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Lucro</span>
                            <span className="text-xs font-bold text-emerald-500">
                              {formatCurrency(typeStat.realizedProfit)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-border/50">
                            <span className="text-[10px] text-muted-foreground">Contratos</span>
                            <span className="text-xs font-medium">
                              {typeStat.count} ativos
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Cash Flow Card */}
        <CashFlowCard
          initialBalance={cashFlowStats.initialBalance}
          loanedInPeriod={cashFlowStats.loanedInPeriod}
          totalOnStreet={filteredStats.totalOnStreet}
          receivedInPeriod={cashFlowStats.receivedInPeriod}
          interestReceived={cashFlowStats.interestReceived}
          onUpdateInitialBalance={handleUpdateCashFlowBalance}
        />

        {/* Main Stats Grid - Filtered */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {stats.loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="💵 Capital na Rua"
                value={formatCurrency(filteredStats.totalOnStreet)}
                icon={Wallet}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle={`${filteredStats.activeLoansCount} contratos ativos`}
                compact
              />
              <StatCard
                label="💰 Juros a Receber"
                value={formatCurrency(filteredStats.pendingInterest)}
                icon={TrendingUp}
                iconColor="text-primary"
                bgColor="bg-primary/10"
                subtitle="Lucro pendente"
                compact
              />
              <StatCard
                label="✅ Total Recebido"
                value={formatCurrency(filteredStats.totalReceivedAllTime)}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                subtitle="Histórico"
                compact
              />
              <StatCard
                label="⏳ Falta Receber"
                value={formatCurrency(filteredStats.pendingAmount)}
                icon={Clock}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/10"
                subtitle="Saldo restante"
                compact
              />
              <StatCard
                label="🚨 Em Atraso"
                value={formatCurrency(filteredStats.overdueAmount)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                subtitle={`${filteredStats.overdueCount} contratos`}
                compact
              />
              <StatCard
                label="📊 Lucro Realizado"
                value={formatCurrency(filteredStats.realizedProfit)}
                icon={Percent}
                iconColor="text-purple-500"
                bgColor="bg-purple-500/10"
                subtitle="Juros já recebidos"
                compact
              />
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Evolution Chart */}
          <Card className="border-primary/30">
            <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Evolução Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 pt-0">
              <div className="h-[200px] sm:h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fontSize: 10 }} />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={10}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}
                      width={35}
                      className="hidden sm:block"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="naRua" 
                      name="Na Rua" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-1))', r: 2 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="recebido" 
                      name="Recebido" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))', r: 2 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lucro" 
                      name="Lucro" 
                      stroke="hsl(var(--chart-4))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-4))', r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats Chart */}
          <Card className="border-primary/30">
            <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Distribuição
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 pt-0">
              <div className="h-[200px] sm:h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Na Rua', value: filteredStats.totalOnStreet, fill: 'hsl(var(--chart-1))' },
                    { name: 'Recebido', value: filteredStats.totalReceivedAllTime, fill: 'hsl(var(--chart-2))' },
                    { name: 'Pendente', value: filteredStats.pendingAmount, fill: 'hsl(var(--chart-3))' },
                    { name: 'Atraso', value: filteredStats.overdueAmount, fill: 'hsl(var(--destructive))' },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fontSize: 9 }} />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={10}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}
                      width={35}
                      className="hidden sm:block"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Loans Table - Filtered */}
        <Card className="border-primary/30">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <span className="hidden sm:inline">Contratos Ativos (Na Rua)</span>
                <span className="sm:hidden">Ativos</span>
                {paymentTypeFilter !== 'all' && (
                  <Badge variant="outline" className="text-[10px] border-primary/50 text-primary ml-1">
                    {paymentTypeLabels[paymentTypeFilter]}
                  </Badge>
                )}
              </CardTitle>
              <Badge variant="outline" className="text-primary border-primary text-[10px] sm:text-xs">
                {filteredStats.activeLoansCount}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-right text-xs hidden sm:table-cell">Emprestado</TableHead>
                    <TableHead className="text-right text-xs hidden md:table-cell">Pago</TableHead>
                    <TableHead className="text-right text-xs">Falta</TableHead>
                    <TableHead className="text-center text-xs">Status</TableHead>
                    <TableHead className="text-right text-xs hidden lg:table-cell">Vencimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStats.activeLoans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs sm:text-sm">
                        Nenhum contrato ativo {paymentTypeFilter !== 'all' && `(${paymentTypeLabels[paymentTypeFilter]})`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStats.activeLoans.slice(0, 10).map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium text-xs sm:text-sm max-w-[100px] sm:max-w-none truncate">
                          {loan.client?.full_name || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                          {formatCurrency(loan.principal_amount)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-500 text-xs sm:text-sm hidden md:table-cell">
                          {formatCurrency(loan.total_paid || 0)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs sm:text-sm">
                          {formatCurrency(loan.remaining_balance)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(loan.status)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs sm:text-sm hidden lg:table-cell">
                          {formatDate(loan.due_date)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredStats.activeLoans.length > 10 && (
                <p className="text-center text-[10px] sm:text-sm text-muted-foreground py-3">
                  +{filteredStats.activeLoans.length - 10} contratos
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overdue Loans Table - Filtered */}
        {filteredStats.overdueLoans.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-lg flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Contratos em Atraso</span>
                  <span className="sm:hidden">Em Atraso</span>
                  {paymentTypeFilter !== 'all' && (
                    <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive ml-1">
                      {paymentTypeLabels[paymentTypeFilter]}
                    </Badge>
                  )}
                </CardTitle>
                <Badge className="bg-destructive text-destructive-foreground text-[10px] sm:text-xs">
                  {filteredStats.overdueCount}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 pt-0">
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-right text-xs">Atraso</TableHead>
                      <TableHead className="text-right text-xs hidden sm:table-cell">Emprestado</TableHead>
                      <TableHead className="text-right text-xs hidden md:table-cell">Vencimento</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStats.overdueLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium text-xs sm:text-sm max-w-[100px] sm:max-w-none truncate">
                          {loan.client?.full_name || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-destructive text-xs sm:text-sm">
                          {formatCurrency(loan.remaining_balance)}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                          {formatCurrency(loan.principal_amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs sm:text-sm hidden md:table-cell">
                          {formatDate(loan.due_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs sm:text-sm hidden lg:table-cell">
                          {loan.client?.phone || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
