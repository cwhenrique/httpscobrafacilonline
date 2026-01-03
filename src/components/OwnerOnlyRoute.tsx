import { Navigate } from 'react-router-dom';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Loader2 } from 'lucide-react';

interface OwnerOnlyRouteProps {
  children: React.ReactNode;
}

export function OwnerOnlyRoute({ children }: OwnerOnlyRouteProps) {
  const { loading, isEmployee, isOwner } = useEmployeeContext();
  
  // Aguardar até que o contexto termine de carregar
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Funcionários não podem acessar rotas de dono
  if (isEmployee) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Estado indeterminado (não dono, não funcionário) = bloquear
  if (!isOwner) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Dono confirmado pode acessar
  return <>{children}</>;
}
