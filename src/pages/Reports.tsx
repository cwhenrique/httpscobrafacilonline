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
    
    return { totalSold, totalReceived, totalPending, overdueVehicles };
  }, [vehicles, vehiclePayments]);

  const vehicleChartData = [
    { name: 'Vendido', value: vehicleStats.totalSold, fill: 'hsl(var(--chart-1))' },
    { name: 'Recebido', value: vehicleStats.totalReceived, fill: 'hsl(var(--chart-2))' },
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
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1">
            <TabsTrigger value="loans" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Banknote className="w-4 h-4" />
              <span>Empréstimos</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Package className="w-4 h-4" />
              <span>Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <FileText className="w-4 h-4" />
              <span>Contratos</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Car className="w-4 h-4" />
              <span>Veículos</span>
            </TabsTrigger>
          </TabsList>

          {/* LOANS TAB */}
          <TabsContent value="loans" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <DollarSign className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Emprestado</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalLoaned)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10">
                      <TrendingUp className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total a Receber</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalToReceive)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success/10">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Recebido</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalReceived)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-warning/10">
                      <AlertTriangle className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendente</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalPending)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="shadow-soft">
                <CardHeader><CardTitle>Resumo Financeiro - Empréstimos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={loanChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader><CardTitle>Distribuição - Empréstimos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={loanPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {loanPieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader><CardTitle>Clientes Inadimplentes - Empréstimos</CardTitle></CardHeader>
              <CardContent>
                {overdueLoans.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum cliente inadimplente</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor Original</TableHead>
                        <TableHead>Saldo Devedor</TableHead>
                        <TableHead>Vencimento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdueLoans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium">{loan.client?.full_name}</TableCell>
                          <TableCell>{formatCurrency(loan.principal_amount)}</TableCell>
                          <TableCell className="font-semibold text-destructive">{formatCurrency(loan.remaining_balance)}</TableCell>
                          <TableCell>{formatDate(loan.due_date)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRODUCTS TAB */}
          <TabsContent value="products" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10">
                      <Package className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Vendido</p>
                      <p className="text-2xl font-bold">{formatCurrency(productStats.totalSold)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success/10">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Recebido</p>
                      <p className="text-2xl font-bold">{formatCurrency(productStats.totalReceived)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-warning/10">
                      <AlertTriangle className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendente</p>
                      <p className="text-2xl font-bold">{formatCurrency(productStats.totalPending)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="shadow-soft">
                <CardHeader><CardTitle>Resumo Financeiro - Produtos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={productChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader><CardTitle>Distribuição - Produtos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={productPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {productPieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader><CardTitle>Clientes Inadimplentes - Produtos</CardTitle></CardHeader>
              <CardContent>
                {productStats.overdueSales.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum cliente inadimplente</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Saldo Devedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productStats.overdueSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">{sale.client_name}</TableCell>
                          <TableCell>{sale.product_name}</TableCell>
                          <TableCell>{formatCurrency(sale.total_amount)}</TableCell>
                          <TableCell className="font-semibold text-destructive">{formatCurrency(sale.remaining_balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTRACTS TAB */}
          <TabsContent value="contracts" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10">
                      <FileText className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Contratos</p>
                      <p className="text-2xl font-bold">{contracts.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success/10">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">A Receber</p>
                      <p className="text-2xl font-bold">{formatCurrency(contractStats.totalReceivable)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-destructive/10">
                      <AlertTriangle className="w-6 h-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">A Pagar</p>
                      <p className="text-2xl font-bold">{formatCurrency(contractStats.totalPayable)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <DollarSign className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Total</p>
                      <p className="text-2xl font-bold">{formatCurrency(contractStats.totalContracts)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="shadow-soft">
                <CardHeader><CardTitle>Resumo Financeiro - Contratos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={contractChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader><CardTitle>Distribuição - Contratos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={contractPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {contractPieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader><CardTitle>Lista de Contratos</CardTitle></CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum contrato cadastrado</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>A Receber/Pagar</TableHead>
                        <TableHead>Parcelas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.slice(0, 10).map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">{contract.client_name}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              contract.bill_type === 'receivable' 
                                ? 'bg-success/10 text-success' 
                                : 'bg-destructive/10 text-destructive'
                            }`}>
                              {contract.bill_type === 'receivable' ? 'Receber' : 'Pagar'}
                            </span>
                          </TableCell>
                          <TableCell>{formatCurrency(contract.total_amount)}</TableCell>
                          <TableCell className={contract.bill_type === 'receivable' ? 'text-success' : 'text-destructive'}>
                            {formatCurrency(contract.amount_to_receive)}
                          </TableCell>
                          <TableCell>{contract.installments}x</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VEHICLES TAB */}
          <TabsContent value="vehicles" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/10">
                      <Car className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Vendido</p>
                      <p className="text-2xl font-bold">{formatCurrency(vehicleStats.totalSold)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success/10">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Recebido</p>
                      <p className="text-2xl font-bold">{formatCurrency(vehicleStats.totalReceived)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-warning/10">
                      <AlertTriangle className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendente</p>
                      <p className="text-2xl font-bold">{formatCurrency(vehicleStats.totalPending)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="shadow-soft">
                <CardHeader><CardTitle>Resumo Financeiro - Veículos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={vehicleChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader><CardTitle>Distribuição - Veículos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={vehiclePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {vehiclePieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader><CardTitle>Clientes Inadimplentes - Veículos</CardTitle></CardHeader>
              <CardContent>
                {vehicleStats.overdueVehicles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhum cliente inadimplente</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Veículo</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead>Saldo Devedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicleStats.overdueVehicles.map((vehicle) => (
                        <TableRow key={vehicle.id}>
                          <TableCell className="font-medium">{vehicle.buyer_name || vehicle.seller_name}</TableCell>
                          <TableCell>{vehicle.brand} {vehicle.model} {vehicle.year}</TableCell>
                          <TableCell>{formatCurrency(vehicle.purchase_value)}</TableCell>
                          <TableCell className="font-semibold text-destructive">{formatCurrency(vehicle.remaining_balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
