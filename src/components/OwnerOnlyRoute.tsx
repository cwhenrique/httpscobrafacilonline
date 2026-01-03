import { Navigate } from 'react-router-dom';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface OwnerOnlyRouteProps {
  children: React.ReactNode;
}

export function OwnerOnlyRoute({ children }: OwnerOnlyRouteProps) {
  const { loading, isEmployee, isOwner } = useEmployeeContext();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const toastShownRef = useRef(false);
  
  // Log para debug
  useEffect(() => {
    if (!loading) {
      console.log('[OwnerOnlyRoute] Estado:', { isEmployee, isOwner, loading });
    }
  }, [loading, isEmployee, isOwner]);
  
  // Mostrar toast e redirecionar funcionários
  useEffect(() => {
    if (!loading && isEmployee && !toastShownRef.current) {
      toastShownRef.current = true;
      toast.error('Somente o dono da conta pode acessar esta página', {
        duration: 4000,
      });
      setShouldRedirect(true);
    }
  }, [loading, isEmployee]);
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Funcionários não podem acessar
  if (isEmployee || shouldRedirect) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Estado indeterminado (não dono, não funcionário) = bloquear
  if (!isOwner) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Dono confirmado pode acessar
  return <>{children}</>;
}
