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
  History,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/calculations';
import { calculateScoreLabel, getScoreIcon, calculateRecoveryBonus } from '@/hooks/useClientScore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Client } from '@/types/database';
import { RefreshCw } from 'lucide-react';

export default function ClientScores() {
  const { clients, loading, invalidateClients } = useClients();
  const { loans } = useLoans();
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<'score' | 'profit'>('score');
  const [loanPayments, setLoanPayments] = useState<Array<{ loan_id: string; interest_paid: number | null }>>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [search, setSearch] = useState('');
  
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
      recoveryBonus: number;
      overdueLoansCount: number;
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
        recoveryBonus: 0,
        overdueLoansCount: 0,
      };
      
      // Lucro previsto = total de juros do contrato
      const expectedProfit = loan.total_interest || 0;
      
      // Lucro realizado = SOMA REAL de interest_paid dos pagamentos (fonte de verdade)
      // Inclui multas e penalidades no lucro realizado
      const actualInterestReceived = interestByLoan.get(loan.id) || 0;
      
      // Lucro realizado = tudo que foi recebido de juros + multas
      const realizedProfit = actualInterestReceived;
      
      // Lucro EXTRA = o que passou do previsto (multas, penalidades)
      const extraProfit = Math.max(0, actualInterestReceived - expectedProfit);
      
      // Contar por status e separar lucro
      const isPaid = loan.status === 'paid';
      const isOverdue = loan.status === 'overdue';
      
      // Acumular extra profit para calcular bônus de recuperação
      const newExtraProfit = existing.extraProfit + extraProfit;
      const recoveryBonus = calculateRecoveryBonus(newExtraProfit);
      
      map.set(loan.client_id, {
        expectedProfit: existing.expectedProfit + expectedProfit,
        realizedProfit: existing.realizedProfit + realizedProfit,
        extraProfit: newExtraProfit,
        totalPrincipal: existing.totalPrincipal + loan.principal_amount,
        paidLoansCount: existing.paidLoansCount + (isPaid ? 1 : 0),
        activeLoansCount: existing.activeLoansCount + (isPaid ? 0 : 1),
        profitFromPaidLoans: existing.profitFromPaidLoans + (isPaid ? realizedProfit : 0),
        profitFromActiveLoans: existing.profitFromActiveLoans + (isPaid ? 0 : realizedProfit),
        recoveryBonus,
        overdueLoansCount: existing.overdueLoansCount + (isOverdue ? 1 : 0),
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
    const searchLower = search.toLowerCase();
    const filtered = clients.filter(client =>
      client.full_name.toLowerCase().includes(searchLower) ||
      client.phone?.toLowerCase().includes(searchLower) ||
      client.cpf?.toLowerCase().includes(searchLower)
    );
    
    return filtered.sort((a, b) => {
      if (sortBy === 'profit') {
        const profitA = clientProfitMap.get(a.id)?.realizedProfit || 0;
        const profitB = clientProfitMap.get(b.id)?.realizedProfit || 0;
        return profitB - profitA;
      }
      return (b.score || 100) - (a.score || 100);
    });
  }, [clients, sortBy, clientProfitMap, search]);

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
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Award className="w-7 h-7 text-primary" />
              Score de Clientes
            </h1>
            <p className="text-muted-foreground">
              Acompanhe a pontuação de confiabilidade dos seus clientes atualizada automaticamente
            </p>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading || loadingPayments ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : stats && (
          <>
            {/* Compact Stats Bar */}
            <Card 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setStatsExpanded(!statsExpanded)}
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {/* Score Médio */}
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Score:</span>
                    <span className="font-bold">{stats.avgScore}</span>
                  </div>
                  
                  {/* Categorias */}
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-emerald-500 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {stats.excellent}
                    </span>
                    <span className="text-yellow-500 font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {stats.regular}
                    </span>
                    <span className="text-red-500 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> {stats.bad}
                    </span>
                  </div>
                  
                  {/* Lucro Realizado */}
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(stats.totalRealizedProfit)}
                    </span>
                    {stats.totalExtraProfit > 0 && (
                      <span className="text-purple-500 text-sm">
                        +{formatCurrency(stats.totalExtraProfit)}
                      </span>
                    )}
                  </div>
                  
                  {/* Pagamentos */}
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm">
                      {stats.totalOnTime} ({stats.totalOnTime + stats.totalLate > 0 
                        ? Math.round((stats.totalOnTime / (stats.totalOnTime + stats.totalLate)) * 100)
                        : 0}%)
                    </span>
                  </div>
                  
                  {/* Botão expandir */}
                  <Button variant="ghost" size="sm" className="ml-auto">
                    {statsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span className="ml-1 text-xs">{statsExpanded ? 'Menos' : 'Mais'}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Expanded Stats */}
            {statsExpanded && (
              <div className="space-y-4 animate-fade-in">
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
                    <p className="text-purple-600 text-xs mt-2 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      <strong>Bônus Recuperação:</strong> +2 pontos a cada R$50 pagos em multas/juros extras (máx. +10 pts)
                    </p>
                    <p className="text-muted-foreground text-[10px] mt-1 flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Você pode editar o score manualmente clicando no ícone de lápis
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* Client Ranking */}
        {!loading && !loadingPayments && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Ranking de Clientes ({clients.length})
              </h2>
              <div className="flex gap-2">
                <Button
                  variant={sortBy === 'score' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('score')}
                >
                  Por Score
                </Button>
                <Button
                  variant={sortBy === 'profit' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('profit')}
                >
                  Por Lucro
                </Button>
              </div>
            </div>

            {sortedClients.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum cliente cadastrado ainda</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedClients.map((client, index) => {
                  const profit = clientProfitMap.get(client.id);
                  const score = client.score || 100;
                  const { label: scoreLabel, color: scoreColor } = calculateScoreLabel(score);
                  
                  return (
                    <Card key={client.id} className="relative overflow-hidden">
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getScoreGradient(score)}`} />
                      
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          {/* Rank */}
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground">#{index + 1}</span>
                            <Avatar className="w-12 h-12 border-2 border-muted">
                              <AvatarImage src={client.avatar_url || undefined} />
                              <AvatarFallback className="text-sm">
                                {client.full_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold truncate">{client.full_name}</p>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => openEditScoreModal(client)}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </div>
                            <Badge className={`text-xs ${scoreColor}`}>
                              {getScoreIcon(score)} {score} - {scoreLabel}
                            </Badge>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                {client.on_time_payments || 0} em dia
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-red-500" />
                                {client.late_payments || 0} atrasados
                              </span>
                              {profit && profit.overdueLoansCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                                  {profit.overdueLoansCount} {profit.overdueLoansCount === 1 ? 'empréstimo' : 'empréstimos'} em atraso
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Score Ring */}
                          <div className="relative w-14 h-14">
                            <svg className="w-full h-full -rotate-90">
                              <circle
                                cx="28"
                                cy="28"
                                r="24"
                                strokeWidth="4"
                                fill="none"
                                className="stroke-muted"
                              />
                              <circle
                                cx="28"
                                cy="28"
                                r="24"
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={`${(score / 150) * 150.8} 150.8`}
                                className={getScoreRingColor(score)}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-sm font-bold">{score}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Profit Section */}
                        {profit && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-blue-500/10 rounded-lg p-2">
                                <p className="text-[9px] text-muted-foreground">Principal</p>
                                <p className="text-xs font-semibold">{formatCurrency(profit.totalPrincipal)}</p>
                              </div>
                              <div className="bg-emerald-500/10 rounded-lg p-2">
                                <p className="text-[9px] text-muted-foreground">
                                  L. Quitados ({profit.paidLoansCount})
                                </p>
                                <p className="text-xs font-semibold text-emerald-500">
                                  {formatCurrency(profit.profitFromPaidLoans)}
                                </p>
                              </div>
                              <div className="bg-blue-500/10 rounded-lg p-2">
                                <p className="text-[9px] text-muted-foreground">
                                  L. Ativos ({profit.activeLoansCount})
                                </p>
                                <p className="text-xs font-semibold text-blue-500">
                                  {formatCurrency(profit.profitFromActiveLoans)}
                                </p>
                              </div>
                            </div>
                            {profit.extraProfit > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center justify-center gap-2">
                                  <Badge variant="secondary" className="text-purple-500 bg-purple-500/10">
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    Lucro Extra: {formatCurrency(profit.extraProfit)}
                                  </Badge>
                                </div>
                                {profit.recoveryBonus > 0 && (
                                  <div className="flex items-center justify-center">
                                    <Badge variant="outline" className="text-purple-600 border-purple-300 bg-purple-50">
                                      <RefreshCw className="w-3 h-3 mr-1" />
                                      +{profit.recoveryBonus} pts recuperação
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
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
