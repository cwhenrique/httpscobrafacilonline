import { Navigate } from 'react-router-dom';
import { useEmployeeContext, EmployeePermission } from '@/hooks/useEmployeeContext';
import { Loader2 } from 'lucide-react';

interface PermissionRouteProps {
  permission: EmployeePermission;
  children: React.ReactNode;
}

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const { hasPermission, loading } = useEmployeeContext();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}
