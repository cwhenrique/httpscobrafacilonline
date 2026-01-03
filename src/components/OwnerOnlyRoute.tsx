import { Navigate } from 'react-router-dom';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface OwnerOnlyRouteProps {
  children: React.ReactNode;
}

export function OwnerOnlyRoute({ children }: OwnerOnlyRouteProps) {
  const { loading, isEmployee, isOwner } = useEmployeeContext();
  const hasShownToast = useRef(false);
  
  // Aguardar até que o contexto termine de carregar
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Funcionários não podem acessar rotas de dono
  useEffect(() => {
    if (isEmployee && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.error('Somente o dono da conta pode acessar esta página', {
        duration: 4000,
      });
    }
  }, [isEmployee]);
  
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
