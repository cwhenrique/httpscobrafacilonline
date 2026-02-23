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
        .select('is_active, subscription_plan, trial_expires_at')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      // Falhou validar perfil => por segurança, não permite acesso
      if (error || !data || data.is_active === false) {
        toast.error('Conta inativa', {
          description: 'Seu período de acesso expirou. Entre em contato para renovar.',
        });
        await supabase.auth.signOut();
        setCheckingActive(false);
        return;
      }

      // Trial user doing first login: start the 24h countdown now
      if (data.subscription_plan === 'trial' && !data.trial_expires_at) {
        const trialEnd = new Date();
        trialEnd.setHours(trialEnd.getHours() + 24);
        await supabase
          .from('profiles')
          .update({ trial_expires_at: trialEnd.toISOString() })
          .eq('id', user.id);
        console.log('Trial countdown started for user:', user.id, 'expires at:', trialEnd.toISOString());
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

