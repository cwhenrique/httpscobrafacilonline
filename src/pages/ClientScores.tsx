import { useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useClients } from '@/hooks/useClients';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Star, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  Users,
  Award,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { calculateScoreLabel, getScoreIcon } from '@/hooks/useClientScore';

export default function ClientScores() {
  const { clients, loading } = useClients();

  const stats = useMemo(() => {
    if (clients.length === 0) return null;

    const avgScore = clients.reduce((sum, c) => sum + (c.score || 100), 0) / clients.length;
    const excellent = clients.filter(c => (c.score || 100) >= 120).length;
    const good = clients.filter(c => (c.score || 100) >= 100 && (c.score || 100) < 120).length;
    const regular = clients.filter(c => (c.score || 100) >= 70 && (c.score || 100) < 100).length;
    const bad = clients.filter(c => (c.score || 100) < 70).length;
    const totalOnTime = clients.reduce((sum, c) => sum + (c.on_time_payments || 0), 0);
    const totalLate = clients.reduce((sum, c) => sum + (c.late_payments || 0), 0);

    return {
      avgScore: Math.round(avgScore),
      excellent,
      good,
      regular,
      bad,
      totalOnTime,
      totalLate,
      total: clients.length,
    };
  }, [clients]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => (b.score || 100) - (a.score || 100));
  }, [clients]);

  const getScoreGradient = (score: number) => {
    if (score >= 120) return 'from-emerald-500 to-green-600';
    if (score >= 100) return 'from-blue-500 to-cyan-600';
    if (score >= 70) return 'from-yellow-500 to-amber-600';
    if (score >= 40) return 'from-orange-500 to-red-500';
    return 'from-red-600 to-rose-700';
  };

  const getTrendIcon = (score: number) => {
    if (score >= 100) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (score >= 70) return <Minus className="w-4 h-4 text-yellow-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const getScoreRingColor = (score: number) => {
    if (score >= 120) return 'stroke-emerald-500';
    if (score >= 100) return 'stroke-blue-500';
    if (score >= 70) return 'stroke-yellow-500';
    if (score >= 40) return 'stroke-orange-500';
    return 'stroke-red-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Award className="w-7 h-7 text-primary" />
            Score de Clientes
          </h1>
          <p className="text-muted-foreground">
            Acompanhe a pontuação de confiabilidade dos seus clientes atualizada automaticamente
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : stats && (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Score Médio</p>
                      <p className="text-3xl font-bold">{stats.avgScore}</p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                      <Star className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Excelentes</p>
                      <p className="text-3xl font-bold text-emerald-600">{stats.excellent}</p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                    </div>
                  </div>
                  <Progress value={(stats.excellent / stats.total) * 100} className="mt-3 h-2 bg-emerald-100" />
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Atenção</p>
                      <p className="text-3xl font-bold text-yellow-600">{stats.regular}</p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <Clock className="w-7 h-7 text-yellow-500" />
                    </div>
                  </div>
                  <Progress value={(stats.regular / stats.total) * 100} className="mt-3 h-2 bg-yellow-100" />
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500 bg-gradient-to-br from-red-500/5 to-red-500/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Críticos</p>
                      <p className="text-3xl font-bold text-red-600">{stats.bad}</p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                      <ShieldAlert className="w-7 h-7 text-red-500" />
                    </div>
                  </div>
                  <Progress value={(stats.bad / stats.total) * 100} className="mt-3 h-2 bg-red-100" />
                </CardContent>
              </Card>
            </div>

            {/* Payment Stats */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <ThumbsUp className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Pagamentos em Dia</p>
                      <p className="text-2xl font-bold text-green-600">{stats.totalOnTime}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">do total</p>
                      <p className="text-lg font-semibold text-green-600">
                        {stats.totalOnTime + stats.totalLate > 0 
                          ? Math.round((stats.totalOnTime / (stats.totalOnTime + stats.totalLate)) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                      <ThumbsDown className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Pagamentos Atrasados</p>
                      <p className="text-2xl font-bold text-red-600">{stats.totalLate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">do total</p>
                      <p className="text-lg font-semibold text-red-600">
                        {stats.totalOnTime + stats.totalLate > 0 
                          ? Math.round((stats.totalLate / (stats.totalOnTime + stats.totalLate)) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Score Explanation */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Como o Score é Calculado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span><strong>120-150:</strong> Excelente ⭐</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span><strong>100-119:</strong> Bom 👍</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span><strong>70-99:</strong> Regular 👌</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span><strong>0-69:</strong> Crítico 🚨</span>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs mt-3">
                  +2 pontos por pagamento em dia • -10 pontos por pagamento atrasado • +10 bônus para clientes fiéis
                </p>
              </CardContent>
            </Card>

            {/* Client List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Ranking de Clientes
                </CardTitle>
                <CardDescription>
                  Ordenado por pontuação - atualizado automaticamente após cada pagamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sortedClients.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum cliente cadastrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedClients.map((client, index) => {
                      const score = client.score || 100;
                      const { label, color } = calculateScoreLabel(score);
                      
                      return (
                        <div
                          key={client.id}
                          className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                        >
                          {/* Rank */}
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>

                          {/* Avatar */}
                          <Avatar className="h-12 w-12 border-2 border-background">
                            <AvatarImage src={client.avatar_url || undefined} alt={client.full_name} />
                            <AvatarFallback className="text-lg">
                              {client.full_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{client.full_name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="text-green-600">{client.on_time_payments || 0} em dia</span>
                              <span className="text-red-600">{client.late_payments || 0} atrasados</span>
                              <span>{client.total_loans || 0} empréstimos</span>
                            </div>
                          </div>

                          {/* Score Circle */}
                          <div className="relative w-16 h-16">
                            <svg className="w-16 h-16 -rotate-90">
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                                className="text-muted"
                              />
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={`${(score / 150) * 176} 176`}
                                strokeLinecap="round"
                                className={getScoreRingColor(score)}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-lg font-bold">{score}</span>
                            </div>
                          </div>

                          {/* Badge */}
                          <div className="hidden sm:flex flex-col items-end gap-1">
                            <Badge className={`${color} gap-1`}>
                              {getScoreIcon(score)} {label}
                            </Badge>
                            {getTrendIcon(score)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
