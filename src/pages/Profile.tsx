import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const navigate = useNavigate();
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

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
          <Button onClick={() => navigate('/settings')} variant="outline">
            <Edit className="w-4 h-4 mr-2" />
            Editar Perfil
          </Button>
        </div>

        {/* Profile Card */}
        <Card className="shadow-soft overflow-hidden">
          <div className="h-24 gradient-primary" />
          <CardContent className="relative pt-0">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
              <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">{profile?.full_name || 'Usuário'}</h2>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Ativo
                  </Badge>
                </div>
                {profile?.company_name && (
                  <p className="text-muted-foreground">{profile.company_name}</p>
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
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{profile?.email || user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">
                    {profile?.phone ? (
                      `(${profile.phone.slice(0, 2)}) ${profile.phone.slice(2, 7)}-${profile.phone.slice(7)}`
                    ) : (
                      <span className="text-muted-foreground">Não informado</span>
                    )}
                  </p>
                </div>
              </div>
              {profile?.company_name && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Building className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="font-medium">{profile.company_name}</p>
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
      </div>
    </DashboardLayout>
  );
}
