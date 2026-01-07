import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { getDaysOverdue, calculateDynamicOverdueInterest, getOverdueConfigFromNotes } from '@/lib/calculations';

export interface DashboardStats {
  totalLoaned: number;
  totalReceived: number;
  totalPending: number;
  totalToReceive: number;
  overdueCount: number;
  upcomingDue: number;
  activeClients: number;
  // New metrics
  contractsThisWeek: number;
  receivedThisWeek: number;
  dueToday: number;
  // Per business type
  loanCount: number;
  loansThisWeek: number;
  productSalesCount: number;
  productSalesThisWeek: number;
  vehiclesCount: number;
  vehiclesThisWeek: number;
  contractsCount: number;
  contractsThisWeekCount: number;
}

const defaultStats: DashboardStats = {
  totalLoaned: 0,
  totalReceived: 0,
  totalPending: 0,
  totalToReceive: 0,
  overdueCount: 0,
  upcomingDue: 0,
  activeClients: 0,
  contractsThisWeek: 0,
  receivedThisWeek: 0,
  dueToday: 0,
  loanCount: 0,
  loansThisWeek: 0,
  productSalesCount: 0,
  productSalesThisWeek: 0,
  vehiclesCount: 0,
  vehiclesThisWeek: 0,
  contractsCount: 0,
  contractsThisWeekCount: 0,
};

async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  // Usar função RPC otimizada para estatísticas de empréstimos
  const [
    { data: loanStats, error: loanStatsError },
    { count: loanCount },
    { count: loansThisWeek },
    { count: productSalesCount },
    { count: productSalesThisWeek },
    { count: vehiclesCount },
    { count: vehiclesThisWeek },
    { count: contractsCount },
    { count: contractsThisWeek },
    { data: productPaymentsThisWeek },
    { data: vehiclePaymentsThisWeek },
    { data: contractPaymentsThisWeek },
  ] = await Promise.all([
    // Função RPC para estatísticas principais (otimizada no banco)
    supabase.rpc('get_dashboard_stats', { p_user_id: userId }),
    // Counts simples (muito rápidos com índices)
    supabase.from('loans').select('id', { count: 'exact', head: true }),
    supabase.from('loans').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
    supabase.from('product_sales').select('id', { count: 'exact', head: true }),
    supabase.from('product_sales').select('id', { count: 'exact', head: true }).gte('sale_date', weekAgoStr),
    supabase.from('vehicles').select('id', { count: 'exact', head: true }),
    supabase.from('vehicles').select('id', { count: 'exact', head: true }).gte('purchase_date', weekAgoStr),
    supabase.from('contracts').select('id', { count: 'exact', head: true }),
    supabase.from('contracts').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
    // Pagamentos desta semana (com limite e campos mínimos)
    supabase.from('product_sale_payments').select('amount').eq('status', 'paid').gte('paid_date', weekAgoStr).lte('paid_date', todayStr),
    supabase.from('vehicle_payments').select('amount').eq('status', 'paid').gte('paid_date', weekAgoStr).lte('paid_date', todayStr),
    supabase.from('contract_payments').select('amount').eq('status', 'paid').gte('paid_date', weekAgoStr).lte('paid_date', todayStr),
  ]);

  if (loanStatsError) {
    console.error('Error fetching dashboard stats:', loanStatsError);
  }

  // Extrair dados da função RPC (retorna array com 1 row)
  const rpcData = Array.isArray(loanStats) ? loanStats[0] : loanStats;
  
  // Calcular juros dinâmicos por atraso (OVERDUE_CONFIG)
  // Buscar empréstimos em atraso para calcular juros dinâmicos
  const { data: overdueLoans } = await supabase
    .from('loans')
    .select('id, notes, remaining_balance, due_date, installments, total_interest, principal_amount, interest_rate, interest_mode, payment_type, installment_dates, total_paid, status')
    .neq('status', 'paid')
    .lt('due_date', todayStr);

  let totalOverdueInterest = 0;
  overdueLoans?.forEach(loan => {
    // Verificar se tem configuração de juros por atraso
    const config = getOverdueConfigFromNotes(loan.notes);
    if (config.type && config.value > 0) {
      const daysOver = getDaysOverdue(loan as any);
      totalOverdueInterest += calculateDynamicOverdueInterest(loan as any, daysOver);
    }
  });
  
  // Calcular recebido esta semana (já inclui empréstimos via RPC)
  let receivedThisWeek = Number(rpcData?.received_this_week || 0);
  if (productPaymentsThisWeek) {
    receivedThisWeek += productPaymentsThisWeek.reduce((sum, p) => sum + Number(p.amount), 0);
  }
  if (vehiclePaymentsThisWeek) {
    receivedThisWeek += vehiclePaymentsThisWeek.reduce((sum, p) => sum + Number(p.amount), 0);
  }
  if (contractPaymentsThisWeek) {
    receivedThisWeek += contractPaymentsThisWeek.reduce((sum, p) => sum + Number(p.amount), 0);
  }

  // Total de contratos esta semana
  const contractsThisWeekTotal = 
    (loansThisWeek || 0) + 
    (productSalesThisWeek || 0) + 
    (vehiclesThisWeek || 0) + 
    (contractsThisWeek || 0);

  return {
    totalLoaned: Number(rpcData?.total_loaned || 0),
    totalReceived: Number(rpcData?.total_received || 0),
    totalPending: Math.max(0, Number(rpcData?.total_pending || 0)),
    totalToReceive: Number(rpcData?.total_pending || 0) + Number(rpcData?.pending_interest || 0) + totalOverdueInterest,
    overdueCount: Number(rpcData?.overdue_count || 0),
    upcomingDue: 0, // Removido para performance - pode ser adicionado depois se necessário
    activeClients: Number(rpcData?.active_clients || 0),
    contractsThisWeek: contractsThisWeekTotal,
    receivedThisWeek,
    dueToday: Number(rpcData?.due_today_count || 0),
    loanCount: loanCount || 0,
    loansThisWeek: loansThisWeek || 0,
    productSalesCount: productSalesCount || 0,
    productSalesThisWeek: productSalesThisWeek || 0,
    vehiclesCount: vehiclesCount || 0,
    vehiclesThisWeek: vehiclesThisWeek || 0,
    contractsCount: contractsCount || 0,
    contractsThisWeekCount: contractsThisWeek || 0,
  };
}

export function useDashboardStats() {
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();

  const userId = effectiveUserId || user?.id;

  const { data: stats = defaultStats, isLoading: loading, refetch } = useQuery({
    queryKey: ['dashboard-stats', userId],
    queryFn: () => fetchDashboardStats(userId!),
    enabled: !!userId && !employeeLoading,
    staleTime: 1000 * 60 * 2, // 2 minutos
    gcTime: 1000 * 60 * 5, // 5 minutos (anteriormente cacheTime)
  });

  return { stats, loading, refetch };
}
