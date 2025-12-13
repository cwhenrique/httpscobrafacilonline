import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus, ArrowLeft, RefreshCw, Copy, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TrialUser {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  temp_password: string | null;
  trial_expires_at: string | null;
  is_active: boolean;
}

const ADMIN_USER = 'Clauclau';
const ADMIN_PASS = '33251675';

export default function CreateTrialUser() {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [trialUsers, setTrialUsers] = useState<TrialUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: ''
  });

  useEffect(() => {
    const authStatus = sessionStorage.getItem('trial_admin_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    setTimeout(() => {
      if (loginData.username === ADMIN_USER && loginData.password === ADMIN_PASS) {
        sessionStorage.setItem('trial_admin_auth', 'true');
        setIsAuthenticated(true);
        toast({ title: 'Acesso autorizado!' });
      } else {
        toast({
          title: 'Credenciais inválidas',
          description: 'Usuário ou senha incorretos',
          variant: 'destructive'
        });
      }
      setLoginLoading(false);
    }, 500);
  };

  const fetchTrialUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-trial-users');

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setTrialUsers(data?.users || []);
    } catch (error) {
      console.error('Error fetching trial users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchTrialUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.email || !formData.phone || !formData.password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos',
        variant: 'destructive'
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-trial-user', {
        body: {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Usuário criado com sucesso!',
        description: `Acesso de 24 horas concedido para ${formData.full_name}`,
      });

      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: ''
      });

      // Refresh the list
      fetchTrialUsers();

    } catch (error: any) {
      console.error('Error creating trial user:', error);
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestWhatsApp = async () => {
    if (!formData.phone) {
      toast({
        title: 'Informe o telefone',
        description: 'Preencha o campo de telefone para enviar o teste',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone: formData.phone,
          message:
            '🔔 *Teste de WhatsApp CobraFácil*\n\nEsta é uma mensagem de teste para confirmar que sua integração com o WhatsApp está funcionando corretamente. Se você recebeu esta mensagem, está tudo certo! ✅',
        },
      });

      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);

      toast({
        title: 'Mensagem de teste enviada!',
        description: 'Verifique seu WhatsApp para confirmar o recebimento.',
      });
    } catch (error: any) {
      console.error('Error sending test WhatsApp:', error);
      toast({
        title: 'Erro ao enviar mensagem de teste',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Texto copiado para a área de transferência',
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-primary">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Digite suas credenciais para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Digite o usuário"
                  value={loginData.username}
                  onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                  disabled={loginLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login_password">Senha</Label>
                <Input
                  id="login_password"
                  type="password"
                  placeholder="Digite a senha"
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  disabled={loginLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-primary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Gerenciamento de Usuários Trial</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Create Form */}
          <Card className="border-primary">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Criar Acesso Trial</CardTitle>
              <CardDescription>
                O usuário terá acesso por 24 horas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    type="text"
                    placeholder="Nome do usuário"
                    value={formData.full_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="17999999999"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="text"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Criar Usuário Trial
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSendTestWhatsApp}
                  disabled={loading}
                >
                  Enviar mensagem de teste por WhatsApp
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Trial Users List */}
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Usuários em Período Trial</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTrialUsers}
                  disabled={loadingUsers}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : trialUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum usuário trial encontrado
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Senha</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.full_name || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{user.email || '-'}</span>
                              {user.email && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(user.email!)}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-muted px-2 py-1 rounded text-sm">
                                {user.temp_password || '-'}
                              </code>
                              {user.temp_password && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(user.temp_password!)}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isExpired(user.trial_expires_at) || !user.is_active ? (
                              <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded">
                                Expirado
                              </span>
                            ) : (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                                Ativo até {user.trial_expires_at && format(new Date(user.trial_expires_at), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}