import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [checkingActive, setCheckingActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkIsActive() {
      if (!user) return;

      setCheckingActive(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!error && data?.is_active === false) {
        toast.error('Conta inativa', {
          description: 'Seu período de acesso expirou. Entre em contato para renovar.',
        });
        await supabase.auth.signOut();
      }

      setCheckingActive(false);
    }

    checkIsActive();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading || checkingActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

