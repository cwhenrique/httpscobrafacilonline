import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useLoans } from '@/hooks/useLoans';
import { useProductSales, useProductSalePayments } from '@/hooks/useProductSales';
import { useContracts } from '@/hooks/useContracts';
import { useVehicles, useVehiclePayments } from '@/hooks/useVehicles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/calculations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, AlertTriangle, Banknote, Package, FileText, Car, Percent, Users, Clock, Target, CheckCircle, XCircle, ArrowUpDown, PiggyBank } from 'lucide-react';

// Helper component for metric cards
const MetricCard = ({ 
  label, 
  value, 
  icon: Icon, 
  iconColor = 'text-primary', 
  bgColor = 'bg-primary/10',
  valueColor = '',
  subtitle = ''
}: { 
  label: string; 
  value: string | number; 
  icon: React.ElementType; 
  iconColor?: string; 
  bgColor?: string;
  valueColor?: string;
  subtitle?: string;
}) => (
  <Card className="shadow-soft">
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={`p-2 sm:p-3 rounded-xl ${bgColor} shrink-0`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{label}</p>
          <p className={`text-sm sm:text-lg font-bold truncate ${valueColor}`}>{value}</p>
          {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function Reports() {
  const [activeTab, setActiveTab] = useState('loans');
  const { stats } = useDashboardStats();
  const { loans } = useLoans();
  const { sales } = useProductSales();
  const { payments: productPayments } = useProductSalePayments();
  const { contracts } = useContracts();
  const { vehicles } = useVehicles();
  const { payments: vehiclePayments } = useVehiclePayments();

  // LOAN DETAILED STATS
  const loanStats = useMemo(() => {
    const totalLoaned = loans.reduce((sum, l) => sum + l.principal_amount, 0);
    const totalReceived = loans.reduce((sum, l) => sum + (l.total_paid || 0), 0);
    
    // Calculate total interest to receive
    let totalInterestToReceive = 0;
    let totalInterestReceived = 0;
    
    loans.forEach(loan => {
      const numInstallments = loan.installments || 1;
      const isDaily = loan.payment_type === 'daily';
      
      let loanTotalInterest = 0;
      if (isDaily) {
        // For daily loans, profit is stored in interest_rate field
        loanTotalInterest = loan.interest_rate || 0;
      } else {
        // For regular loans
        if (loan.interest_mode === 'on_total') {
          loanTotalInterest = loan.principal_amount * (loan.interest_rate / 100);
        } else {
          loanTotalInterest = loan.principal_amount * (loan.interest_rate / 100) * numInstallments;
        }
        // Use stored total_interest if available and higher (includes penalties)
        if (loan.total_interest && loan.total_interest > loanTotalInterest) {
          loanTotalInterest = loan.total_interest;
        }
      }
      
      totalInterestToReceive += loanTotalInterest;
      
      // Calculate proportional interest received
      const totalToReceive = loan.principal_amount + loanTotalInterest;
      const proportionPaid = totalToReceive > 0 ? (loan.total_paid || 0) / totalToReceive : 0;
      totalInterestReceived += loanTotalInterest * proportionPaid;
    });
    
    // Overdue calculations
    const overdueLoans = loans.filter(l => l.status === 'overdue');
    const totalOverdueAmount = overdueLoans.reduce((sum, l) => sum + l.remaining_balance, 0);
    const overdueClientsSet = new Set(overdueLoans.map(l => l.client_id));
    const overdueClientsCount = overdueClientsSet.size;
    
    // Paid loans
    const paidLoans = loans.filter(l => l.status === 'paid');
    const paidLoansCount = paidLoans.length;
    
    // Profit (received - loaned)
    const realizedProfit = Math.max(0, totalReceived - totalLoaned);
    
    // Delinquency rate
    const delinquencyRate = loans.length > 0 ? (overdueLoans.length / loans.length) * 100 : 0;
    
    // Average ticket
    const averageTicket = loans.length > 0 ? totalLoaned / loans.length : 0;
    
    // Weighted average interest rate
    const totalWeightedRate = loans.reduce((sum, l) => {
      if (l.payment_type === 'daily') return sum;
      return sum + (l.interest_rate * l.principal_amount);
    }, 0);
    const nonDailyLoans = loans.filter(l => l.payment_type !== 'daily');
    const nonDailyTotal = nonDailyLoans.reduce((sum, l) => sum + l.principal_amount, 0);
    const averageInterestRate = nonDailyTotal > 0 ? totalWeightedRate / nonDailyTotal : 0;
    
    // Interest still pending (not yet received)
    const interestPending = totalInterestToReceive - totalInterestReceived;
    
    return {
      totalLoaned,
      totalReceived,
      totalInterestToReceive,
      totalInterestReceived,
      interestPending,
      totalOverdueAmount,
      overdueClientsCount,
      overdueLoansCount: overdueLoans.length,
      paidLoansCount,
      realizedProfit,
      delinquencyRate,
      averageTicket,
      averageInterestRate,
      totalLoans: loans.length
    };
  }, [loans]);

  const overdueLoans = loans.filter(l => l.status === 'overdue');

  // Loan chart data
  const loanChartData = [
    { name: 'Emprestado', value: loanStats.totalLoaned, fill: 'hsl(var(--chart-1))' },
    { name: 'Juros Total', value: loanStats.totalInterestToReceive, fill: 'hsl(var(--chart-4))' },
    { name: 'Recebido', value: loanStats.totalReceived, fill: 'hsl(var(--chart-2))' },
    { name: 'Em Atraso', value: loanStats.totalOverdueAmount, fill: 'hsl(var(--chart-3))' },
  ];

  const loanPieData = [
    { name: 'Recebido', value: loanStats.totalReceived },
    { name: 'Juros Pendentes', value: loanStats.interestPending },
    { name: 'Em Atraso', value: loanStats.totalOverdueAmount },
  ];

  // PRODUCT SALES DETAILED STATS
  const productStats = useMemo(() => {
    const totalSold = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalCost = sales.reduce((sum, s) => sum + ((s as any).cost_value || 0), 0);
    const totalProfit = totalSold - totalCost;
    const totalReceived = sales.reduce((sum, s) => sum + (s.total_paid || 0), 0);
    const totalPending = sales.reduce((sum, s) => sum + s.remaining_balance, 0);
    
    // Overdue sales
    const overdueSales = sales.filter(s => {
      const hasOverduePayment = productPayments.some(p => 
        p.product_sale_id === s.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
      return hasOverduePayment;
    });
    const totalOverdueAmount = overdueSales.reduce((sum, s) => sum + s.remaining_balance, 0);
    
    // Paid sales
    const paidSales = sales.filter(s => s.status === 'paid');
    
    // Realized profit (proportional to received)
    const realizedProfit = totalSold > 0 ? (totalReceived / totalSold) * totalProfit : 0;
    
    // Profit margin
    const profitMargin = totalSold > 0 ? (totalProfit / totalSold) * 100 : 0;
    
    // Average ticket
    const averageTicket = sales.length > 0 ? totalSold / sales.length : 0;
    
    // Delinquency rate
    const delinquencyRate = sales.length > 0 ? (overdueSales.length / sales.length) * 100 : 0;
    
    return { 
      totalSold, 
      totalCost, 
      totalProfit, 
      totalReceived, 
      totalPending, 
      overdueSales,
      totalOverdueAmount,
      paidSalesCount: paidSales.length,
      realizedProfit,
      profitMargin,
      averageTicket,
      delinquencyRate,
      totalSales: sales.length
    };
  }, [sales, productPayments]);

  const productChartData = [
    { name: 'Custo', value: productStats.totalCost, fill: 'hsl(var(--chart-4))' },
    { name: 'Vendido', value: productStats.totalSold, fill: 'hsl(var(--chart-1))' },
    { name: 'Lucro', value: productStats.totalProfit, fill: 'hsl(var(--chart-2))' },
    { name: 'Recebido', value: productStats.totalReceived, fill: 'hsl(var(--chart-5))' },
    { name: 'Em Atraso', value: productStats.totalOverdueAmount, fill: 'hsl(var(--chart-3))' },
  ];

  const productPieData = [
    { name: 'Recebido', value: productStats.totalReceived },
    { name: 'Pendente', value: productStats.totalPending },
  ];

  // CONTRACT DETAILED STATS
  const contractStats = useMemo(() => {
    const receivableContracts = contracts.filter(c => c.bill_type === 'receivable');
    const payableContracts = contracts.filter(c => c.bill_type === 'payable');
    
    const totalReceivable = receivableContracts.reduce((sum, c) => sum + c.amount_to_receive, 0);
    const totalPayable = payableContracts.reduce((sum, c) => sum + c.amount_to_receive, 0);
    const totalContracts = contracts.reduce((sum, c) => sum + c.total_amount, 0);
    
    // Net balance
    const netBalance = totalReceivable - totalPayable;
    
    // Overdue receivables
    const overdueReceivables = receivableContracts.filter(c => c.status === 'overdue' || 
      (c.status === 'active' && new Date(c.first_payment_date) < new Date()));
    const overdueReceivableAmount = overdueReceivables.reduce((sum, c) => sum + c.amount_to_receive, 0);
    
    // Overdue payables
    const overduePayables = payableContracts.filter(c => c.status === 'overdue' ||
      (c.status === 'active' && new Date(c.first_payment_date) < new Date()));
    const overduePayableAmount = overduePayables.reduce((sum, c) => sum + c.amount_to_receive, 0);
    
    // Paid contracts
    const paidReceivables = receivableContracts.filter(c => c.status === 'paid');
    const paidPayables = payableContracts.filter(c => c.status === 'paid');
    
    // Active contracts
    const activeReceivables = receivableContracts.filter(c => c.status === 'active');
    const activePayables = payableContracts.filter(c => c.status === 'active');
    
    return { 
      totalReceivable, 
      totalPayable, 
      totalContracts, 
      netBalance,
      receivableCount: receivableContracts.length,
      payableCount: payableContracts.length,
      overdueReceivableAmount,
      overduePayableAmount,
      overdueReceivablesCount: overdueReceivables.length,
      overduePayablesCount: overduePayables.length,
      paidReceivablesCount: paidReceivables.length,
      paidPayablesCount: paidPayables.length,
      activeReceivablesCount: activeReceivables.length,
      activePayablesCount: activePayables.length
    };
  }, [contracts]);

  const contractChartData = [
    { name: 'A Receber', value: contractStats.totalReceivable, fill: 'hsl(var(--chart-2))' },
    { name: 'A Pagar', value: contractStats.totalPayable, fill: 'hsl(var(--chart-3))' },
    { name: 'Saldo Líquido', value: Math.abs(contractStats.netBalance), fill: contractStats.netBalance >= 0 ? 'hsl(var(--chart-5))' : 'hsl(var(--chart-4))' },
  ];

  const contractPieData = [
    { name: 'A Receber', value: contractStats.totalReceivable },
    { name: 'A Pagar', value: contractStats.totalPayable },
  ];

  // VEHICLE DETAILED STATS
  const vehicleStats = useMemo(() => {
    const totalSold = vehicles.reduce((sum, v) => sum + v.purchase_value, 0);
    const totalCost = vehicles.reduce((sum, v) => sum + ((v as any).cost_value || 0), 0);
    const totalProfit = totalSold - totalCost;
    const totalReceived = vehicles.reduce((sum, v) => sum + (v.total_paid || 0), 0);
    const totalPending = vehicles.reduce((sum, v) => sum + v.remaining_balance, 0);
    
    // Overdue vehicles
    const overdueVehicles = vehicles.filter(v => {
      const hasOverduePayment = vehiclePayments.some(p => 
        p.vehicle_id === v.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
      return hasOverduePayment;
    });
    const totalOverdueAmount = overdueVehicles.reduce((sum, v) => sum + v.remaining_balance, 0);
    
    // Paid vehicles
    const paidVehicles = vehicles.filter(v => v.status === 'paid');
    
    // Realized profit (proportional to received)
    const realizedProfit = totalSold > 0 ? (totalReceived / totalSold) * totalProfit : 0;
    
    // Profit margin
    const profitMargin = totalSold > 0 ? (totalProfit / totalSold) * 100 : 0;
    
    // Average ticket
    const averageTicket = vehicles.length > 0 ? totalSold / vehicles.length : 0;
    
    // Delinquency rate
    const delinquencyRate = vehicles.length > 0 ? (overdueVehicles.length / vehicles.length) * 100 : 0;
    
    return { 
      totalSold, 
      totalCost, 
      totalProfit, 
      totalReceived, 
      totalPending, 
      overdueVehicles,
      totalOverdueAmount,
      paidVehiclesCount: paidVehicles.length,
      realizedProfit,
      profitMargin,
      averageTicket,
      delinquencyRate,
      totalVehicles: vehicles.length
    };
  }, [vehicles, vehiclePayments]);

  const vehicleChartData = [
    { name: 'Custo', value: vehicleStats.totalCost, fill: 'hsl(var(--chart-4))' },
    { name: 'Vendido', value: vehicleStats.totalSold, fill: 'hsl(var(--chart-1))' },
    { name: 'Lucro', value: vehicleStats.totalProfit, fill: 'hsl(var(--chart-2))' },
    { name: 'Recebido', value: vehicleStats.totalReceived, fill: 'hsl(var(--chart-5))' },
    { name: 'Em Atraso', value: vehicleStats.totalOverdueAmount, fill: 'hsl(var(--chart-3))' },
  ];

  const vehiclePieData = [
    { name: 'Recebido', value: vehicleStats.totalReceived },
    { name: 'Pendente', value: vehicleStats.totalPending },
  ];

  const COLORS = ['hsl(var(--chart-2))', 'hsl(var(--chart-4))', 'hsl(var(--chart-3))'];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Análise financeira detalhada do seu sistema</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto flex flex-wrap w-full gap-1 p-1">
            <TabsTrigger value="loans" className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Banknote className="w-4 h-4 shrink-0" />
              <span className="truncate">Empréstimos</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Package className="w-4 h-4 shrink-0" />
              <span className="truncate">Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">Contratos</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="flex-1 min-w-[calc(50%-4px)] sm:min-w-0 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Car className="w-4 h-4 shrink-0" />
              <span className="truncate">Veículos</span>
            </TabsTrigger>
          </TabsList>

          {/* LOANS TAB */}
          <TabsContent value="loans" className="space-y-6 mt-4">
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Emprestado"
                value={formatCurrency(loanStats.totalLoaned)}
                icon={DollarSign}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
              <MetricCard
                label="Total Recebido"
                value={formatCurrency(loanStats.totalReceived)}
                icon={TrendingUp}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <MetricCard
                label="Juros a Receber"
                value={formatCurrency(loanStats.totalInterestToReceive)}
                icon={PiggyBank}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle={`${formatCurrency(loanStats.totalInterestReceived)} já recebido`}
              />
              <MetricCard
                label="Juros Pendentes"
                value={formatCurrency(loanStats.interestPending)}
                icon={Clock}
                iconColor="text-amber-500"
                bgColor="bg-amber-500/10"
              />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total em Atraso"
                value={formatCurrency(loanStats.totalOverdueAmount)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                valueColor="text-destructive"
                subtitle={`${loanStats.overdueLoansCount} empréstimos`}
              />
              <MetricCard
                label="Clientes Inadimplentes"
                value={loanStats.overdueClientsCount}
                icon={Users}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                valueColor="text-destructive"
              />
              <MetricCard
                label="Lucro Realizado"
                value={formatCurrency(loanStats.realizedProfit)}
                icon={Target}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                valueColor="text-emerald-500"
              />
              <MetricCard
                label="Empréstimos Quitados"
                value={loanStats.paidLoansCount}
                icon={CheckCircle}
                iconColor="text-success"
                bgColor="bg-success/10"
                subtitle={`de ${loanStats.totalLoans} total`}
              />
            </div>

            {/* Tertiary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="% Inadimplência"
                value={`${loanStats.delinquencyRate.toFixed(1)}%`}
                icon={Percent}
                iconColor={loanStats.delinquencyRate > 20 ? 'text-destructive' : loanStats.delinquencyRate > 10 ? 'text-amber-500' : 'text-success'}
                bgColor={loanStats.delinquencyRate > 20 ? 'bg-destructive/10' : loanStats.delinquencyRate > 10 ? 'bg-amber-500/10' : 'bg-success/10'}
              />
              <MetricCard
                label="Ticket Médio"
                value={formatCurrency(loanStats.averageTicket)}
                icon={ArrowUpDown}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
              />
              <MetricCard
                label="Taxa Média Juros"
                value={`${loanStats.averageInterestRate.toFixed(2)}%`}
                icon={Percent}
                iconColor="text-purple-500"
                bgColor="bg-purple-500/10"
              />
              <MetricCard
                label="Total Empréstimos"
                value={loanStats.totalLoans}
                icon={Banknote}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="shadow-soft">
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Resumo Financeiro</CardTitle></CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={loanChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Distribuição</CardTitle></CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={loanPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {loanPieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Inadimplentes</CardTitle></CardHeader>
              <CardContent className="p-2 sm:p-6">
                {overdueLoans.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Nenhum cliente inadimplente</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Valor</TableHead>
                          <TableHead className="text-xs">Saldo</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Venc.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overdueLoans.map((loan) => (
                          <TableRow key={loan.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{loan.client?.full_name}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{formatCurrency(loan.principal_amount)}</TableCell>
                            <TableCell className="font-semibold text-destructive text-xs sm:text-sm">{formatCurrency(loan.remaining_balance)}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{formatDate(loan.due_date)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRODUCTS TAB */}
          <TabsContent value="products" className="space-y-6 mt-4">
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Vendido"
                value={formatCurrency(productStats.totalSold)}
                icon={Package}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
              <MetricCard
                label="Custo Total"
                value={formatCurrency(productStats.totalCost)}
                icon={DollarSign}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
              />
              <MetricCard
                label="Lucro Bruto"
                value={formatCurrency(productStats.totalProfit)}
                icon={TrendingUp}
                iconColor={productStats.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}
                bgColor={productStats.totalProfit >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}
                valueColor={productStats.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}
              />
              <MetricCard
                label="Lucro Realizado"
                value={formatCurrency(productStats.realizedProfit)}
                icon={Target}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                valueColor="text-emerald-500"
                subtitle="Proporcional ao recebido"
              />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Recebido"
                value={formatCurrency(productStats.totalReceived)}
                icon={CheckCircle}
                iconColor="text-success"
                bgColor="bg-success/10"
              />
              <MetricCard
                label="Total Pendente"
                value={formatCurrency(productStats.totalPending)}
                icon={Clock}
                iconColor="text-amber-500"
                bgColor="bg-amber-500/10"
              />
              <MetricCard
                label="Em Atraso"
                value={formatCurrency(productStats.totalOverdueAmount)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                valueColor="text-destructive"
                subtitle={`${productStats.overdueSales.length} vendas`}
              />
              <MetricCard
                label="Margem de Lucro"
                value={`${productStats.profitMargin.toFixed(1)}%`}
                icon={Percent}
                iconColor={productStats.profitMargin >= 20 ? 'text-emerald-500' : productStats.profitMargin >= 10 ? 'text-amber-500' : 'text-destructive'}
                bgColor={productStats.profitMargin >= 20 ? 'bg-emerald-500/10' : productStats.profitMargin >= 10 ? 'bg-amber-500/10' : 'bg-destructive/10'}
              />
            </div>

            {/* Tertiary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Ticket Médio"
                value={formatCurrency(productStats.averageTicket)}
                icon={ArrowUpDown}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
              />
              <MetricCard
                label="% Inadimplência"
                value={`${productStats.delinquencyRate.toFixed(1)}%`}
                icon={XCircle}
                iconColor={productStats.delinquencyRate > 20 ? 'text-destructive' : productStats.delinquencyRate > 10 ? 'text-amber-500' : 'text-success'}
                bgColor={productStats.delinquencyRate > 20 ? 'bg-destructive/10' : productStats.delinquencyRate > 10 ? 'bg-amber-500/10' : 'bg-success/10'}
              />
              <MetricCard
                label="Vendas Quitadas"
                value={productStats.paidSalesCount}
                icon={CheckCircle}
                iconColor="text-success"
                bgColor="bg-success/10"
                subtitle={`de ${productStats.totalSales} total`}
              />
              <MetricCard
                label="Total Vendas"
                value={productStats.totalSales}
                icon={Package}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="shadow-soft">
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Resumo Financeiro</CardTitle></CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={productChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Distribuição</CardTitle></CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={productPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {productPieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Inadimplentes</CardTitle></CardHeader>
              <CardContent className="p-2 sm:p-6">
                {productStats.overdueSales.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Nenhum cliente inadimplente</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Produto</TableHead>
                          <TableHead className="text-xs">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productStats.overdueSales.map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{sale.client_name}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{sale.product_name}</TableCell>
                            <TableCell className="font-semibold text-destructive text-xs sm:text-sm">{formatCurrency(sale.remaining_balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTRACTS TAB */}
          <TabsContent value="contracts" className="space-y-6 mt-4">
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total a Receber"
                value={formatCurrency(contractStats.totalReceivable)}
                icon={TrendingUp}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                valueColor="text-emerald-500"
                subtitle={`${contractStats.receivableCount} contratos`}
              />
              <MetricCard
                label="Total a Pagar"
                value={formatCurrency(contractStats.totalPayable)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                valueColor="text-destructive"
                subtitle={`${contractStats.payableCount} contas`}
              />
              <MetricCard
                label="Saldo Líquido"
                value={formatCurrency(contractStats.netBalance)}
                icon={ArrowUpDown}
                iconColor={contractStats.netBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}
                bgColor={contractStats.netBalance >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}
                valueColor={contractStats.netBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}
                subtitle="Receitas - Despesas"
              />
              <MetricCard
                label="Valor Total"
                value={formatCurrency(contractStats.totalContracts)}
                icon={DollarSign}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
            </div>

            {/* Secondary Metrics - Overdue */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Em Atraso (Receber)"
                value={formatCurrency(contractStats.overdueReceivableAmount)}
                icon={Clock}
                iconColor="text-amber-500"
                bgColor="bg-amber-500/10"
                subtitle={`${contractStats.overdueReceivablesCount} contratos`}
              />
              <MetricCard
                label="Em Atraso (Pagar)"
                value={formatCurrency(contractStats.overduePayableAmount)}
                icon={XCircle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                valueColor="text-destructive"
                subtitle={`${contractStats.overduePayablesCount} contas`}
              />
              <MetricCard
                label="Contratos Ativos"
                value={contractStats.activeReceivablesCount}
                icon={FileText}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle="A receber"
              />
              <MetricCard
                label="Contas Ativas"
                value={contractStats.activePayablesCount}
                icon={FileText}
                iconColor="text-amber-500"
                bgColor="bg-amber-500/10"
                subtitle="A pagar"
              />
            </div>

            {/* Tertiary Metrics - Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Contratos Quitados"
                value={contractStats.paidReceivablesCount}
                icon={CheckCircle}
                iconColor="text-success"
                bgColor="bg-success/10"
                subtitle="Receitas recebidas"
              />
              <MetricCard
                label="Contas Pagas"
                value={contractStats.paidPayablesCount}
                icon={CheckCircle}
                iconColor="text-success"
                bgColor="bg-success/10"
                subtitle="Despesas quitadas"
              />
              <MetricCard
                label="Total Contratos"
                value={contractStats.receivableCount}
                icon={FileText}
                iconColor="text-primary"
                bgColor="bg-primary/10"
                subtitle="Receitas"
              />
              <MetricCard
                label="Total Contas"
                value={contractStats.payableCount}
                icon={FileText}
                iconColor="text-primary"
                bgColor="bg-primary/10"
                subtitle="Despesas"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="shadow-soft">
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Resumo Financeiro</CardTitle></CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={contractChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Distribuição</CardTitle></CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={contractPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {contractPieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Lista de Contratos</CardTitle></CardHeader>
              <CardContent className="p-2 sm:p-6">
                {contracts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Nenhum contrato cadastrado</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Valor</TableHead>
                          <TableHead className="text-xs">Parcelas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contracts.slice(0, 10).map((contract) => (
                          <TableRow key={contract.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{contract.client_name}</TableCell>
                            <TableCell>
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs ${
                                contract.bill_type === 'receivable' 
                                  ? 'bg-success/10 text-success' 
                                  : 'bg-destructive/10 text-destructive'
                              }`}>
                                {contract.bill_type === 'receivable' ? 'Receber' : 'Pagar'}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{formatCurrency(contract.total_amount)}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{contract.installments}x</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VEHICLES TAB */}
          <TabsContent value="vehicles" className="space-y-6 mt-4">
            {/* Primary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Vendido"
                value={formatCurrency(vehicleStats.totalSold)}
                icon={Car}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
              <MetricCard
                label="Custo Total"
                value={formatCurrency(vehicleStats.totalCost)}
                icon={DollarSign}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
              />
              <MetricCard
                label="Lucro Bruto"
                value={formatCurrency(vehicleStats.totalProfit)}
                icon={TrendingUp}
                iconColor={vehicleStats.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}
                bgColor={vehicleStats.totalProfit >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}
                valueColor={vehicleStats.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}
              />
              <MetricCard
                label="Lucro Realizado"
                value={formatCurrency(vehicleStats.realizedProfit)}
                icon={Target}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                valueColor="text-emerald-500"
                subtitle="Proporcional ao recebido"
              />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Total Recebido"
                value={formatCurrency(vehicleStats.totalReceived)}
                icon={CheckCircle}
                iconColor="text-success"
                bgColor="bg-success/10"
              />
              <MetricCard
                label="Total Pendente"
                value={formatCurrency(vehicleStats.totalPending)}
                icon={Clock}
                iconColor="text-amber-500"
                bgColor="bg-amber-500/10"
              />
              <MetricCard
                label="Em Atraso"
                value={formatCurrency(vehicleStats.totalOverdueAmount)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                valueColor="text-destructive"
                subtitle={`${vehicleStats.overdueVehicles.length} veículos`}
              />
              <MetricCard
                label="Margem de Lucro"
                value={`${vehicleStats.profitMargin.toFixed(1)}%`}
                icon={Percent}
                iconColor={vehicleStats.profitMargin >= 20 ? 'text-emerald-500' : vehicleStats.profitMargin >= 10 ? 'text-amber-500' : 'text-destructive'}
                bgColor={vehicleStats.profitMargin >= 20 ? 'bg-emerald-500/10' : vehicleStats.profitMargin >= 10 ? 'bg-amber-500/10' : 'bg-destructive/10'}
              />
            </div>

            {/* Tertiary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Ticket Médio"
                value={formatCurrency(vehicleStats.averageTicket)}
                icon={ArrowUpDown}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
              />
              <MetricCard
                label="% Inadimplência"
                value={`${vehicleStats.delinquencyRate.toFixed(1)}%`}
                icon={XCircle}
                iconColor={vehicleStats.delinquencyRate > 20 ? 'text-destructive' : vehicleStats.delinquencyRate > 10 ? 'text-amber-500' : 'text-success'}
                bgColor={vehicleStats.delinquencyRate > 20 ? 'bg-destructive/10' : vehicleStats.delinquencyRate > 10 ? 'bg-amber-500/10' : 'bg-success/10'}
              />
              <MetricCard
                label="Veículos Quitados"
                value={vehicleStats.paidVehiclesCount}
                icon={CheckCircle}
                iconColor="text-success"
                bgColor="bg-success/10"
                subtitle={`de ${vehicleStats.totalVehicles} total`}
              />
              <MetricCard
                label="Total Veículos"
                value={vehicleStats.totalVehicles}
                icon={Car}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="shadow-soft">
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Resumo Financeiro</CardTitle></CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={vehicleChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Distribuição</CardTitle></CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={vehiclePieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {vehiclePieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Inadimplentes</CardTitle></CardHeader>
              <CardContent className="p-2 sm:p-6">
                {vehicleStats.overdueVehicles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Nenhum cliente inadimplente</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Comprador</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Veículo</TableHead>
                          <TableHead className="text-xs">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vehicleStats.overdueVehicles.map((vehicle) => (
                          <TableRow key={vehicle.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{vehicle.buyer_name || 'N/A'}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{vehicle.brand} {vehicle.model}</TableCell>
                            <TableCell className="font-semibold text-destructive text-xs sm:text-sm">{formatCurrency(vehicle.remaining_balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
