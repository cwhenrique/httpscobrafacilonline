import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus, ArrowLeft, RefreshCw, Copy, Lock, Search, Users, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface User {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  temp_password: string | null;
  trial_expires_at: string | null;
  is_active: boolean;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  created_at: string | null;
}

const ADMIN_USER = 'Clauclau';
const ADMIN_PASS = '33251675';

export default function CreateTrialUser() {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'trial' | 'monthly' | 'annual' | 'lifetime'>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newPlan, setNewPlan] = useState<'trial' | 'monthly' | 'annual' | 'lifetime'>('trial');
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    subscription_plan: 'trial' as 'trial' | 'monthly' | 'annual' | 'lifetime'
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

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-trial-users');

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setUsers(data?.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const planCounts = useMemo(() => {
    return {
      all: users.length,
      trial: users.filter(u => u.subscription_plan === 'trial' || !u.subscription_plan).length,
      monthly: users.filter(u => u.subscription_plan === 'monthly').length,
      annual: users.filter(u => u.subscription_plan === 'annual').length,
      lifetime: users.filter(u => u.subscription_plan === 'lifetime').length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = users;
    
    // Filtrar por plano
    if (planFilter !== 'all') {
      if (planFilter === 'trial') {
        result = result.filter(user => user.subscription_plan === 'trial' || !user.subscription_plan);
      } else {
        result = result.filter(user => user.subscription_plan === planFilter);
      }
    }
    
    // Filtrar por busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(user => 
        (user.full_name?.toLowerCase().includes(query)) ||
        (user.email?.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [users, searchQuery, planFilter]);

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
          phone: formData.phone,
          subscription_plan: formData.subscription_plan
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const planLabels = {
        trial: '24 horas (Trial)',
        monthly: '30 dias (Mensal)',
        annual: '1 ano (Anual)',
        lifetime: 'Vitalício'
      };

      toast({
        title: 'Usuário criado com sucesso!',
        description: `Acesso ${planLabels[formData.subscription_plan]} concedido para ${formData.full_name}`,
      });

      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        subscription_plan: 'trial'
      });

      // Refresh the list
      fetchUsers();

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

  const handleEditPlan = (user: User) => {
    setEditingUser(user);
    setNewPlan((user.subscription_plan as 'trial' | 'monthly' | 'annual' | 'lifetime') || 'trial');
  };

  const handleUpdatePlan = async () => {
    if (!editingUser) return;
    
    setUpdatingPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-user-plan', {
        body: {
          userId: editingUser.id,
          newPlan: newPlan,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const planLabels = {
        trial: 'Trial (24h)',
        monthly: 'Mensal',
        annual: 'Anual',
        lifetime: 'Vitalício',
      };

      toast({
        title: 'Plano atualizado!',
        description: `${editingUser.full_name} agora está no plano ${planLabels[newPlan]}`,
      });

      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating plan:', error);
      toast({
        title: 'Erro ao atualizar plano',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPlan(false);
    }
  };

  const getStatusInfo = (user: User) => {
    if (!user.is_active) {
      return { label: 'Inativo', className: 'bg-destructive/20 text-destructive' };
    }

    if (user.subscription_plan === 'lifetime') {
      return { label: 'Vitalício', className: 'bg-primary/20 text-primary' };
    }

    if (user.subscription_plan === 'annual') {
      const expiresAt = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
      if (expiresAt && expiresAt > new Date()) {
        return { 
          label: `Anual até ${format(expiresAt, "dd/MM/yy", { locale: ptBR })}`, 
          className: 'bg-blue-500/20 text-blue-500' 
        };
      }
      return { label: 'Anual Expirado', className: 'bg-destructive/20 text-destructive' };
    }

    if (user.subscription_plan === 'monthly') {
      const expiresAt = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
      if (expiresAt && expiresAt > new Date()) {
        return { 
          label: `Mensal até ${format(expiresAt, "dd/MM/yy", { locale: ptBR })}`, 
          className: 'bg-purple-500/20 text-purple-500' 
        };
      }
      return { label: 'Mensal Expirado', className: 'bg-destructive/20 text-destructive' };
    }

    if (user.trial_expires_at) {
      const expiresAt = new Date(user.trial_expires_at);
      if (expiresAt > new Date()) {
        return { 
          label: `Trial até ${format(expiresAt, "dd/MM HH:mm", { locale: ptBR })}`, 
          className: 'bg-yellow-500/20 text-yellow-500' 
        };
      }
      return { label: 'Trial Expirado', className: 'bg-destructive/20 text-destructive' };
    }

    return { label: 'Ativo', className: 'bg-primary/20 text-primary' };
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-primary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Create Form */}
          <Card className="border-primary">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Criar Novo Usuário</CardTitle>
              <CardDescription>
                Escolha o tipo de plano abaixo
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

                <div className="space-y-2">
                  <Label>Tipo de Plano</Label>
                  <Select
                    value={formData.subscription_plan}
                    onValueChange={(value: 'trial' | 'monthly' | 'annual' | 'lifetime') => 
                      setFormData(prev => ({ ...prev, subscription_plan: value }))
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">🧪 Trial (24 horas)</SelectItem>
                      <SelectItem value="monthly">📅 Mensal (30 dias)</SelectItem>
                      <SelectItem value="annual">📆 Anual (365 dias)</SelectItem>
                      <SelectItem value="lifetime">♾️ Vitalício (sem expiração)</SelectItem>
                    </SelectContent>
                  </Select>
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
                      {formData.subscription_plan === 'trial' && 'Criar Usuário Trial'}
                      {formData.subscription_plan === 'monthly' && 'Criar Usuário Mensal'}
                      {formData.subscription_plan === 'annual' && 'Criar Usuário Anual'}
                      {formData.subscription_plan === 'lifetime' && 'Criar Usuário Vitalício'}
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

          {/* Users List */}
          <Card className="border-primary lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle>Todos os Usuários ({users.length})</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              {/* Search Field */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Plan Filters */}
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  variant={planFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlanFilter('all')}
                >
                  Todos ({planCounts.all})
                </Button>
                <Button
                  variant={planFilter === 'trial' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlanFilter('trial')}
                  className={planFilter === 'trial' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10'}
                >
                  🧪 Trial ({planCounts.trial})
                </Button>
                <Button
                  variant={planFilter === 'monthly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlanFilter('monthly')}
                  className={planFilter === 'monthly' ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'border-purple-500/50 text-purple-500 hover:bg-purple-500/10'}
                >
                  📅 Mensal ({planCounts.monthly})
                </Button>
                <Button
                  variant={planFilter === 'annual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlanFilter('annual')}
                  className={planFilter === 'annual' ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'border-blue-500/50 text-blue-500 hover:bg-blue-500/10'}
                >
                  📆 Anual ({planCounts.annual})
                </Button>
                <Button
                  variant={planFilter === 'lifetime' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlanFilter('lifetime')}
                  className={planFilter === 'lifetime' ? 'bg-primary hover:bg-primary/90' : 'border-primary/50 text-primary hover:bg-primary/10'}
                >
                  ♾️ Vitalício ({planCounts.lifetime})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? 'Nenhum usuário encontrado com esse filtro' : 'Nenhum usuário encontrado'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Senha</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => {
                        const statusInfo = getStatusInfo(user);
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.full_name || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm truncate max-w-[150px]">{user.email || '-'}</span>
                                {user.email && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 flex-shrink-0"
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
                                    className="h-6 w-6 p-0 flex-shrink-0"
                                    onClick={() => copyToClipboard(user.temp_password!)}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {user.created_at 
                                ? format(new Date(user.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${statusInfo.className}`}>
                                {statusInfo.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPlan(user)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
            <DialogDescription>
              Alterando plano de {editingUser?.full_name || editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Novo Plano</Label>
              <Select
                value={newPlan}
                onValueChange={(value: 'trial' | 'monthly' | 'annual' | 'lifetime') => setNewPlan(value)}
                disabled={updatingPlan}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">🧪 Trial (24 horas)</SelectItem>
                  <SelectItem value="monthly">📅 Mensal (30 dias)</SelectItem>
                  <SelectItem value="annual">📆 Anual (365 dias)</SelectItem>
                  <SelectItem value="lifetime">♾️ Vitalício (sem expiração)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {newPlan === 'trial' && 'O usuário terá acesso por mais 24 horas a partir de agora.'}
              {newPlan === 'monthly' && 'O usuário terá acesso por mais 30 dias a partir de agora.'}
              {newPlan === 'annual' && 'O usuário terá acesso por mais 365 dias a partir de agora.'}
              {newPlan === 'lifetime' && 'O usuário terá acesso vitalício, sem data de expiração.'}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={updatingPlan}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePlan} disabled={updatingPlan}>
              {updatingPlan ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
