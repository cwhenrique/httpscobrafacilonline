import { useMemo, useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useClients } from '@/hooks/useClients';
import { useLoans } from '@/hooks/useLoans';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  ThumbsDown,
  DollarSign,
  Wallet,
  Sparkles,
  Pencil,
  History
} from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { calculateScoreLabel, getScoreIcon } from '@/hooks/useClientScore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Client } from '@/types/database';

export default function ClientScores() {
  const { clients, loading, invalidateClients } = useClients();
  const { loans } = useLoans();
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<'score' | 'profit'>('score');
  const [loanPayments, setLoanPayments] = useState<Array<{ loan_id: string; interest_paid: number | null }>>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  
  // Estado para edição de score
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newScore, setNewScore] = useState(100);
  const [scoreReason, setScoreReason] = useState('');

  // Buscar todos os pagamentos para calcular interesse real recebido
  useEffect(() => {
    const fetchPayments = async () => {
      if (!user) return;
      setLoadingPayments(true);
      const { data } = await supabase
        .from('loan_payments')
        .select('loan_id, interest_paid')
        .eq('user_id', user.id);
      setLoanPayments(data || []);
      setLoadingPayments(false);
    };
    fetchPayments();
  }, [user]);

  // Abrir modal de edição de score
  const openEditScoreModal = (client: Client) => {
    setEditingClient(client);
    setNewScore(client.score || 100);
    setScoreReason('');
  };

  // Salvar score editado
  const saveScore = async () => {
    if (!editingClient) return;
    
    try {
      const updatedNotes = scoreReason 
        ? `${editingClient.notes || ''}\n[SCORE_MANUAL:${newScore}] ${scoreReason} - ${new Date().toLocaleDateString('pt-BR')}`
        : editingClient.notes;
      
      const { error } = await supabase
        .from('clients')
        .update({ 
          score: newScore,
          score_updated_at: new Date().toISOString(),
          notes: updatedNotes,
        })
        .eq('id', editingClient.id);
      
      if (error) throw error;
      
      invalidateClients();
      setEditingClient(null);
      toast.success('Score atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating score:', error);
      toast.error('Erro ao atualizar score');
    }
  };

  // Calcular lucro por cliente usando interest_paid como fonte de verdade
  const clientProfitMap = useMemo(() => {
    // Criar mapa de interest_paid por loan_id
    const interestByLoan = new Map<string, number>();
    loanPayments.forEach(payment => {
      const current = interestByLoan.get(payment.loan_id) || 0;
      interestByLoan.set(payment.loan_id, current + (payment.interest_paid || 0));
    });

    const map = new Map<string, { 
      expectedProfit: number; 
      realizedProfit: number; 
      extraProfit: number; 
      totalPrincipal: number;
      paidLoansCount: number;
      activeLoansCount: number;
      profitFromPaidLoans: number;
      profitFromActiveLoans: number;
    }>();
    
    loans.forEach(loan => {
      const existing = map.get(loan.client_id) || { 
        expectedProfit: 0, 
        realizedProfit: 0, 
        extraProfit: 0, 
        totalPrincipal: 0,
        paidLoansCount: 0,
        activeLoansCount: 0,
        profitFromPaidLoans: 0,
        profitFromActiveLoans: 0,
      };
      
      // Lucro previsto = total de juros do contrato
      const expectedProfit = loan.total_interest || 0;
      
      // Lucro realizado = SOMA REAL de interest_paid dos pagamentos (fonte de verdade)
      const actualInterestReceived = interestByLoan.get(loan.id) || 0;
      
      // Lucro realizado limitado ao previsto (máximo 100%)
      const realizedProfit = Math.min(actualInterestReceived, expectedProfit);
      
      // Lucro EXTRA = o que passou do previsto (multas, penalidades)
      const extraProfit = Math.max(0, actualInterestReceived - expectedProfit);
      
      // Contar por status e separar lucro
      const isPaid = loan.status === 'paid';
      
      map.set(loan.client_id, {
        expectedProfit: existing.expectedProfit + expectedProfit,
        realizedProfit: existing.realizedProfit + realizedProfit,
        extraProfit: existing.extraProfit + extraProfit,
        totalPrincipal: existing.totalPrincipal + loan.principal_amount,
        paidLoansCount: existing.paidLoansCount + (isPaid ? 1 : 0),
        activeLoansCount: existing.activeLoansCount + (isPaid ? 0 : 1),
        profitFromPaidLoans: existing.profitFromPaidLoans + (isPaid ? realizedProfit : 0),
        profitFromActiveLoans: existing.profitFromActiveLoans + (isPaid ? 0 : realizedProfit),
      });
    });
    
    return map;
  }, [loans, loanPayments]);

  const stats = useMemo(() => {
    if (clients.length === 0) return null;

    const avgScore = clients.reduce((sum, c) => sum + (c.score || 100), 0) / clients.length;
    const excellent = clients.filter(c => (c.score || 100) >= 120).length;
    const good = clients.filter(c => (c.score || 100) >= 100 && (c.score || 100) < 120).length;
    const regular = clients.filter(c => (c.score || 100) >= 70 && (c.score || 100) < 100).length;
    const bad = clients.filter(c => (c.score || 100) < 70).length;
    const totalOnTime = clients.reduce((sum, c) => sum + (c.on_time_payments || 0), 0);
    const totalLate = clients.reduce((sum, c) => sum + (c.late_payments || 0), 0);

    // Lucro total de todos os clientes
    let totalExpectedProfit = 0;
    let totalRealizedProfit = 0;
    let totalExtraProfit = 0;
    
    clientProfitMap.forEach(({ expectedProfit, realizedProfit, extraProfit }) => {
      totalExpectedProfit += expectedProfit;
      totalRealizedProfit += realizedProfit;
      totalExtraProfit += extraProfit;
    });

    return {
      avgScore: Math.round(avgScore),
      excellent,
      good,
      regular,
      bad,
      totalOnTime,
      totalLate,
      total: clients.length,
      totalExpectedProfit,
      totalRealizedProfit,
      totalExtraProfit,
    };
  }, [clients, clientProfitMap]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      if (sortBy === 'profit') {
        const profitA = clientProfitMap.get(a.id)?.realizedProfit || 0;
        const profitB = clientProfitMap.get(b.id)?.realizedProfit || 0;
        return profitB - profitA;
      }
      return (b.score || 100) - (a.score || 100);
    });
  }, [clients, sortBy, clientProfitMap]);

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

        {loading || loadingPayments ? (
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

            {/* Profit Stats */}
            <div className={`grid gap-4 ${stats.totalExtraProfit > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Lucro Previsto Total</p>
                      <p className="text-2xl sm:text-3xl font-bold text-blue-600">{formatCurrency(stats.totalExpectedProfit)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Soma de juros de todos os contratos
                      </p>
                    </div>
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Wallet className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Lucro Realizado Total</p>
                      <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{formatCurrency(stats.totalRealizedProfit)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.totalExpectedProfit > 0 
                          ? `${Math.round((stats.totalRealizedProfit / stats.totalExpectedProfit) * 100)}% do previsto`
                          : 'Nenhum lucro previsto'}
                      </p>
                    </div>
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {stats.totalExtraProfit > 0 && (
                <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-500/5 to-purple-500/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Lucro Extra</p>
                        <p className="text-2xl sm:text-3xl font-bold text-purple-500">+{formatCurrency(stats.totalExtraProfit)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Multas e penalidades
                        </p>
                      </div>
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-purple-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                  +3 pontos por pagamento em dia • -20 pontos por atraso • -30 pontos por atraso crítico (+30d) • +15 bônus fidelidade
                </p>
                <p className="text-muted-foreground text-[10px] mt-1 flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Você pode editar o score manualmente clicando no ícone de lápis
                </p>
              </CardContent>
            </Card>

            {/* Client List */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Ranking de Clientes
                    </CardTitle>
                    <CardDescription>
                      {sortBy === 'score' 
                        ? 'Ordenado por pontuação' 
                        : 'Ordenado por lucro realizado'} - atualizado automaticamente
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant={sortBy === 'score' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setSortBy('score')}
                    >
                      <Star className="w-4 h-4 mr-1" />
                      Por Score
                    </Button>
                    <Button 
                      variant={sortBy === 'profit' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setSortBy('profit')}
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Por Lucro
                    </Button>
                  </div>
                </div>
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
                      
                      const profit = clientProfitMap.get(client.id);
                      const profitPercentage = profit && profit.expectedProfit > 0 
                        ? Math.round((profit.realizedProfit / profit.expectedProfit) * 100) 
                        : 0;
                      
                      return (
                        <div
                          key={client.id}
                          className="p-3 sm:p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                        >
                          {/* Header: Rank + Avatar + Name + Score */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            {/* Rank */}
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
                              {index + 1}
                            </div>

                            {/* Avatar */}
                            <Avatar className="h-9 w-9 sm:h-12 sm:w-12 border-2 border-background shrink-0">
                              <AvatarImage src={client.avatar_url || undefined} alt={client.full_name} />
                              <AvatarFallback className="text-sm sm:text-lg">
                                {client.full_name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            {/* Name + Badge */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-sm sm:text-base">{client.full_name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge className={`${color} gap-1 text-[9px] sm:text-[10px] px-1.5 py-0`}>
                                  {getScoreIcon(score)} {label}
                                </Badge>
                                {getTrendIcon(score)}
                              </div>
                            </div>

                            {/* Score Circle + Edit Button */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6 sm:w-8 sm:h-8"
                                onClick={() => openEditScoreModal(client)}
                              >
                                <Pencil className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                              </Button>
                              <div className="relative w-11 h-11 sm:w-14 sm:h-14">
                                <svg className="w-11 h-11 sm:w-14 sm:h-14 -rotate-90">
                                  <circle
                                    cx="50%"
                                    cy="50%"
                                    r="40%"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    fill="none"
                                    className="text-muted"
                                  />
                                  <circle
                                    cx="50%"
                                    cy="50%"
                                    r="40%"
                                    strokeWidth="3"
                                    fill="none"
                                    strokeDasharray={`${(score / 150) * 100} 100`}
                                    strokeLinecap="round"
                                    className={getScoreRingColor(score)}
                                    pathLength="100"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-xs sm:text-base font-bold">{score}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Stats Row */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 pl-8 sm:pl-11">
                            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                              ✓ {client.on_time_payments || 0} em dia
                            </span>
                            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">
                              ✗ {client.late_payments || 0} atrasados
                            </span>
                            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {client.total_loans || 0} empréstimos
                            </span>
                          </div>

                          {/* Profit Section - responsive grid */}
                          {profit && profit.expectedProfit > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              {/* Histórico de empréstimos */}
                              <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground">
                                <History className="w-3 h-3" />
                                <span>Histórico: {profit.paidLoansCount} quitados + {profit.activeLoansCount} ativos</span>
                              </div>
                              
                              <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                                <div className="bg-muted/30 rounded-lg p-2">
                                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">Principal</p>
                                  <p className="text-xs sm:text-sm font-semibold truncate">
                                    {formatCurrency(profit.totalPrincipal)}
                                  </p>
                                </div>
                                <div className="bg-blue-500/10 rounded-lg p-2">
                                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">Lucro Previsto</p>
                                  <p className="text-xs sm:text-sm font-semibold text-blue-500 truncate">
                                    {formatCurrency(profit.expectedProfit)}
                                  </p>
                                </div>
                                <div className="bg-emerald-500/10 rounded-lg p-2">
                                  <p className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Quitados ({profit.paidLoansCount})
                                  </p>
                                  <p className="text-xs sm:text-sm font-semibold text-emerald-500 truncate">
                                    {formatCurrency(profit.profitFromPaidLoans)}
                                  </p>
                                </div>
                                <div className="bg-cyan-500/10 rounded-lg p-2">
                                  <p className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Ativos ({profit.activeLoansCount})
                                  </p>
                                  <p className="text-xs sm:text-sm font-semibold text-cyan-500 truncate">
                                    {formatCurrency(profit.profitFromActiveLoans)}
                                  </p>
                                </div>
                                {profit.extraProfit > 0 && (
                                  <div className="bg-purple-500/10 rounded-lg p-2">
                                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">Lucro Extra</p>
                                    <p className="text-xs sm:text-sm font-semibold text-purple-500 truncate">
                                      +{formatCurrency(profit.extraProfit)}
                                    </p>
                                  </div>
                                )}
                                <div className="bg-primary/10 rounded-lg p-2 flex flex-col justify-center items-center">
                                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">Progresso</p>
                                  <div className="flex items-center gap-1">
                                    <span className={`text-sm sm:text-lg font-bold ${
                                      profitPercentage >= 100 ? 'text-emerald-500' : 'text-primary'
                                    }`}>
                                      {profitPercentage}%
                                    </span>
                                    {profitPercentage >= 100 && <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />}
                                    {profit.extraProfit > 0 && <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Modal de Edição de Score */}
        <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                Editar Score de {editingClient?.full_name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Novo Score</Label>
                  <Badge className={calculateScoreLabel(newScore).color}>
                    {getScoreIcon(newScore)} {calculateScoreLabel(newScore).label}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-6">0</span>
                  <Slider
                    value={[newScore]}
                    onValueChange={([v]) => setNewScore(v)}
                    min={0}
                    max={150}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-8">150</span>
                </div>
                <div className="text-center">
                  <span className="text-4xl font-bold">{newScore}</span>
                  <span className="text-muted-foreground text-sm ml-1">pontos</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo da alteração (opcional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Ex: Cliente pagou dívida antiga fora do sistema, bom relacionamento, etc."
                  value={scoreReason}
                  onChange={(e) => setScoreReason(e.target.value)}
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground">
                  O motivo será salvo nas notas do cliente para referência futura.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingClient(null)}>
                Cancelar
              </Button>
              <Button onClick={saveScore}>
                Salvar Score
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
