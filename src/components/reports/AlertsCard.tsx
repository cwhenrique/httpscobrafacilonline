import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, CalendarDays, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface Alert {
  type: 'due_soon' | 'overdue_long' | 'vehicles_overdue' | 'products_overdue';
  count: number;
  amount: number;
  label: string;
  description: string;
}

interface AlertsCardProps {
  dueThisWeek: { count: number; amount: number };
  overdueMoreThan30Days: { count: number; amount: number };
  vehiclesOverdue: { count: number; amount: number };
  productsOverdue: { count: number; amount: number };
}

export function AlertsCard({
  dueThisWeek,
  overdueMoreThan30Days,
  vehiclesOverdue,
  productsOverdue,
}: AlertsCardProps) {
  const allAlerts: Alert[] = [
    {
      type: 'due_soon' as const,
      count: dueThisWeek.count,
      amount: dueThisWeek.amount,
      label: 'Vencem esta semana',
      description: 'empréstimos',
    },
    {
      type: 'overdue_long' as const,
      count: overdueMoreThan30Days.count,
      amount: overdueMoreThan30Days.amount,
      label: 'Atrasados há +30 dias',
      description: 'clientes inadimplentes',
    },
    {
      type: 'vehicles_overdue' as const,
      count: vehiclesOverdue.count,
      amount: vehiclesOverdue.amount,
      label: 'Veículos em atraso',
      description: 'parcelas pendentes',
    },
    {
      type: 'products_overdue' as const,
      count: productsOverdue.count,
      amount: productsOverdue.amount,
      label: 'Produtos em atraso',
      description: 'vendas pendentes',
    },
  ];
  
  const alerts = allAlerts.filter(alert => alert.count > 0);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'due_soon':
        return CalendarDays;
      case 'overdue_long':
        return Users;
      default:
        return Clock;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'due_soon':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'overdue_long':
        return 'text-destructive bg-destructive/10 border-destructive/20';
      default:
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    }
  };

  if (alerts.length === 0) {
    return (
      <Card className="shadow-soft border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3 text-emerald-500">
            <div className="p-2 rounded-full bg-emerald-500/10">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Tudo em ordem!</h3>
              <p className="text-sm text-muted-foreground">
                Nenhum alerta no momento. Continue assim!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft border-amber-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Precisa de Atenção
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
        <div className="space-y-2">
          {alerts.map((alert) => {
            const Icon = getAlertIcon(alert.type);
            return (
              <div
                key={alert.type}
                className={cn(
                  "flex items-center gap-3 p-2 sm:p-3 rounded-lg border",
                  getAlertColor(alert.type)
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium truncate">
                    {alert.count} {alert.label}
                  </p>
                  <p className="text-[10px] sm:text-xs opacity-70 truncate">
                    {formatCurrency(alert.amount)} - {alert.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
