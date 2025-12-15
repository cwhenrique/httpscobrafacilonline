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
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error, data } = await signIn(email, password);
    
    if (error) {
      toast.error('Erro ao fazer login', {
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : error.message,
      });
      setIsLoading(false);
      return;
    }

    // Check if user is active
    if (data?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', data.user.id)
        .single();

      if (profile && !profile.is_active) {
        // User is inactive, sign them out
        await supabase.auth.signOut();
        toast.error('Conta inativa', {
          description: 'Seu período de acesso expirou. Entre em contato para renovar.',
        });
        setIsLoading(false);
        return;
      }
    }

    toast.success('Login realizado com sucesso!');
    navigate('/dashboard');
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
