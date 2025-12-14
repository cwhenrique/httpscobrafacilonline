import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Car, User, Phone, Edit, Trash2, DollarSign, Calendar, FileText, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VehiclePayment {
  id: string;
  vehicle_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
}

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  plate: string | null;
  color: string | null;
  chassis: string | null;
  seller_name: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_cpf: string | null;
  buyer_rg: string | null;
  buyer_email: string | null;
  buyer_address: string | null;
  purchase_date: string;
  purchase_value: number;
  cost_value: number | null;
  down_payment: number | null;
  installments: number;
  installment_value: number;
  first_due_date: string;
  status: string;
  total_paid: number | null;
  remaining_balance: number;
  notes: string | null;
}

interface VehicleCardProps {
  vehicle: Vehicle;
  payments: VehiclePayment[];
  onViewPayments: (vehicle: Vehicle) => void;
  onDelete: (vehicleId: string) => void;
  onPayNextInstallment: (payment: VehiclePayment, vehicle: Vehicle) => void;
}

const formatCurrency = (value: number) => {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

const getStatus = (vehicle: Vehicle, payments: VehiclePayment[]) => {
  if (vehicle.status === 'paid' || vehicle.remaining_balance <= 0) {
    return 'paid';
  }
  const hasOverdue = payments.some(p => 
    p.status !== 'paid' && isPast(parseISO(p.due_date)) && !isToday(parseISO(p.due_date))
  );
  if (hasOverdue) return 'overdue';
  const hasDueToday = payments.some(p => 
    p.status !== 'paid' && isToday(parseISO(p.due_date))
  );
  if (hasDueToday) return 'due_today';
  return 'pending';
};

export default function VehicleCard({
  vehicle,
  payments,
  onViewPayments,
  onDelete,
  onPayNextInstallment,
}: VehicleCardProps) {
  const status = getStatus(vehicle, payments);
  const nextDuePayment = payments.find(p => p.status !== 'paid');
  const paidCount = payments.filter(p => p.status === 'paid').length;
  const profit = vehicle.purchase_value - (vehicle.cost_value || 0);
  const hasCost = (vehicle.cost_value || 0) > 0;

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      status === 'paid' && "bg-primary/5 border-primary/30",
      status === 'overdue' && "bg-destructive/5 border-destructive/30",
      status === 'due_today' && "bg-yellow-500/5 border-yellow-500/30"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              status === 'paid' && "bg-primary/20",
              status === 'overdue' && "bg-destructive/20",
              status === 'due_today' && "bg-yellow-500/20",
              status === 'pending' && "bg-muted"
            )}>
              <Car className={cn(
                "w-5 h-5",
                status === 'paid' && "text-primary",
                status === 'overdue' && "text-destructive",
                status === 'due_today' && "text-yellow-600",
                status === 'pending' && "text-muted-foreground"
              )} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{vehicle.brand} {vehicle.model}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{vehicle.year}</span>
                {vehicle.plate && (
                  <>
                    <span>•</span>
                    <span className="font-mono">{vehicle.plate}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Badge className={cn(
            "text-xs flex-shrink-0",
            status === 'paid' && "bg-primary/20 text-primary border-primary/30",
            status === 'overdue' && "bg-destructive text-destructive-foreground",
            status === 'due_today' && "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
            status === 'pending' && ""
          )} variant={status === 'pending' ? 'secondary' : 'default'}>
            {status === 'paid' && 'Quitado'}
            {status === 'overdue' && 'Atrasado'}
            {status === 'due_today' && 'Vence Hoje'}
            {status === 'pending' && 'Pendente'}
          </Badge>
        </div>

        {/* Buyer Info */}
        {vehicle.buyer_name && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
            <User className="w-3 h-3" />
            <span className="truncate">{vehicle.buyer_name}</span>
          </div>
        )}
        {vehicle.buyer_phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Phone className="w-3 h-3" />
            <span>{vehicle.buyer_phone}</span>
          </div>
        )}

        {/* Values Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {hasCost ? (
            <>
              <div className="p-2.5 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Custo</p>
                <p className="font-bold text-base">{formatCurrency(vehicle.cost_value || 0)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Venda</p>
                <p className="font-bold text-base">{formatCurrency(vehicle.purchase_value)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recebido</p>
                <p className="font-bold text-base text-primary">{formatCurrency(vehicle.total_paid || 0)}</p>
              </div>
              <div className={cn(
                "p-2.5 rounded-lg",
                profit >= 0 ? "bg-emerald-500/10" : "bg-destructive/10"
              )}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lucro</p>
                <p className={cn("font-bold text-base", profit >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {formatCurrency(profit)}
                  <span className="text-[10px] font-normal ml-1">
                    ({vehicle.cost_value ? ((profit / vehicle.cost_value) * 100).toFixed(0) : 0}%)
                  </span>
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-orange-500/10">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Falta</p>
                <p className="font-bold text-base text-orange-500">{formatCurrency(vehicle.remaining_balance)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Parcelas</p>
                <p className="font-bold text-base">{paidCount}/{vehicle.installments}</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2.5 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Venda</p>
                <p className="font-bold text-base">{formatCurrency(vehicle.purchase_value)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recebido</p>
                <p className="font-bold text-base text-primary">{formatCurrency(vehicle.total_paid || 0)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-orange-500/10">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Falta</p>
                <p className="font-bold text-base text-orange-500">{formatCurrency(vehicle.remaining_balance)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Parcelas</p>
                <p className="font-bold text-base">{paidCount}/{vehicle.installments}</p>
              </div>
            </>
          )}
        </div>

        {/* Next Due Date */}
        {nextDuePayment && status !== 'paid' && (
          <div className={cn(
            "flex items-center justify-between p-2.5 rounded-lg mb-3",
            status === 'overdue' && "bg-destructive/10",
            status === 'due_today' && "bg-yellow-500/10",
            status === 'pending' && "bg-muted/50"
          )}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                {nextDuePayment.installment_number}ª parcela
              </span>
            </div>
            <div className="text-right">
              <p className={cn(
                "font-semibold text-sm",
                status === 'overdue' && "text-destructive",
                status === 'due_today' && "text-yellow-600"
              )}>
                {format(parseISO(nextDuePayment.due_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground">{formatCurrency(nextDuePayment.amount)}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {nextDuePayment && status !== 'paid' && (
            <Button 
              className="flex-1 h-10 gap-2" 
              onClick={() => onPayNextInstallment(nextDuePayment, vehicle)}
            >
              <DollarSign className="w-4 h-4" />
              Pagar
            </Button>
          )}
          <Button 
            variant="outline" 
            className="h-10 gap-2 flex-1"
            onClick={() => onViewPayments(vehicle)}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Parcelas</span>
            <span className="sm:hidden">{paidCount}/{vehicle.installments}</span>
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            className="h-10 w-10 text-destructive hover:text-destructive"
            onClick={() => onDelete(vehicle.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
