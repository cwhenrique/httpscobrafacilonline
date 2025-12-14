import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useVehicles, useVehiclePayments } from '@/hooks/useVehicles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/calculations';
import { 
  Car, 
  CheckCircle,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import VehicleCard from '@/components/VehicleCard';

export default function Vehicles() {
  const { vehicles, isLoading: loading, deleteVehicle } = useVehicles();
  const { payments, markAsPaid } = useVehiclePayments();
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [showPaymentsDialog, setShowPaymentsDialog] = useState(false);

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

  const handlePayNextInstallment = async (payment: any, vehicle: any) => {
    setSelectedVehicle(vehicle);
    setShowPaymentsDialog(true);
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
    totalCost: vehicles?.reduce((sum, v) => sum + Number(v.cost_value || 0), 0) || 0,
    totalProfit: vehicles?.reduce((sum, v) => sum + (Number(v.purchase_value) - Number(v.cost_value || 0)), 0) || 0,
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
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
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
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
                <div className="p-2.5 rounded-lg bg-blue-500/10">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalReceived)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lucro Total</p>
                  <p className="text-lg font-bold text-emerald-500">{formatCurrency(stats.totalProfit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Vehicles Grid */}
        {vehicles?.length === 0 ? (
          <Card className="border-primary/30">
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum veículo cadastrado</p>
                <p className="text-sm">Use a página de Contas para cadastrar veículos</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles?.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                payments={getVehiclePayments(vehicle.id)}
                onViewPayments={handleViewPayments}
                onDelete={handleDelete}
                onPayNextInstallment={handlePayNextInstallment}
              />
            ))}
          </div>
        )}

        {/* Payments Dialog */}
        <Dialog open={showPaymentsDialog} onOpenChange={setShowPaymentsDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Car className="w-5 h-5 text-primary" />
                {selectedVehicle?.brand} {selectedVehicle?.model}
              </DialogTitle>
            </DialogHeader>
            {selectedVehicle && (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                    <p className="font-bold">{formatCurrency(selectedVehicle.purchase_value)}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Pago</p>
                    <p className="font-bold text-primary">{formatCurrency(selectedVehicle.total_paid || 0)}</p>
                  </div>
                  <div className="p-3 bg-orange-500/10 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Falta</p>
                    <p className="font-bold text-orange-500">{formatCurrency(selectedVehicle.remaining_balance)}</p>
                  </div>
                  {(selectedVehicle.cost_value || 0) > 0 && (
                    <div className="p-3 bg-emerald-500/10 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">Lucro</p>
                      <p className="font-bold text-emerald-500">
                        {formatCurrency(selectedVehicle.purchase_value - (selectedVehicle.cost_value || 0))}
                      </p>
                    </div>
                  )}
                </div>

                {/* Payments Table */}
                <div className="overflow-x-auto">
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
                          <TableCell className="font-medium">
                            {payment.installment_number}ª
                          </TableCell>
                          <TableCell>{formatDate(payment.due_date)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="text-center">
                            {payment.status === 'paid' ? (
                              <Badge className="bg-primary/20 text-primary border-primary/30">Pago</Badge>
                            ) : new Date(payment.due_date) < new Date() ? (
                              <Badge className="bg-destructive/20 text-destructive border-destructive/30">Atrasado</Badge>
                            ) : (
                              <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {payment.status !== 'paid' && (
                              <Button 
                                size="sm" 
                                className="h-8 gap-1"
                                onClick={() => handleMarkPaymentPaid(payment.id, selectedVehicle.id)}
                              >
                                <CheckCircle className="w-3 h-3" />
                                Pagar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
