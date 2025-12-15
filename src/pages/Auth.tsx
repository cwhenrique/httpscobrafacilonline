import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import cobraFacilLogo from '@/assets/cobrafacil-logo.png';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function validateAndRedirect() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_active')
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
          toast.error('Conta inativa', {
            description: 'Seu período de acesso expirou. Entre em contato para renovar.',
          });
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
        .select('is_active')
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
        toast.error('Conta inativa', {
          description: 'Seu período de acesso expirou. Entre em contato para renovar.',
        });
        setIsLoading(false);
        return;
      }

      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    }

    setIsLoading(false);
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
