import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Activity, DollarSign, UserPlus, FileText, Trash2, CreditCard, RefreshCw, Percent, TrendingDown, History, Receipt } from 'lucide-react';
import { useEmployeeActivityLog, type ActivityLogEntry } from '@/hooks/useEmployeeActivityLog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  loan_created: { label: 'Empréstimo criado', icon: DollarSign, color: 'text-blue-500' },
  payment_registered: { label: 'Pagamento registrado', icon: CreditCard, color: 'text-green-500' },
  client_created: { label: 'Cliente cadastrado', icon: UserPlus, color: 'text-purple-500' },
  client_edited: { label: 'Cliente editado', icon: FileText, color: 'text-orange-500' },
  loan_deleted: { label: 'Empréstimo excluído', icon: Trash2, color: 'text-red-500' },
  payment_deleted: { label: 'Pagamento excluído', icon: Trash2, color: 'text-red-500' },
};

interface EmployeeOption {
  id: string;
  name: string;
}

export default function EmployeeActivityLog() {
  const { user } = useAuth();
  const { activities, loading, fetchActivities } = useEmployeeActivityLog();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterDays, setFilterDays] = useState<string>('7');

  useEffect(() => {
    async function loadEmployees() {
      if (!user) return;
      const { data } = await supabase
        .from('employees')
        .select('id, name')
        .eq('owner_id', user.id)
        .order('name');
      setEmployees(data || []);
    }
    loadEmployees();
  }, [user]);

  useEffect(() => {
    loadActivities();
  }, [filterEmployee, filterAction, filterDays]);

  function loadActivities() {
    const days = parseInt(filterDays);
    const dateFrom = startOfDay(subDays(new Date(), days)).toISOString();
    
    fetchActivities({
      employeeId: filterEmployee !== 'all' ? filterEmployee : undefined,
      actionType: filterAction !== 'all' ? filterAction : undefined,
      dateFrom,
      limit: 200,
    });
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = subDays(today, 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return `Hoje às ${format(date, 'HH:mm')}`;
    }
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return `Ontem às ${format(date, 'HH:mm')}`;
    }
    return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  // Group activities by date
  const groupedActivities = activities.reduce<Record<string, ActivityLogEntry[]>>((acc, act) => {
    const dateKey = format(new Date(act.created_at), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(act);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-primary" />
            <CardTitle>Log de Atividades</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={loadActivities} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Funcionário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              <SelectItem value="loan_created">Empréstimos criados</SelectItem>
              <SelectItem value="payment_registered">Pagamentos registrados</SelectItem>
              <SelectItem value="payment_deleted">Pagamentos excluídos</SelectItem>
              <SelectItem value="client_created">Clientes cadastrados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterDays} onValueChange={setFilterDays}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="3">Últimos 3 dias</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Activity List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma atividade encontrada</p>
            <p className="text-sm">As atividades dos funcionários aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([dateKey, acts]) => {
              const date = new Date(dateKey);
              const today = new Date();
              const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
              const label = isToday ? 'Hoje' : format(date, "dd 'de' MMMM", { locale: ptBR });

              return (
                <div key={dateKey}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
                  <div className="space-y-2">
                    {acts.map(act => {
                      const config = ACTION_CONFIG[act.action_type] || {
                        label: act.action_type,
                        icon: Activity,
                        color: 'text-muted-foreground',
                      };
                      const Icon = config.icon;

                      return (
                        <div key={act.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                          <div className={`mt-0.5 ${config.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{act.employee_name}</span>
                              <Badge variant="outline" className="text-xs">
                                {config.label}
                              </Badge>
                              {act.action_type === 'payment_registered' && (() => {
                                const meta = act.metadata as Record<string, string> | null;
                                const pt = meta?.payment_type;
                                if (!pt || pt === 'regular') return null;
                                const typeConfig: Record<string, { label: string; className: string }> = {
                                  interest_only: { label: 'Só Juros', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200' },
                                  partial_interest: { label: 'Juros Parcial', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200' },
                                  amortization: { label: 'Amortização', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200' },
                                  historical_interest: { label: 'Juros Histórico', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200' },
                                  installment: { label: 'Parcela', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200' },
                                };
                                const tc = typeConfig[pt];
                                if (!tc) return null;
                                return <Badge className={`text-xs ${tc.className}`}>{tc.label}</Badge>;
                              })()}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{act.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            {act.amount != null && act.amount > 0 && (
                              <p className="text-sm font-medium">{formatCurrency(act.amount)}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{formatDate(act.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
