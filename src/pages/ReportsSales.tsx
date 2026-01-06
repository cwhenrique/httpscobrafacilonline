import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useProductSales, useProductSalePayments } from '@/hooks/useProductSales';
import { useVehicles, useVehiclePayments } from '@/hooks/useVehicles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/calculations';
import { 
  Package, 
  Car, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  DollarSign,
  Percent,
  ShoppingBag,
  Truck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

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

  const { sales, isLoading: salesLoading } = useProductSales();
  const { payments: productPayments } = useProductSalePayments();
  const { vehicles, isLoading: vehiclesLoading } = useVehicles();
  const { payments: vehiclePayments } = useVehiclePayments();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Product stats
  const productStats = useMemo(() => {
    if (!sales) return {
      totalSold: 0,
      totalCost: 0,
      totalProfit: 0,
      totalReceived: 0,
      totalPending: 0,
      totalOverdue: 0,
      paidCount: 0,
      overdueCount: 0,
      activeCount: 0,
      overdueSales: [],
    };

    let totalSold = 0;
    let totalCost = 0;
    let totalReceived = 0;
    let paidCount = 0;
    let overdueCount = 0;
    let activeCount = 0;
    const overdueSales: any[] = [];

    sales.forEach((sale: any) => {
      totalSold += Number(sale.total_amount);
      totalCost += Number(sale.cost_value || 0);
      totalReceived += Number(sale.total_paid || 0);

      if (sale.status === 'paid') {
        paidCount++;
      } else {
        activeCount++;
        // Check if any payment is overdue
        const hasOverdue = productPayments?.some(p => 
          p.product_sale_id === sale.id && 
          p.status === 'pending' && 
          new Date(p.due_date) < new Date()
        );
        if (hasOverdue) {
          overdueCount++;
          overdueSales.push(sale);
        }
      }
    });

    return {
      totalSold,
      totalCost,
      totalProfit: totalSold - totalCost,
      totalReceived,
      totalPending: totalSold - totalReceived,
      totalOverdue: overdueSales.reduce((sum, s) => sum + Number(s.remaining_balance), 0),
      paidCount,
      overdueCount,
      activeCount,
      overdueSales,
    };
  }, [sales, productPayments]);

  // Vehicle stats
  const vehicleStats = useMemo(() => {
    if (!vehicles) return {
      totalSold: 0,
      totalCost: 0,
      totalProfit: 0,
      totalReceived: 0,
      totalPending: 0,
      totalOverdue: 0,
      paidCount: 0,
      overdueCount: 0,
      activeCount: 0,
      overdueVehicles: [],
    };

    let totalSold = 0;
    let totalCost = 0;
    let totalReceived = 0;
    let paidCount = 0;
    let overdueCount = 0;
    let activeCount = 0;
    const overdueVehicles: any[] = [];

    vehicles.forEach((vehicle: any) => {
      totalSold += Number(vehicle.purchase_value);
      totalCost += Number(vehicle.cost_value || 0);
      totalReceived += Number(vehicle.total_paid || 0);

      if (vehicle.status === 'paid') {
        paidCount++;
      } else {
        activeCount++;
        // Check if any payment is overdue
        const hasOverdue = vehiclePayments?.some(p => 
          p.vehicle_id === vehicle.id && 
          p.status === 'pending' && 
          new Date(p.due_date) < new Date()
        );
        if (hasOverdue) {
          overdueCount++;
          overdueVehicles.push(vehicle);
        }
      }
    });

    return {
      totalSold,
      totalCost,
      totalProfit: totalSold - totalCost,
      totalReceived,
      totalPending: totalSold - totalReceived,
      totalOverdue: overdueVehicles.reduce((sum, v) => sum + Number(v.remaining_balance), 0),
      paidCount,
      overdueCount,
      activeCount,
      overdueVehicles,
    };
  }, [vehicles, vehiclePayments]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      { name: 'Produtos', value: productStats.totalSold, fill: CHART_COLORS[0] },
      { name: 'Veículos', value: vehicleStats.totalSold, fill: CHART_COLORS[1] },
    ];
  }, [productStats, vehicleStats]);

  const loading = salesLoading || vehiclesLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">Relatório de Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Produtos e Veículos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Última atualização: {format(lastUpdated, "HH:mm", { locale: ptBR })}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Combined Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Vendido"
            value={formatCurrency(productStats.totalSold + vehicleStats.totalSold)}
            icon={DollarSign}
            iconColor="text-primary"
            bgColor="bg-primary/10"
            subtitle="Produtos + Veículos"
          />
          <StatCard
            label="Total Recebido"
            value={formatCurrency(productStats.totalReceived + vehicleStats.totalReceived)}
            icon={CheckCircle}
            iconColor="text-emerald-500"
            bgColor="bg-emerald-500/10"
          />
          <StatCard
            label="Lucro Total"
            value={formatCurrency(productStats.totalProfit + vehicleStats.totalProfit)}
            icon={TrendingUp}
            iconColor="text-purple-500"
            bgColor="bg-purple-500/10"
            subtitle="Vendido - Custo"
          />
          <StatCard
            label="Em Atraso"
            value={formatCurrency(productStats.totalOverdue + vehicleStats.totalOverdue)}
            icon={AlertTriangle}
            iconColor="text-destructive"
            bgColor="bg-destructive/10"
            subtitle={`${productStats.overdueCount + vehicleStats.overdueCount} itens`}
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

        {/* Tabs for Products and Vehicles */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="gap-2">
              <Car className="w-4 h-4" />
              Veículos
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Vendido"
                value={formatCurrency(productStats.totalSold)}
                icon={ShoppingBag}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle={`${sales?.length || 0} vendas`}
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
                label="Pendente"
                value={formatCurrency(productStats.totalPending)}
                icon={Clock}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/10"
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
                label="Vendido"
                value={formatCurrency(vehicleStats.totalSold)}
                icon={Truck}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                subtitle={`${vehicles?.length || 0} veículos`}
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
                label="Pendente"
                value={formatCurrency(vehicleStats.totalPending)}
                icon={Clock}
                iconColor="text-yellow-500"
                bgColor="bg-yellow-500/10"
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
