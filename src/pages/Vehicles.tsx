import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useVehicles, useVehiclePayments } from '@/hooks/useVehicles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/calculations';
import { 
  Car, 
  Plus, 
  Eye, 
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VehicleForm } from '@/components/VehicleForm';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function Vehicles() {
  const { vehicles, isLoading: loading, deleteVehicle } = useVehicles();
  const { payments, markAsPaid } = useVehiclePayments();
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPaymentsDialog, setShowPaymentsDialog] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Quitado</Badge>;
      case 'overdue':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Em Atraso</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pendente</Badge>;
    }
  };

  const getVehiclePayments = (vehicleId: string) => {
    return payments?.filter(p => p.vehicle_id === vehicleId) || [];
  };

  const handleViewPayments = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setShowPaymentsDialog(true);
  };

  const handleMarkPaymentPaid = async (paymentId: string, vehicleId: string) => {
    try {
      await markAsPaid.mutateAsync({ paymentId, vehicleId });
      toast.success('Pagamento registrado com sucesso!');
    } catch (error) {
      toast.error('Erro ao registrar pagamento');
    }
  };

  const handleDelete = async (vehicleId: string) => {
    if (confirm('Tem certeza que deseja excluir este veículo?')) {
      try {
        await deleteVehicle.mutateAsync(vehicleId);
        toast.success('Veículo excluído com sucesso!');
      } catch (error) {
        toast.error('Erro ao excluir veículo');
      }
    }
  };

  // Stats
  const stats = {
    total: vehicles?.length || 0,
    paid: vehicles?.filter(v => v.status === 'paid').length || 0,
    pending: vehicles?.filter(v => v.status === 'pending').length || 0,
    overdue: vehicles?.filter(v => {
      return payments?.some(p => 
        p.vehicle_id === v.id && 
        p.status === 'pending' && 
        new Date(p.due_date) < new Date()
      );
    }).length || 0,
    totalValue: vehicles?.reduce((sum, v) => sum + Number(v.purchase_value), 0) || 0,
    totalReceived: vehicles?.reduce((sum, v) => sum + Number(v.total_paid || 0), 0) || 0,
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">Veículos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie suas vendas de veículos
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Veículo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Veículo</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-sm">Use a página de Contas a Receber/Pagar para cadastrar veículos.</p>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Car className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quitados</p>
                  <p className="text-xl font-bold">{stats.paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Vendido</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalReceived)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vehicles List */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              Lista de Veículos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vehicles?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum veículo cadastrado</p>
                <p className="text-sm">Clique em "Novo Veículo" para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Comprador</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Falta</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles?.map((vehicle) => {
                      const vehiclePayments = getVehiclePayments(vehicle.id);
                      const hasOverdue = vehiclePayments.some(p => 
                        p.status === 'pending' && new Date(p.due_date) < new Date()
                      );
                      
                      return (
                        <TableRow key={vehicle.id}>
                          <TableCell>
                            <div className="font-medium">
                              {vehicle.brand} {vehicle.model}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {vehicle.year} • {vehicle.plate || 'Sem placa'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              {vehicle.buyer_name || 'Não informado'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(vehicle.purchase_value)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-500">
                            {formatCurrency(vehicle.total_paid || 0)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(vehicle.remaining_balance)}
                          </TableCell>
                          <TableCell className="text-center">
                            {vehicle.status === 'paid' ? getStatusBadge('paid') : 
                              hasOverdue ? getStatusBadge('overdue') : getStatusBadge('pending')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewPayments(vehicle)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments Dialog */}
        <Dialog open={showPaymentsDialog} onOpenChange={setShowPaymentsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Pagamentos - {selectedVehicle?.brand} {selectedVehicle?.model}
              </DialogTitle>
            </DialogHeader>
            {selectedVehicle && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                    <p className="font-bold">{formatCurrency(selectedVehicle.purchase_value)}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Pago</p>
                    <p className="font-bold text-emerald-500">{formatCurrency(selectedVehicle.total_paid || 0)}</p>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Falta</p>
                    <p className="font-bold text-yellow-500">{formatCurrency(selectedVehicle.remaining_balance)}</p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getVehiclePayments(selectedVehicle.id).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>Parcela {payment.installment_number}</TableCell>
                        <TableCell>{formatDate(payment.due_date)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell className="text-center">
                          {payment.status === 'paid' ? (
                            <Badge className="bg-emerald-500/20 text-emerald-500">Pago</Badge>
                          ) : new Date(payment.due_date) < new Date() ? (
                            <Badge className="bg-destructive/20 text-destructive">Atrasado</Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-500">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.status !== 'paid' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleMarkPaymentPaid(payment.id, selectedVehicle.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Pagar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
