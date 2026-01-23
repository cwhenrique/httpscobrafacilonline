import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, AlertCircle, CreditCard } from 'lucide-react';
import cobraFacilLogo from '@/assets/cobrafacil-logo.png';

const PLAN_OPTIONS = [
  {
    name: 'Mensal',
    price: 'R$ 55,90/mês',
    link: 'https://pay.cakto.com.br/35qwwgz?SCK=renew',
    description: 'Acesso por 30 dias',
  },
  {
    name: 'Trimestral',
    price: 'R$ 149,90/trimestre',
    link: 'https://pay.cakto.com.br/eb6ern9?SCK=renew',
    description: 'Acesso por 90 dias',
    badge: 'Economia de 10%',
  },
  {
    name: 'Anual',
    price: 'R$ 479,90/ano',
    link: 'https://pay.cakto.com.br/fhwfptb?SCK=renew',
    description: 'Acesso por 365 dias',
    badge: 'Melhor custo-benefício',
  },
];

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showExpiredDialog, setShowExpiredDialog] = useState(false);
  const [showTrialExpiredMessage, setShowTrialExpiredMessage] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  // Check if user had a paid subscription (not just trial)
  const checkIfPaidSubscription = (profile: { subscription_plan: string | null; subscription_expires_at: string | null }) => {
    // If user has a subscription_plan set (monthly, annual, quarterly, lifetime), they're a paying customer
    const paidPlans = ['monthly', 'annual', 'quarterly', 'trimestral', 'mensal', 'anual', 'lifetime', 'vitalicio'];
    return profile.subscription_plan && paidPlans.some(plan => 
      profile.subscription_plan?.toLowerCase().includes(plan)
    );
  };

  useEffect(() => {
    let cancelled = false;

    async function validateAndRedirect() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_active, subscription_plan, subscription_expires_at')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        // Falhou validar perfil => por segurança, não permite acesso
        if (error || !data) {
          await supabase.auth.signOut();
          toast.error('Não foi possível validar sua conta', {
            description: 'Tente novamente em alguns instantes.',
          });
          return;
        }

        if (data.is_active === false) {
          await supabase.auth.signOut();
          
          // Check if user had a paid subscription
          if (checkIfPaidSubscription(data)) {
            setShowExpiredDialog(true);
          } else {
            // Trial user - show simple message
            setShowTrialExpiredMessage(true);
            toast.error('Período de teste expirado', {
              description: 'Seu período de teste terminou. Entre em contato para adquirir um plano.',
            });
          }
          return;
        }

        navigate('/dashboard');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    validateAndRedirect();

    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error, data } = await signIn(email, password);

    if (error) {
      toast.error('Erro ao fazer login', {
        description:
          error.message === 'Invalid login credentials'
            ? 'Email ou senha incorretos'
            : error.message,
      });
      setIsLoading(false);
      return;
    }

    // Verificar is_active IMEDIATAMENTE após login bem-sucedido
    if (data?.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_active, subscription_plan, subscription_expires_at')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        toast.error('Não foi possível validar sua conta', {
          description: 'Tente novamente em alguns instantes.',
        });
        setIsLoading(false);
        return;
      }

      if (profile.is_active === false) {
        await supabase.auth.signOut();
        
        // Check if user had a paid subscription
        if (checkIfPaidSubscription(profile)) {
          setShowExpiredDialog(true);
        } else {
          // Trial user - show simple message
          toast.error('Período de teste expirado', {
            description: 'Seu período de teste terminou. Entre em contato para adquirir um plano.',
          });
        }
        setIsLoading(false);
        return;
      }

      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    }

    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      toast.error('Erro ao enviar email', {
        description: error.message,
      });
    } else {
      toast.success('Email enviado!', {
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
      setIsResetMode(false);
      setResetEmail('');
    }

    setIsLoading(false);
  };

  const handleSelectPlan = (link: string) => {
    window.open(link, '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <Card className="w-full max-w-md shadow-soft animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={cobraFacilLogo} alt="CobraFácil" className="h-24 w-auto" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">CobraFácil</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sistema de Gestão de Empréstimos e Mensalidades
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isResetMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  placeholder="seu@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar email de recuperação'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsResetMode(false);
                  setResetEmail('');
                }}
              >
                ← Voltar ao login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full text-sm text-muted-foreground"
                onClick={() => setIsResetMode(true)}
              >
                Esqueceu sua senha?
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Plano Expirado */}
      <Dialog open={showExpiredDialog} onOpenChange={setShowExpiredDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl">Seu plano expirou</DialogTitle>
            <DialogDescription className="text-center">
              Seu período de acesso ao CobraFácil terminou. Renove agora para continuar gerenciando seus empréstimos e mensalidades.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {PLAN_OPTIONS.map((plan) => (
              <button
                key={plan.name}
                onClick={() => handleSelectPlan(plan.link)}
                className="relative w-full rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
              >
                {plan.badge && (
                  <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{plan.price}</span>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Após o pagamento, seu acesso será liberado automaticamente.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
