import { Navigate } from 'react-router-dom';
import { useEmployeeContext, EmployeePermission } from '@/hooks/useEmployeeContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface PermissionRouteProps {
  permission: EmployeePermission;
  children: React.ReactNode;
}

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const { hasPermission, loading, isEmployee } = useEmployeeContext();
  const hasShownToast = useRef(false);
  
  // Aguardar até que o contexto termine de carregar
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const hasPerm = hasPermission(permission);
  
  // Mostrar toast de bloqueio para funcionários
  useEffect(() => {
    if (!hasPerm && isEmployee && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.error(`Acesso negado: você não tem permissão "${permission}"`, {
        duration: 4000,
      });
    }
  }, [hasPerm, isEmployee, permission]);
  
  if (!hasPerm) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}
