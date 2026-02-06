import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useProductSales, useProductSalePayments } from '@/hooks/useProductSales';
import { useVehicles, useVehiclePayments } from '@/hooks/useVehicles';
import { useContracts } from '@/hooks/useContracts';
import { useMonthlyFees, useMonthlyFeePayments } from '@/hooks/useMonthlyFees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/calculations';
import { 
  Package, 
  Car, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  DollarSign,
  Percent,
  ShoppingBag,
  Truck,
  FileText,
  Repeat
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { subMonths, parseISO, startOfDay, endOfDay, isWithinInterval, format } from 'date-fns';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { PeriodFilter, PeriodType } from '@/components/reports/PeriodFilter';

// Stat Card Component
const StatCard = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  bgColor = 'bg-primary/10',
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor?: string;
  bgColor?: string;
  subtitle?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="border-primary/30 bg-card shadow-lg">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className={cn("p-3 rounded-xl shrink-0", bgColor)}>
            <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", iconColor)} />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-lg sm:text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function ReportsSales() {
  const [activeTab, setActiveTab] = useState('products');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Period filter state - default last 6 months
  const [startDate, setStartDate] = useState(() => subMonths(new Date(), 6));
  const [endDate, setEndDate] = useState(() => new Date());

  const { sales, isLoading: salesLoading } = useProductSales();
  const { payments: productPayments } = useProductSalePayments();
  const { vehicles, isLoading: vehiclesLoading } = useVehicles();
  const { payments: vehiclePayments } = useVehiclePayments();
  const { contracts, allContractPayments, isLoading: contractsLoading } = useContracts();
  const { fees: monthlyFees, isLoading: feesLoading } = useMonthlyFees();
  const { payments: feePayments } = useMonthlyFeePayments();

  const handlePeriodChange = (period: PeriodType, newStartDate: Date, newEndDate: Date) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Filter sales by period
  const filteredSales = useMemo(() => {
    if (!sales) return [];
    
    return sales.filter((sale: any) => {
      const saleDate = parseISO(sale.sale_date);
      return isWithinInterval(saleDate, { 
        start: startOfDay(startDate), 
        end: endOfDay(endDate) 
      });
    });
  }, [sales, startDate, endDate]);

  // Filter vehicles by period
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    
    return vehicles.filter((vehicle: any) => {
      const purchaseDate = parseISO(vehicle.purchase_date);
      return isWithinInterval(purchaseDate, { 
        start: startOfDay(startDate), 
        end: endOfDay(endDate) 
      });
    });
  }, [vehicles, startDate, endDate]);

  // Filter contracts by period (only receivable - a receber)
  const filteredContracts = useMemo(() => {
    if (!contracts) return [];
    
    return contracts.filter((contract: any) => {
      if (contract.bill_type !== 'receivable') return false;
      const contractDate = parseISO(contract.contract_date || contract.created_at);
      return isWithinInterval(contractDate, { 
        start: startOfDay(startDate), 
        end: endOfDay(endDate) 
      });
    });
  }, [contracts, startDate, endDate]);

  // Calculate payments received in period
  const paymentsInPeriod = useMemo(() => {
    let productReceived = 0;
    let vehicleReceived = 0;
    let contractReceived = 0;
    let subscriptionReceived = 0;
    
    productPayments?.forEach((payment: any) => {
      if (payment.status === 'paid' && payment.paid_date) {
        const paidDate = parseISO(payment.paid_date);
        if (isWithinInterval(paidDate, { 
          start: startOfDay(startDate), 
          end: endOfDay(endDate) 
        })) {
          productReceived += Number(payment.amount);
        }
      }
    });
    
    vehiclePayments?.forEach((payment: any) => {
      if (payment.status === 'paid' && payment.paid_date) {
        const paidDate = parseISO(payment.paid_date);
        if (isWithinInterval(paidDate, { 
          start: startOfDay(startDate), 
          end: endOfDay(endDate) 
        })) {
          vehicleReceived += Number(payment.amount);
        }
      }
    });

    // Contract payments
    allContractPayments?.forEach((payment: any) => {
      if (payment.status === 'paid' && payment.paid_date) {
        // Check if the contract is receivable
        const contract = contracts?.find((c: any) => c.id === payment.contract_id);
        if (contract?.bill_type !== 'receivable') return;
        
        const paidDate = parseISO(payment.paid_date);
        if (isWithinInterval(paidDate, { 
          start: startOfDay(startDate), 
          end: endOfDay(endDate) 
        })) {
          contractReceived += Number(payment.amount);
        }
      }
    });

    // Subscription payments
    feePayments?.forEach((payment: any) => {
      if (payment.status === 'paid' && payment.payment_date) {
        const paidDate = parseISO(payment.payment_date);
        if (isWithinInterval(paidDate, { 
          start: startOfDay(startDate), 
          end: endOfDay(endDate) 
        })) {
          subscriptionReceived += Number(payment.amount);
        }
      }
    });
    
    return { 
      productReceived, 
      vehicleReceived, 
      contractReceived,
      subscriptionReceived,
      total: productReceived + vehicleReceived + contractReceived + subscriptionReceived 
    };
  }, [productPayments, vehiclePayments, allContractPayments, feePayments, contracts, startDate, endDate]);

  // Product stats (filtered by period for flow metrics)
  const productStats = useMemo(() => {
    // Flow metrics - filtered by period
    let totalSold = 0;
    let totalCost = 0;
    
    filteredSales.forEach((sale: any) => {
      totalSold += Number(sale.total_amount);
      totalCost += Number(sale.cost_value || 0);
    });

    // Balance metrics - ALL active data (not filtered)
    let totalPending = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let activeCount = 0;
    let paidCount = 0;
    const overdueSales: any[] = [];

    sales?.forEach((sale: any) => {
      if (sale.status === 'paid') {
        paidCount++;
      } else {
        activeCount++;
        totalPending += Number(sale.remaining_balance || 0);
        
        // Find oldest overdue payment date
        const overduePayments = productPayments?.filter((p: any) => 
          p.product_sale_id === sale.id && 
          p.status === 'pending' && 
          new Date(p.due_date) < new Date()
        ) || [];
        
        if (overduePayments.length > 0) {
          // Get the oldest overdue date for sorting
          const oldestDueDate = overduePayments.reduce((oldest: Date, p: any) => {
            const dueDate = new Date(p.due_date);
            return dueDate < oldest ? dueDate : oldest;
          }, new Date(overduePayments[0].due_date));
          
          overdueCount++;
          totalOverdue += Number(sale.remaining_balance);
          overdueSales.push({ ...sale, oldestDueDate });
        }
      }
    });
    
    // Sort by oldest due date first (most urgent)
    overdueSales.sort((a, b) => a.oldestDueDate.getTime() - b.oldestDueDate.getTime());

    return {
      totalSold,
      totalCost,
      totalProfit: totalSold - totalCost,
      totalReceived: paymentsInPeriod.productReceived,
      totalPending,
      totalOverdue,
      paidCount,
      overdueCount,
      activeCount,
      overdueSales,
      salesCount: filteredSales.length,
    };
  }, [filteredSales, sales, productPayments, paymentsInPeriod]);

  // Vehicle stats (filtered by period for flow metrics)
  const vehicleStats = useMemo(() => {
    // Flow metrics - filtered by period
    let totalSold = 0;
    let totalCost = 0;
    
    filteredVehicles.forEach((vehicle: any) => {
      totalSold += Number(vehicle.purchase_value);
      totalCost += Number(vehicle.cost_value || 0);
    });

    // Balance metrics - ALL active data (not filtered)
    let totalPending = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let activeCount = 0;
    let paidCount = 0;
    const overdueVehicles: any[] = [];

    vehicles?.forEach((vehicle: any) => {
      if (vehicle.status === 'paid') {
        paidCount++;
      } else {
        activeCount++;
        totalPending += Number(vehicle.remaining_balance || 0);
        
        // Find oldest overdue payment date
        const overduePayments = vehiclePayments?.filter((p: any) => 
          p.vehicle_id === vehicle.id && 
          p.status === 'pending' && 
          new Date(p.due_date) < new Date()
        ) || [];
        
        if (overduePayments.length > 0) {
          // Get the oldest overdue date for sorting
          const oldestDueDate = overduePayments.reduce((oldest: Date, p: any) => {
            const dueDate = new Date(p.due_date);
            return dueDate < oldest ? dueDate : oldest;
          }, new Date(overduePayments[0].due_date));
          
          overdueCount++;
          totalOverdue += Number(vehicle.remaining_balance);
          overdueVehicles.push({ ...vehicle, oldestDueDate });
        }
      }
    });
    
    // Sort by oldest due date first (most urgent)
    overdueVehicles.sort((a, b) => a.oldestDueDate.getTime() - b.oldestDueDate.getTime());

    return {
      totalSold,
      totalCost,
      totalProfit: totalSold - totalCost,
      totalReceived: paymentsInPeriod.vehicleReceived,
      totalPending,
      totalOverdue,
      paidCount,
      overdueCount,
      activeCount,
      overdueVehicles,
      vehiclesCount: filteredVehicles.length,
    };
  }, [filteredVehicles, vehicles, vehiclePayments, paymentsInPeriod]);

  // Contract stats (only receivable contracts)
  const contractStats = useMemo(() => {
    // Flow metrics - filtered by period
    let totalValue = 0;
    
    filteredContracts.forEach((contract: any) => {
      totalValue += Number(contract.amount_to_receive);
    });

    // Balance metrics - ALL active receivable contracts
    let totalPending = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let activeCount = 0;
    let paidCount = 0;
    const overdueContracts: any[] = [];

    const receivableContracts = contracts?.filter((c: any) => c.bill_type === 'receivable') || [];

    receivableContracts.forEach((contract: any) => {
      if (contract.status === 'paid') {
        paidCount++;
      } else {
        activeCount++;
        
        // Calculate pending from contract payments
        const contractPaymentsList = allContractPayments?.filter((p: any) => p.contract_id === contract.id) || [];
        const paidAmount = contractPaymentsList
          .filter((p: any) => p.status === 'paid')
          .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        const pendingAmount = Number(contract.amount_to_receive) - paidAmount;
        
        totalPending += Math.max(0, pendingAmount);
        
        // Find oldest overdue payment date
        const overduePayments = contractPaymentsList.filter((p: any) => 
          p.status === 'pending' && 
          new Date(p.due_date) < new Date()
        );
        
        if (overduePayments.length > 0) {
          // Get the oldest overdue date for sorting
          const oldestDueDate = overduePayments.reduce((oldest: Date, p: any) => {
            const dueDate = new Date(p.due_date);
            return dueDate < oldest ? dueDate : oldest;
          }, new Date(overduePayments[0].due_date));
          
          overdueCount++;
          totalOverdue += Math.max(0, pendingAmount);
          overdueContracts.push({
            ...contract,
            pendingAmount: Math.max(0, pendingAmount),
            oldestDueDate
          });
        }
      }
    });
    
    // Sort by oldest due date first (most urgent)
    overdueContracts.sort((a, b) => a.oldestDueDate.getTime() - b.oldestDueDate.getTime());

    return {
      totalValue,
      totalReceived: paymentsInPeriod.contractReceived,
      totalPending,
      totalOverdue,
      paidCount,
      overdueCount,
      activeCount,
      overdueContracts,
      contractsCount: filteredContracts.length,
    };
  }, [filteredContracts, contracts, allContractPayments, paymentsInPeriod]);

  // Subscription stats
  const subscriptionStats = useMemo(() => {
    // Monthly recurring revenue (active subscriptions)
    const activeSubscriptions = monthlyFees?.filter((f: any) => f.is_active) || [];
    const monthlyRecurring = activeSubscriptions.reduce((sum: number, f: any) => sum + Number(f.amount), 0);

    // Balance metrics
    let totalPending = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    const overdueSubscriptions: any[] = [];

    // Get all pending/overdue payments
    feePayments?.forEach((payment: any) => {
      if (payment.status === 'pending' || payment.status === 'overdue') {
        const fee = monthlyFees?.find((f: any) => f.id === payment.monthly_fee_id);
        const isOverdue = new Date(payment.due_date) < new Date();
        
        if (isOverdue) {
          totalOverdue += Number(payment.amount);
          overdueCount++;
          
          // Add to overdue list with client info
          if (fee) {
            overdueSubscriptions.push({
              ...payment,
              clientName: fee.client?.full_name || 'Cliente',
              clientPhone: fee.client?.phone || null,
              description: fee.description || 'Assinatura',
              dueDateObj: new Date(payment.due_date),
            });
          }
        } else {
          totalPending += Number(payment.amount);
        }
      }
    });
    
    // Sort by oldest due date first (most urgent)
    overdueSubscriptions.sort((a, b) => a.dueDateObj.getTime() - b.dueDateObj.getTime());

    return {
      monthlyRecurring,
      totalReceived: paymentsInPeriod.subscriptionReceived,
      totalPending,
      totalOverdue,
      overdueCount,
      overdueSubscriptions,
      activeCount: activeSubscriptions.length,
    };
  }, [monthlyFees, feePayments, paymentsInPeriod]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: 'Produtos', value: productStats.totalSold, fill: CHART_COLORS[0] },
      { name: 'Veículos', value: vehicleStats.totalSold, fill: CHART_COLORS[1] },
      { name: 'Contratos', value: contractStats.totalValue, fill: CHART_COLORS[2] },
      { name: 'Assinaturas', value: subscriptionStats.totalReceived, fill: CHART_COLORS[3] },
    ].filter(item => item.value > 0);
  }, [productStats, vehicleStats, contractStats, subscriptionStats]);

  // Combined totals
  const combinedTotals = useMemo(() => {
    return {
      totalSold: productStats.totalSold + vehicleStats.totalSold + contractStats.totalValue,
      totalReceived: paymentsInPeriod.total,
      totalProfit: productStats.totalProfit + vehicleStats.totalProfit + contractStats.totalValue, // Contracts have no cost
      totalOverdue: productStats.totalOverdue + vehicleStats.totalOverdue + contractStats.totalOverdue + subscriptionStats.totalOverdue,
      overdueCount: productStats.overdueCount + vehicleStats.overdueCount + contractStats.overdueCount + subscriptionStats.overdueCount,
      itemsCount: productStats.salesCount + vehicleStats.vehiclesCount + contractStats.contractsCount,
    };
  }, [productStats, vehicleStats, contractStats, subscriptionStats, paymentsInPeriod]);

  const loading = salesLoading || vehiclesLoading || contractsLoading || feesLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display">Relatório de Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Produtos, Veículos, Contratos e Assinaturas
          </p>
        </div>

        {/* Period Filter */}
        <PeriodFilter
          period="custom"
          startDate={startDate}
          endDate={endDate}
          onPeriodChange={handlePeriodChange}
          onRefresh={handleRefresh}
          lastUpdated={lastUpdated}
        />

        {/* Combined Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Vendido no Período"
            value={formatCurrency(combinedTotals.totalSold)}
            icon={DollarSign}
            iconColor="text-primary"
            bgColor="bg-primary/10"
            subtitle={`${combinedTotals.itemsCount} vendas`}
          />
          <StatCard
            label="Recebido no Período"
            value={formatCurrency(combinedTotals.totalReceived)}
            icon={CheckCircle}
            iconColor="text-emerald-500"
            bgColor="bg-emerald-500/10"
          />
          <StatCard
            label="Lucro no Período"
            value={formatCurrency(combinedTotals.totalProfit)}
            icon={TrendingUp}
            iconColor="text-purple-500"
            bgColor="bg-purple-500/10"
            subtitle="Vendido - Custo"
          />
          <StatCard
            label="Em Atraso (Total)"
            value={formatCurrency(combinedTotals.totalOverdue)}
            icon={AlertTriangle}
            iconColor="text-destructive"
            bgColor="bg-destructive/10"
            subtitle={`${combinedTotals.overdueCount} itens`}
          />
        </div>

        {/* Distribution Chart */}
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Distribuição de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Products, Vehicles, Contracts, Subscriptions */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl">
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-2">
              <Car className="w-4 h-4" />
              <span className="hidden sm:inline">Veículos</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Contratos</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2">
              <Repeat className="w-4 h-4" />
              <span className="hidden sm:inline">Assinaturas</span>
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Vendido no Período"
                value={formatCurrency(productStats.totalSold)}
                icon={ShoppingBag}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle={`${productStats.salesCount} vendas`}
              />
              <StatCard
                label="Custo"
                value={formatCurrency(productStats.totalCost)}
                icon={DollarSign}
                iconColor="text-orange-500"
                bgColor="bg-orange-500/10"
              />
              <StatCard
                label="Lucro"
                value={formatCurrency(productStats.totalProfit)}
                icon={Percent}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <StatCard
                label="Pendente (Total)"
                value={formatCurrency(productStats.totalPending)}
                icon={Clock}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/10"
                subtitle="Todos ativos"
              />
            </div>

            {productStats.overdueSales.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    Vendas em Atraso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Valor em Atraso</TableHead>
                        <TableHead>Telefone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productStats.overdueSales.map((sale: any) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">{sale.product_name}</TableCell>
                          <TableCell>{sale.client_name}</TableCell>
                          <TableCell className="text-right text-destructive font-bold">
                            {formatCurrency(sale.remaining_balance)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{sale.client_phone || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Vehicles Tab */}
          <TabsContent value="vehicles" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Vendido no Período"
                value={formatCurrency(vehicleStats.totalSold)}
                icon={Truck}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle={`${vehicleStats.vehiclesCount} veículos`}
              />
              <StatCard
                label="Custo"
                value={formatCurrency(vehicleStats.totalCost)}
                icon={DollarSign}
                iconColor="text-orange-500"
                bgColor="bg-orange-500/10"
              />
              <StatCard
                label="Lucro"
                value={formatCurrency(vehicleStats.totalProfit)}
                icon={Percent}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <StatCard
                label="Pendente (Total)"
                value={formatCurrency(vehicleStats.totalPending)}
                icon={Clock}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/10"
                subtitle="Todos ativos"
              />
            </div>

            {vehicleStats.overdueVehicles.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    Veículos em Atraso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Veículo</TableHead>
                        <TableHead>Comprador</TableHead>
                        <TableHead className="text-right">Valor em Atraso</TableHead>
                        <TableHead>Telefone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicleStats.overdueVehicles.map((vehicle: any) => (
                        <TableRow key={vehicle.id}>
                          <TableCell className="font-medium">
                            {vehicle.brand} {vehicle.model} {vehicle.year}
                          </TableCell>
                          <TableCell>{vehicle.buyer_name || '-'}</TableCell>
                          <TableCell className="text-right text-destructive font-bold">
                            {formatCurrency(vehicle.remaining_balance)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{vehicle.buyer_phone || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Valor no Período"
                value={formatCurrency(contractStats.totalValue)}
                icon={FileText}
                iconColor="text-purple-500"
                bgColor="bg-purple-500/10"
                subtitle={`${contractStats.contractsCount} contratos`}
              />
              <StatCard
                label="Recebido no Período"
                value={formatCurrency(contractStats.totalReceived)}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <StatCard
                label="Pendente (Total)"
                value={formatCurrency(contractStats.totalPending)}
                icon={Clock}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/10"
                subtitle={`${contractStats.activeCount} ativos`}
              />
              <StatCard
                label="Em Atraso"
                value={formatCurrency(contractStats.totalOverdue)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                subtitle={`${contractStats.overdueCount} contratos`}
              />
            </div>

            {contractStats.overdueContracts.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    Contratos em Atraso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Valor em Atraso</TableHead>
                        <TableHead>Telefone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contractStats.overdueContracts.map((contract: any) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">{contract.contract_type}</TableCell>
                          <TableCell>{contract.client_name}</TableCell>
                          <TableCell className="text-right text-destructive font-bold">
                            {formatCurrency(contract.pendingAmount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{contract.client_phone || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Receita Mensal"
                value={formatCurrency(subscriptionStats.monthlyRecurring)}
                icon={Repeat}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle={`${subscriptionStats.activeCount} assinaturas ativas`}
              />
              <StatCard
                label="Recebido no Período"
                value={formatCurrency(subscriptionStats.totalReceived)}
                icon={CheckCircle}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
              />
              <StatCard
                label="Pendente"
                value={formatCurrency(subscriptionStats.totalPending)}
                icon={Clock}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/10"
              />
              <StatCard
                label="Em Atraso"
                value={formatCurrency(subscriptionStats.totalOverdue)}
                icon={AlertTriangle}
                iconColor="text-destructive"
                bgColor="bg-destructive/10"
                subtitle={`${subscriptionStats.overdueCount} cobranças`}
              />
            </div>

            {subscriptionStats.overdueSubscriptions.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    Assinaturas em Atraso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Telefone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptionStats.overdueSubscriptions.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.description}</TableCell>
                          <TableCell>{payment.clientName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(parseISO(payment.due_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-right text-destructive font-bold">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{payment.clientPhone || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
