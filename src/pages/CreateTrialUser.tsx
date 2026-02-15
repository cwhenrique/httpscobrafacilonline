import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus, ArrowLeft, RefreshCw, Copy, Lock, Search, Users, Pencil, UserCheck, UserX, KeyRound, Download, Link as LinkIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AffiliateManagement } from '@/components/admin/AffiliateManagement';
import { UserAffiliateDialog } from '@/components/admin/UserAffiliateLink';

const USERS_PER_PAGE = 30;

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
  affiliate_email: string | null;
}

const ADMIN_USER = 'Clauclau';
const ADMIN_PASS = 'Yvv6okn4';

// Usuário restrito - apenas cria trials
const TRIAL_CREATOR_USER = 'diego';
const TRIAL_CREATOR_PASS = 'diego321';

export default function CreateTrialUser() {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTrialCreatorOnly, setIsTrialCreatorOnly] = useState(false); // diego user - only trial creation
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'trial' | 'monthly' | 'quarterly' | 'annual' | 'lifetime' | 'expired'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newPlan, setNewPlan] = useState<'trial' | 'monthly' | 'quarterly' | 'annual' | 'lifetime'>('trial');
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [affiliateLinkUser, setAffiliateLinkUser] = useState<User | null>(null);
  const [affiliates, setAffiliates] = useState<{ id: string; email: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    subscription_plan: 'trial' as 'trial' | 'monthly' | 'quarterly' | 'annual' | 'lifetime',
    affiliate_email: '' as string
  });

  useEffect(() => {
    const authStatus = sessionStorage.getItem('trial_admin_auth');
    const trialCreatorStatus = sessionStorage.getItem('trial_creator_only');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      setIsTrialCreatorOnly(trialCreatorStatus === 'true');
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    setTimeout(() => {
      // Admin full access
      if (loginData.username === ADMIN_USER && loginData.password === ADMIN_PASS) {
        sessionStorage.setItem('trial_admin_auth', 'true');
        sessionStorage.setItem('trial_creator_only', 'false');
        setIsAuthenticated(true);
        setIsTrialCreatorOnly(false);
        toast({ title: 'Acesso autorizado!' });
      } 
      // Diego - only trial creation
      else if (loginData.username === TRIAL_CREATOR_USER && loginData.password === TRIAL_CREATOR_PASS) {
        sessionStorage.setItem('trial_admin_auth', 'true');
        sessionStorage.setItem('trial_creator_only', 'true');
        setIsAuthenticated(true);
        setIsTrialCreatorOnly(true);
        toast({ title: 'Acesso autorizado!', description: 'Você pode criar apenas usuários de teste (Trial)' });
      }
      else {
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

  // Fetch affiliates for form
  const fetchAffiliates = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('id, email, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      console.log('Affiliates fetched:', data);
      setAffiliates(data || []);
    } catch (error) {
      console.error('Error fetching affiliates:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAffiliates();
    }
  }, [isAuthenticated]);

  const planCounts = useMemo(() => {
    const now = new Date();
    
    // Users who had paid plans (not trial) but expired
    const expiredPaidUsers = users.filter(u => {
      // Must not be trial or empty plan (those are trial users)
      const isTrial = u.subscription_plan === 'trial' || !u.subscription_plan;
      if (isTrial) return false;
      
      // Must not be lifetime (never expires)
      if (u.subscription_plan === 'lifetime') return false;
      
      // Check if subscription expired
      if (u.subscription_expires_at) {
        const expiresAt = new Date(u.subscription_expires_at);
        return expiresAt < now;
      }
      
      return false;
    });

    return {
      all: users.length,
      trial: users.filter(u => u.subscription_plan === 'trial' || !u.subscription_plan).length,
      monthly: users.filter(u => u.subscription_plan === 'monthly').length,
      quarterly: users.filter(u => u.subscription_plan === 'quarterly').length,
      annual: users.filter(u => u.subscription_plan === 'annual').length,
      lifetime: users.filter(u => u.subscription_plan === 'lifetime').length,
      expired: expiredPaidUsers.length,
    };
  }, [users]);

  // Filter trial users for Diego's view
  const trialUsers = useMemo(() => {
    return users.filter(u => u.subscription_plan === 'trial' || !u.subscription_plan);
  }, [users]);

  // Filtered trial users for Diego's search
  const filteredTrialUsers = useMemo(() => {
    let result = trialUsers;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(user => 
        (user.full_name?.toLowerCase().includes(query)) ||
        (user.email?.toLowerCase().includes(query))
      );
    }
    return result;
  }, [trialUsers, searchQuery]);

  const filteredUsers = useMemo(() => {
    let result = users;
    const now = new Date();
    
    // Filtrar por plano
    if (planFilter !== 'all') {
      if (planFilter === 'trial') {
        result = result.filter(user => user.subscription_plan === 'trial' || !user.subscription_plan);
      } else if (planFilter === 'quarterly') {
        result = result.filter(user => user.subscription_plan === 'quarterly');
      } else if (planFilter === 'expired') {
        // Filter expired paid users (not trial, not lifetime)
        result = result.filter(user => {
          const isTrial = user.subscription_plan === 'trial' || !user.subscription_plan;
          if (isTrial) return false;
          if (user.subscription_plan === 'lifetime') return false;
          
          if (user.subscription_expires_at) {
            const expiresAt = new Date(user.subscription_expires_at);
            return expiresAt < now;
          }
          return false;
        });
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, planFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

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
      // Force trial plan for restricted user (diego)
      const planToUse = isTrialCreatorOnly ? 'trial' : formData.subscription_plan;
      
      const { data, error } = await supabase.functions.invoke('create-trial-user', {
        body: {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          phone: formData.phone,
          subscription_plan: planToUse,
          affiliate_email: formData.affiliate_email || null
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const planLabels = {
        trial: '24 horas (Trial)',
        monthly: '30 dias (Mensal)',
        quarterly: '90 dias (Trimestral)',
        annual: '1 ano (Anual)',
        lifetime: 'Vitalício'
      };

      toast({
        title: 'Usuário criado com sucesso!',
        description: `Acesso ${planLabels[planToUse]} concedido para ${formData.full_name}`,
      });

      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        subscription_plan: 'trial',
        affiliate_email: ''
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

      const { data, error } = await supabase.functions.invoke('send-test-message', {
        body: {
          phone: '17992415708',
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
    setNewPlan((user.subscription_plan as 'trial' | 'monthly' | 'quarterly' | 'annual' | 'lifetime') || 'trial');
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
        quarterly: 'Trimestral',
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

  const handleResetPassword = async () => {
    if (!editingUser) return;
    
    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: {
          userId: editingUser.id,
          newPassword: '123456',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Senha resetada!',
        description: `A senha de ${editingUser.full_name || editingUser.email} foi alterada para: 123456`,
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Erro ao resetar senha',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleToggleUserActive = async (user: User) => {
    const newStatus = !user.is_active;
    
    try {
      const { data, error } = await supabase.functions.invoke('admin-toggle-user-status', {
        body: { userId: user.id, newStatus }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: newStatus ? 'Usuário ativado!' : 'Usuário inativado!',
        description: `${user.full_name || user.email} foi ${newStatus ? 'ativado' : 'inativado'} com sucesso.`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      toast({
        title: 'Erro ao alterar status',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
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

    if (user.subscription_plan === 'quarterly') {
      const expiresAt = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
      if (expiresAt && expiresAt > new Date()) {
        return { 
          label: `Trimestral até ${format(expiresAt, "dd/MM/yy", { locale: ptBR })}`, 
          className: 'bg-cyan-500/20 text-cyan-500' 
        };
      }
      return { label: 'Trimestral Expirado', className: 'bg-destructive/20 text-destructive' };
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

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      toast({
        title: 'Nenhum usuário para exportar',
        description: 'Não há usuários na aba selecionada',
        variant: 'destructive'
      });
      return;
    }

    const planLabels: Record<string, string> = {
      all: 'todos',
      trial: 'trial',
      monthly: 'mensal',
      quarterly: 'trimestral',
      annual: 'anual',
      lifetime: 'vitalicio',
      expired: 'expirados'
    };

    const fileName = `usuarios_${planLabels[planFilter]}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    const headers = ['Nome', 'Email', 'Telefone'];
    const rows = filteredUsers.map(user => [
      user.full_name || '',
      user.email || '',
      user.phone || ''
    ]);

    const escapeCSV = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({
      title: 'Exportação concluída!',
      description: `${filteredUsers.length} usuários exportados para ${fileName}`,
    });
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

        {/* Tabs for admin - show affiliates tab */}
        {!isTrialCreatorOnly ? (
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Usuários
              </TabsTrigger>
              <TabsTrigger value="affiliates" className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Afiliados
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <div className="grid gap-6 lg:grid-cols-3">
          {/* Create Form */}
          <Card className={`border-primary ${isTrialCreatorOnly ? '' : ''}`}>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                {isTrialCreatorOnly ? 'Criar Usuário' : 'Criar Novo Usuário'}
              </CardTitle>
              <CardDescription>
                {isTrialCreatorOnly 
                  ? 'Crie usuários com acesso de 24 horas'
                  : 'Escolha o tipo de plano abaixo'}
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

                {/* Show plan selector only for admin, force trial for diego */}
                {isTrialCreatorOnly ? (
                  <div className="space-y-2">
                    <Label>Tipo de Plano</Label>
                    <div className="p-3 bg-muted rounded-md text-sm">
                      🧪 Trial (24 horas) - <span className="text-muted-foreground">Único plano disponível</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Tipo de Plano</Label>
                    <Select
                      value={formData.subscription_plan}
                      onValueChange={(value: 'trial' | 'monthly' | 'quarterly' | 'annual' | 'lifetime') => 
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
                        <SelectItem value="quarterly">📆 Trimestral (90 dias)</SelectItem>
                        <SelectItem value="annual">📆 Anual (365 dias)</SelectItem>
                        <SelectItem value="lifetime">♾️ Vitalício (sem expiração)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Affiliate selector - always visible */}
                <div className="space-y-2">
                  <Label>Vincular Afiliado (Opcional)</Label>
                  <Select
                    value={formData.affiliate_email || 'none'}
                    onValueChange={(value) => 
                      setFormData(prev => ({ ...prev, affiliate_email: value === 'none' ? '' : value }))
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um afiliado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Sem afiliado</span>
                      </SelectItem>
                      {affiliates.map((affiliate) => (
                        <SelectItem key={affiliate.id} value={affiliate.email}>
                          <span className="flex items-center gap-2">
                            <LinkIcon className="w-3 h-3" />
                            {affiliate.name}
                          </span>
                        </SelectItem>
                      ))}
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
                      {isTrialCreatorOnly ? 'Criar Usuário' : (
                        <>
                          {formData.subscription_plan === 'trial' && 'Criar Usuário Trial'}
                          {formData.subscription_plan === 'monthly' && 'Criar Usuário Mensal'}
                          {formData.subscription_plan === 'quarterly' && 'Criar Usuário Trimestral'}
                          {formData.subscription_plan === 'annual' && 'Criar Usuário Anual'}
                          {formData.subscription_plan === 'lifetime' && 'Criar Usuário Vitalício'}
                        </>
                      )}
                    </>
                  )}
                </Button>

                {!isTrialCreatorOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleSendTestWhatsApp}
                    disabled={loading}
                  >
                    Enviar mensagem de teste por WhatsApp
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Users List - hidden for trial creator only */}
          {!isTrialCreatorOnly && (
          <Card className="border-primary lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle>Todos os Usuários ({users.length})</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={loadingUsers || filteredUsers.length === 0}
                    title={`Exportar ${filteredUsers.length} usuários`}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Exportar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchUsers}
                    disabled={loadingUsers}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
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
                  variant={planFilter === 'quarterly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlanFilter('quarterly')}
                  className={planFilter === 'quarterly' ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10'}
                >
                  📆 Trimestral ({planCounts.quarterly})
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
                <Button
                  variant={planFilter === 'expired' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlanFilter('expired')}
                  className={planFilter === 'expired' ? 'bg-destructive hover:bg-destructive/90 text-white' : 'border-destructive/50 text-destructive hover:bg-destructive/10'}
                >
                  ⚠️ Expirados ({planCounts.expired})
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
                        <TableHead>Telefone</TableHead>
                        <TableHead>Senha</TableHead>
                        <TableHead>Afiliado</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((user) => {
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
                                <span className="text-sm">{user.phone || '-'}</span>
                                {user.phone && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 flex-shrink-0"
                                    onClick={() => copyToClipboard(user.phone!)}
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
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-auto py-1 px-2 text-xs ${user.affiliate_email ? 'text-primary' : 'text-muted-foreground'}`}
                                onClick={() => setAffiliateLinkUser(user)}
                              >
                                <LinkIcon className="w-3 h-3 mr-1" />
                                {user.affiliate_email ? (
                                  <span className="truncate max-w-[100px]">{user.affiliate_email}</span>
                                ) : (
                                  'Vincular'
                                )}
                              </Button>
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
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={user.is_active}
                                  onCheckedChange={() => handleToggleUserActive(user)}
                                />
                                {user.is_active ? (
                                  <UserCheck className="w-4 h-4 text-primary" />
                                ) : (
                                  <UserX className="w-4 h-4 text-destructive" />
                                )}
                              </div>
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
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Mostrando {((currentPage - 1) * USERS_PER_PAGE) + 1} a {Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} de {filteredUsers.length} usuários
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {getPageNumbers().map((page, idx) => (
                          page === 'ellipsis' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
                          ) : (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="min-w-[32px]"
                            >
                              {page}
                            </Button>
                          )
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>
              </TabsContent>

              <TabsContent value="affiliates">
                <AffiliateManagement />
              </TabsContent>
            </Tabs>
        ) : (
          // Trial creator only - form + trial users list
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Create Form - 1 column */}
            <Card className="border-primary h-fit">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Criar Usuário</CardTitle>
                <CardDescription>
                  Crie usuários com acesso de 24 horas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name_trial">Nome Completo</Label>
                    <Input
                      id="full_name_trial"
                      type="text"
                      placeholder="Nome do usuário"
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email_trial">Email</Label>
                    <Input
                      id="email_trial"
                      type="email"
                      placeholder="email@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_trial">Telefone (WhatsApp)</Label>
                    <Input
                      id="phone_trial"
                      type="tel"
                      placeholder="17999999999"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password_trial">Senha</Label>
                    <Input
                      id="password_trial"
                      type="text"
                      placeholder="Mínimo 6 caracteres"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Plano</Label>
                    <div className="p-3 bg-muted rounded-md text-sm">
                      🧪 Trial (24 horas) - <span className="text-muted-foreground">Único plano disponível</span>
                    </div>
                  </div>

                  {/* Affiliate selector for Diego */}
                  <div className="space-y-2">
                    <Label>Vincular Afiliado (Opcional)</Label>
                    <Select
                      value={formData.affiliate_email || 'none'}
                      onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, affiliate_email: value === 'none' ? '' : value }))
                      }
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um afiliado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">Sem afiliado</span>
                        </SelectItem>
                        {affiliates.map((affiliate) => (
                          <SelectItem key={affiliate.id} value={affiliate.email}>
                            <span className="flex items-center gap-2">
                              <LinkIcon className="w-3 h-3" />
                              {affiliate.name}
                            </span>
                          </SelectItem>
                        ))}
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
                        Criar Usuário
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Trial Users List - 2 columns */}
            <Card className="border-primary lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <CardTitle>Usuários Trial ({trialUsers.length})</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loadingUsers}>
                    <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                {/* Search field */}
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTrialUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'Nenhum usuário encontrado para a busca.' : 'Nenhum usuário Trial cadastrado.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Cadastrado em</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTrialUsers.slice(0, 50).map((user) => {
                            const now = new Date();
                            let statusLabel = 'Trial';
                            let statusClass = 'bg-primary/20 text-primary';
                            
                            if (user.trial_expires_at) {
                              const expiresAt = new Date(user.trial_expires_at);
                              if (expiresAt < now) {
                                statusLabel = 'Expirado';
                                statusClass = 'bg-destructive/20 text-destructive';
                              } else {
                                statusLabel = `Até ${format(expiresAt, "dd/MM HH:mm", { locale: ptBR })}`;
                                statusClass = 'bg-accent text-accent-foreground';
                              }
                            }
                            
                            return (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.full_name || '-'}</TableCell>
                                <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                                <TableCell>{user.phone || '-'}</TableCell>
                                <TableCell>
                                  <span className={`text-xs px-2 py-1 rounded ${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {user.created_at 
                                    ? format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })
                                    : '-'
                                  }
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredTrialUsers.length > 50 && (
                      <p className="text-sm text-muted-foreground text-center">
                        Mostrando 50 de {filteredTrialUsers.length} usuários. Use a busca para encontrar usuários específicos.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Plan Dialog - hidden for trial creator only */}
      {!isTrialCreatorOnly && (
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
            <DialogDescription>
              Alterando plano de {editingUser?.full_name || editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Resetar Senha */}
            <div className="p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Resetar Senha</p>
                    <p className="text-xs text-muted-foreground">A nova senha será: 123456</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                >
                  {resettingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Resetar'
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Novo Plano</Label>
              <Select
                value={newPlan}
                onValueChange={(value: 'trial' | 'monthly' | 'quarterly' | 'annual' | 'lifetime') => setNewPlan(value)}
                disabled={updatingPlan}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">🧪 Trial (24 horas)</SelectItem>
                  <SelectItem value="monthly">📅 Mensal (30 dias)</SelectItem>
                  <SelectItem value="quarterly">📆 Trimestral (90 dias)</SelectItem>
                  <SelectItem value="annual">📆 Anual (365 dias)</SelectItem>
                  <SelectItem value="lifetime">♾️ Vitalício (sem expiração)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {newPlan === 'trial' && 'O usuário terá acesso por mais 24 horas a partir de agora.'}
              {newPlan === 'monthly' && 'O usuário terá acesso por mais 30 dias a partir de agora.'}
              {newPlan === 'quarterly' && 'O usuário terá acesso por mais 90 dias a partir de agora.'}
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
      )}

      {/* User Affiliate Link Dialog */}
      {affiliateLinkUser && (
        <UserAffiliateDialog
          open={!!affiliateLinkUser}
          onOpenChange={(open) => !open && setAffiliateLinkUser(null)}
          userId={affiliateLinkUser.id}
          userName={affiliateLinkUser.full_name}
          userEmail={affiliateLinkUser.email}
          currentAffiliateEmail={affiliateLinkUser.affiliate_email}
          onSuccess={fetchUsers}
        />
      )}
    </div>
  );
}
