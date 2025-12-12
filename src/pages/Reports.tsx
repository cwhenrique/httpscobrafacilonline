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
import { DollarSign, TrendingUp, AlertTriangle, Banknote, Package, FileText, Car } from 'lucide-react';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('loans');
  const { stats } = useDashboardStats();
  const { loans } = useLoans();
  const { sales } = useProductSales();
  const { payments: productPayments } = useProductSalePayments();
  const { contracts } = useContracts();
  const { vehicles } = useVehicles();
  const { payments: vehiclePayments } = useVehiclePayments();

  const overdueLoans = loans.filter(l => l.status === 'overdue');

  // Loan stats
  const loanChartData = [
    { name: 'Emprestado', value: stats.totalLoaned, fill: 'hsl(var(--chart-1))' },
    { name: 'A Receber', value: stats.totalToReceive, fill: 'hsl(var(--chart-4))' },
    { name: 'Recebido', value: stats.totalReceived, fill: 'hsl(var(--chart-2))' },
    { name: 'Pendente', value: stats.totalPending, fill: 'hsl(var(--chart-3))' },
  ];

  const loanPieData = [
    { name: 'Recebido', value: stats.totalReceived },
    { name: 'Pendente', value: stats.totalPending },
  ];

  // Product sales stats
  const productStats = useMemo(() => {
    const totalSold = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalReceived = sales.reduce((sum, s) => sum + (s.total_paid || 0), 0);
    const totalPending = sales.reduce((sum, s) => sum + s.remaining_balance, 0);
    const overdueSales = sales.filter(s => {
      const hasOverduePayment = productPayments.some(p => 
        p.product_sale_id === s.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
      return hasOverduePayment;
    });
    
    return { totalSold, totalReceived, totalPending, overdueSales };
  }, [sales, productPayments]);

  const productChartData = [
    { name: 'Vendido', value: productStats.totalSold, fill: 'hsl(var(--chart-1))' },
    { name: 'Recebido', value: productStats.totalReceived, fill: 'hsl(var(--chart-2))' },
    { name: 'Pendente', value: productStats.totalPending, fill: 'hsl(var(--chart-3))' },
  ];

  const productPieData = [
    { name: 'Recebido', value: productStats.totalReceived },
    { name: 'Pendente', value: productStats.totalPending },
  ];

  // Contract stats
  const contractStats = useMemo(() => {
    const receivableContracts = contracts.filter(c => c.bill_type === 'receivable');
    const payableContracts = contracts.filter(c => c.bill_type === 'payable');
    
    const totalReceivable = receivableContracts.reduce((sum, c) => sum + c.amount_to_receive, 0);
    const totalPayable = payableContracts.reduce((sum, c) => sum + c.amount_to_receive, 0);
    const totalContracts = contracts.reduce((sum, c) => sum + c.total_amount, 0);
    
    const overdueContracts = contracts.filter(c => c.status === 'overdue' || c.status === 'active');
    
    return { 
      totalReceivable, 
      totalPayable, 
      totalContracts, 
      overdueContracts,
      receivableCount: receivableContracts.length,
      payableCount: payableContracts.length
    };
  }, [contracts]);

  const contractChartData = [
    { name: 'A Receber', value: contractStats.totalReceivable, fill: 'hsl(var(--chart-2))' },
    { name: 'A Pagar', value: contractStats.totalPayable, fill: 'hsl(var(--chart-3))' },
  ];

  const contractPieData = [
    { name: 'A Receber', value: contractStats.totalReceivable },
    { name: 'A Pagar', value: contractStats.totalPayable },
  ];

  // Vehicle stats
  const vehicleStats = useMemo(() => {
    const totalSold = vehicles.reduce((sum, v) => sum + v.purchase_value, 0);
    const totalCost = vehicles.reduce((sum, v) => sum + ((v as any).cost_value || 0), 0);
    const totalProfit = totalSold - totalCost;
    const totalReceived = vehicles.reduce((sum, v) => sum + (v.total_paid || 0), 0);
    const totalPending = vehicles.reduce((sum, v) => sum + v.remaining_balance, 0);
    const overdueVehicles = vehicles.filter(v => {
      const hasOverduePayment = vehiclePayments.some(p => 
        p.vehicle_id === v.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
      return hasOverduePayment;
    });
    
    return { totalSold, totalCost, totalProfit, totalReceived, totalPending, overdueVehicles };
  }, [vehicles, vehiclePayments]);

  const vehicleChartData = [
    { name: 'Custo', value: vehicleStats.totalCost, fill: 'hsl(var(--chart-4))' },
    { name: 'Vendido', value: vehicleStats.totalSold, fill: 'hsl(var(--chart-1))' },
    { name: 'Lucro', value: vehicleStats.totalProfit, fill: 'hsl(var(--chart-2))' },
    { name: 'Recebido', value: vehicleStats.totalReceived, fill: 'hsl(var(--chart-5))' },
    { name: 'Pendente', value: vehicleStats.totalPending, fill: 'hsl(var(--chart-3))' },
  ];

  const vehiclePieData = [
    { name: 'Recebido', value: vehicleStats.totalReceived },
    { name: 'Pendente', value: vehicleStats.totalPending },
  ];

  const COLORS = ['hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Análise financeira do seu sistema</p>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-primary/10 shrink-0">
                      <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Emprestado</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(stats.totalLoaned)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-blue-500/10 shrink-0">
                      <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Total a Receber</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(stats.totalToReceive)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-success/10 shrink-0">
                      <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Recebido</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(stats.totalReceived)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-warning/10 shrink-0">
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Pendente</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(stats.totalPending)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-emerald-500/10 shrink-0">
                      <Package className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Vendido</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(productStats.totalSold)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-success/10 shrink-0">
                      <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Recebido</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(productStats.totalReceived)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft col-span-2 md:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-warning/10 shrink-0">
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Pendente</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(productStats.totalPending)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-blue-500/10 shrink-0">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Contratos</p>
                      <p className="text-lg sm:text-2xl font-bold">{contracts.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-success/10 shrink-0">
                      <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">A Receber</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(contractStats.totalReceivable)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-destructive/10 shrink-0">
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">A Pagar</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(contractStats.totalPayable)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-primary/10 shrink-0">
                      <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Valor Total</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(contractStats.totalContracts)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-blue-500/10 shrink-0">
                      <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Custo Total</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(vehicleStats.totalCost)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-amber-500/10 shrink-0">
                      <Car className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Vendido</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(vehicleStats.totalSold)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 sm:p-3 rounded-xl shrink-0 ${vehicleStats.totalProfit >= 0 ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                      <TrendingUp className={`w-5 h-5 sm:w-6 sm:h-6 ${vehicleStats.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Lucro Total</p>
                      <p className={`text-lg sm:text-2xl font-bold truncate ${vehicleStats.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {formatCurrency(vehicleStats.totalProfit)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-success/10 shrink-0">
                      <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Recebido</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(vehicleStats.totalReceived)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-warning/10 shrink-0">
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Pendente</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(vehicleStats.totalPending)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 rounded-xl bg-primary/10 shrink-0">
                      <Car className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">Veículos</p>
                      <p className="text-lg sm:text-2xl font-bold truncate">{vehicles.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Veículo</TableHead>
                          <TableHead className="text-xs">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vehicleStats.overdueVehicles.map((vehicle) => (
                          <TableRow key={vehicle.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{vehicle.buyer_name || vehicle.seller_name}</TableCell>
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
