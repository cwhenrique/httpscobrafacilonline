import { Navigate } from 'react-router-dom';
import { useEmployeeContext, EmployeePermission } from '@/hooks/useEmployeeContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface PermissionRouteProps {
  permission: EmployeePermission;
  children: React.ReactNode;
}

const PERMISSION_LABELS: Record<EmployeePermission, string> = {
  view_loans: 'Visualizar Empréstimos',
  create_loans: 'Criar Empréstimos',
  register_payments: 'Registrar Pagamentos',
  adjust_dates: 'Ajustar Datas',
  delete_loans: 'Excluir Empréstimos',
  view_clients: 'Visualizar Clientes',
  view_all_clients: 'Ver Todos os Clientes',
  create_clients: 'Criar Clientes',
  edit_clients: 'Editar Clientes',
  delete_clients: 'Excluir Clientes',
  view_reports: 'Visualizar Relatórios',
  manage_bills: 'Gerenciar Contas',
  manage_vehicles: 'Gerenciar Veículos',
  manage_products: 'Gerenciar Produtos',
  manage_checks: 'Gerenciar Cheques',
  view_settings: 'Visualizar Configurações',
  view_dashboard: 'Visualizar Dashboard',
};

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const { hasPermission, loading, isEmployee, permissions } = useEmployeeContext();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const toastShownRef = useRef(false);
  
  const hasPerm = hasPermission(permission);
  
  // Log para debug
  useEffect(() => {
    if (!loading) {
      console.log(`[PermissionRoute] Verificando "${permission}":`, {
        isEmployee,
        hasPerm,
        allPermissions: permissions
      });
    }
  }, [loading, permission, isEmployee, hasPerm, permissions]);
  
  // Mostrar toast e redirecionar quando bloqueado
  useEffect(() => {
    if (!loading && !hasPerm && isEmployee && !toastShownRef.current) {
      toastShownRef.current = true;
      const label = PERMISSION_LABELS[permission] || permission;
      toast.error(`Acesso negado: você não tem a permissão "${label}"`, {
        duration: 4000,
      });
      setShouldRedirect(true);
    }
  }, [loading, hasPerm, isEmployee, permission]);
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Redirecionar se não tem permissão
  if (!hasPerm || shouldRedirect) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}
