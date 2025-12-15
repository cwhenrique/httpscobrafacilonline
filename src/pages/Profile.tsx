import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Calendar, 
  Edit, 
  CheckCircle,
  DollarSign,
  Users,
  TrendingUp,
  Save,
  X,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  KeyRound,
  Eye,
  EyeOff,
  Crown,
  Clock,
  Infinity,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading, updateProfile, refetch } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    company_name: '',
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [stats, setStats] = useState({
    totalClients: 0,
    totalLoans: 0,
    totalLent: 0,
    totalReceived: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: formatPhone(profile.phone || ''),
        company_name: profile.company_name || '',
      });
    }
  }, [profile]);

  const fetchStats = async () => {
    if (!user) return;

    const [clientsResult, loansResult] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('loans').select('principal_amount, total_paid').eq('user_id', user.id),
    ]);

    const totalClients = clientsResult.count || 0;
    const loans = loansResult.data || [];
    const totalLoans = loans.length;
    const totalLent = loans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
    const totalReceived = loans.reduce((sum, loan) => sum + Number(loan.total_paid || 0), 0);

    setStats({ totalClients, totalLoans, totalLent, totalReceived });
    setLoadingStats(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateString));
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const phoneNumbers = formData.phone.replace(/\D/g, '');
    if (!phoneNumbers || phoneNumbers.length < 10) {
      toast.error('Telefone inválido');
      return;
    }

    setSaving(true);
    const { error } = await updateProfile({
      full_name: formData.full_name.trim(),
      phone: phoneNumbers,
      company_name: formData.company_name.trim() || null,
    });

    if (error) {
      toast.error('Erro ao salvar perfil');
    } else {
      toast.success('Perfil atualizado com sucesso!');
      setIsEditing(false);
      refetch();
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setFormData({
      full_name: profile?.full_name || '',
      phone: formatPhone(profile?.phone || ''),
      company_name: profile?.company_name || '',
    });
    setIsEditing(false);
  };

  const handleTestWhatsApp = async () => {
    if (!profile?.phone) {
      toast.error('Cadastre um número de telefone primeiro');
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone: profile.phone,
          message: `🧪 *Teste do CobraFácil*\n\nOlá ${profile.full_name || ''}!\n\nEsta é uma mensagem de teste do sistema de notificações.\n\n✅ Se você está recebendo esta mensagem, a integração com WhatsApp está funcionando corretamente!\n\n_Mensagem automática de teste_`,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success('Mensagem de teste enviada com sucesso!');
      } else {
        throw new Error(data?.error || 'Erro ao enviar mensagem');
      }
    } catch (error: any) {
      console.error('Error sending test:', error);
      toast.error(`Erro ao enviar teste: ${error.message}`);
    }
    setSendingTest(false);
  };

  const handleChangePassword = async () => {
    if (!passwordData.newPassword) {
      toast.error('Digite a nova senha');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast.success('Senha alterada com sucesso!');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(`Erro ao alterar senha: ${error.message}`);
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Meu Perfil</h1>
            <p className="text-muted-foreground">Informações da sua conta</p>
          </div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Editar Perfil
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleCancel} variant="outline" disabled={saving}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <Card className="shadow-soft overflow-hidden">
          <div className="h-24 gradient-primary" />
          <CardContent className="relative pt-0">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
              <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                  {getInitials(formData.full_name || profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditing ? (
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Seu nome completo"
                      className="max-w-xs text-xl font-bold h-auto py-1"
                    />
                  ) : (
                    <h2 className="text-xl font-bold">{profile?.full_name || 'Usuário'}</h2>
                  )}
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Ativo
                  </Badge>
                </div>
                {isEditing ? (
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Nome da empresa (opcional)"
                    className="max-w-xs mt-2 h-auto py-1 text-sm"
                  />
                ) : (
                  profile?.company_name && (
                    <p className="text-muted-foreground">{profile.company_name}</p>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <p className="font-medium">{profile?.email || user?.email}</p>
                  <p className="text-xs text-muted-foreground">Não pode ser alterado</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  {isEditing ? (
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">
                      {profile?.phone ? (
                        `(${profile.phone.slice(0, 2)}) ${profile.phone.slice(2, 7)}-${profile.phone.slice(7)}`
                      ) : (
                        <span className="text-muted-foreground">Não informado</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {(profile?.company_name || isEditing) && !isEditing && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Building className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="font-medium">{profile?.company_name || 'Não informado'}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Membro desde</p>
                  <p className="font-medium">
                    {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Estatísticas da Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingStats ? (
                <>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total de Clientes</p>
                      <p className="font-bold text-lg">{stats.totalClients}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <DollarSign className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Emprestado</p>
                      <p className="font-bold text-lg">{formatCurrency(stats.totalLent)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Recebido</p>
                      <p className="font-bold text-lg">{formatCurrency(stats.totalReceived)}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Subscription Card */}
        <Card className="shadow-soft border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Crown className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Plano Atual</p>
                <p className="font-bold text-lg capitalize">
                  {profile?.subscription_plan === 'lifetime' && 'Vitalício'}
                  {profile?.subscription_plan === 'annual' && 'Anual'}
                  {profile?.subscription_plan === 'monthly' && 'Mensal'}
                  {profile?.subscription_plan === 'trial' && 'Teste'}
                  {!profile?.subscription_plan && 'Não definido'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                profile?.subscription_plan === 'lifetime' 
                  ? 'bg-green-500/10' 
                  : profile?.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date()
                    ? 'bg-red-500/10'
                    : 'bg-blue-500/10'
              }`}>
                {profile?.subscription_plan === 'lifetime' ? (
                  <Infinity className="w-4 h-4 text-green-500" />
                ) : profile?.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date() ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Clock className="w-4 h-4 text-blue-500" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Válido até</p>
                <p className={`font-bold text-lg ${
                  profile?.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date()
                    ? 'text-red-500'
                    : ''
                }`}>
                  {profile?.subscription_plan === 'lifetime' ? (
                    <span className="text-green-500">♾️ Acesso Vitalício</span>
                  ) : profile?.subscription_expires_at ? (
                    formatDate(profile.subscription_expires_at)
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>
            </div>

            {/* Days Remaining / Days Active */}
            {profile?.subscription_plan === 'lifetime' && user?.created_at && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Membro Ativo Há</p>
                  <p className="font-bold text-lg text-green-500">
                    {Math.floor((new Date().getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))} dias
                  </p>
                </div>
              </div>
            )}

            {profile?.subscription_plan !== 'lifetime' && profile?.subscription_expires_at && (() => {
              const expiresAt = new Date(profile.subscription_expires_at);
              const today = new Date();
              const diffTime = expiresAt.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              return (
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    diffDays > 30 
                      ? 'bg-green-500/10' 
                      : diffDays > 7 
                        ? 'bg-amber-500/10' 
                        : 'bg-red-500/10'
                  }`}>
                    <Clock className={`w-4 h-4 ${
                      diffDays > 30 
                        ? 'text-green-500' 
                        : diffDays > 7 
                          ? 'text-amber-500' 
                          : 'text-red-500'
                    }`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dias Restantes</p>
                    <p className={`font-bold text-lg ${
                      diffDays > 30 
                        ? 'text-green-500' 
                        : diffDays > 7 
                          ? 'text-amber-500' 
                          : 'text-red-500'
                    }`}>
                      {diffDays > 0 ? `${diffDays} dias` : 'Expirado'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {profile?.subscription_expires_at && 
             new Date(profile.subscription_expires_at) < new Date() && 
             profile?.subscription_plan !== 'lifetime' && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-red-500 mb-3">
                  Sua assinatura expirou. Renove para continuar usando o sistema.
                </p>
                <Button 
                  asChild
                  className="gap-2 bg-amber-500 hover:bg-amber-600"
                >
                  <a href="https://pay.cakto.com.br/fhwfptb" target="_blank" rel="noopener noreferrer">
                    <Crown className="w-4 h-4" />
                    Renovar Assinatura
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Test Card */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              Teste de Notificações WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Envie uma mensagem de teste para verificar se as notificações estão funcionando corretamente.
            </p>
            <Button 
              onClick={handleTestWhatsApp} 
              disabled={sendingTest || !profile?.phone}
              className="gap-2"
            >
              {sendingTest ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Teste para WhatsApp
                </>
              )}
            </Button>
            {!profile?.phone && (
              <p className="text-xs text-destructive mt-2">
                Cadastre um número de telefone para testar
              </p>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Digite uma nova senha para sua conta. A senha deve ter pelo menos 6 caracteres.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Digite a nova senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirme a nova senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              className="gap-2"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Alterar Senha
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
