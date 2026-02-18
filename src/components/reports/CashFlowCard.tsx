import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/calculations';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp, Briefcase,
  ChevronDown, Pencil, Receipt, Scale, Plus, Trash2, X, Check, ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CashFlowConfigModal } from './CashFlowConfigModal';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';

export interface ExtraCost {
  id: string;
  name: string;
  date: string;
  amount: number;
}

export interface NewExtraCost {
  name: string;
  date: string;
  amount: number;
}

interface CashFlowCardProps {
  initialBalance: number;
  calculatedInitialBalance: number;
  loanedInPeriod: number;
  totalOnStreet: number;
  receivedInPeriod: number;
  interestReceived: number;
  onUpdateInitialBalance: (value: number) => void;
  billsPaidTotal: number;
  billsPendingTotal: number;
  billsCount: number;
  netResult: number;
  extraCosts: ExtraCost[];
  onAddExtraCost: (cost: NewExtraCost) => Promise<void>;
  onDeleteExtraCost: (id: string) => Promise<void>;
}

export function CashFlowCard({
  initialBalance,
  calculatedInitialBalance,
  loanedInPeriod,
  totalOnStreet,
  receivedInPeriod,
  interestReceived,
  onUpdateInitialBalance,
  billsPaidTotal,
  billsPendingTotal,
  billsCount,
  netResult,
  extraCosts,
  onAddExtraCost,
  onDeleteExtraCost,
}: CashFlowCardProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [includeBills, setIncludeBills] = useState(true);

  // Inline form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formAmount, setFormAmount] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Effective initial balance
  const effectiveInitialBalance = initialBalance > 0
    ? initialBalance
    : calculatedInitialBalance;

  const isUsingCalculatedBalance = initialBalance <= 0 && calculatedInitialBalance > 0;

  // Extra costs total
  const extraCostsTotal = extraCosts.reduce((s, c) => s + c.amount, 0);

  // Totals
  const billsOutflow = includeBills ? billsPaidTotal : 0;
  const totalOutflows = loanedInPeriod + billsOutflow + extraCostsTotal;
  const totalInflows = receivedInPeriod + interestReceived;

  // Saldo Atual = Capital Inicial - Saídas + Entradas
  const currentBalance = effectiveInitialBalance - totalOutflows + totalInflows;
  const isPositive = currentBalance >= 0;

  // Resultado líquido dinâmico
  const dynamicNetResult = totalInflows - totalOutflows;
  const hasProfit = interestReceived > 0;
  const isNetPositive = dynamicNetResult >= 0;

  const handleSaveExtraCost = async () => {
    if (!formName.trim() || !formAmount) return;
    const amount = parseFloat(formAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;

    setIsSaving(true);
    try {
      await onAddExtraCost({
        name: formName.trim(),
        date: format(formDate, 'yyyy-MM-dd'),
        amount,
      });
      setFormName('');
      setFormAmount('');
      setFormDate(new Date());
      setShowAddForm(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExtraCost = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteExtraCost(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelForm = () => {
    setFormName('');
    setFormAmount('');
    setFormDate(new Date());
    setShowAddForm(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-primary/30 bg-card shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Fluxo de Caixa
              <Badge className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 animate-pulse">
                Novidade
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0 space-y-4">

            {/* ── Capital Inicial ─────────────────────────────────── */}
            <div className="flex items-center justify-between bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <PiggyBank className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-500">Capital Inicial</p>
                  <p className="text-xs text-blue-400/70 mt-0.5">
                    {isUsingCalculatedBalance
                      ? 'Baseado nos contratos ativos'
                      : 'Configurado manualmente'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xl sm:text-2xl font-bold text-blue-500 tracking-tight">
                  {formatCurrency(effectiveInitialBalance)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfigOpen(true)}
                  className="h-8 px-3 border-blue-500/40 text-blue-500 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/60 gap-1.5 shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </Button>
              </div>
            </div>

            {/* ── SAÍDAS ─────────────────────────────────────────── */}
            <div className="bg-muted/40 rounded-xl border border-border/50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
                <ArrowUpRight className="w-4 h-4 text-destructive" />
                <span className="text-xs font-bold text-destructive uppercase tracking-wider">Saídas</span>
              </div>

              <div className="px-4 py-3 space-y-3">

                {/* Empréstimos concedidos */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                    <span className="text-sm text-muted-foreground">Empréstimos concedidos</span>
                  </div>
                  <span className="text-sm font-semibold text-destructive">
                    -{formatCurrency(loanedInPeriod)}
                  </span>
                </div>

                {/* Contas a pagar */}
                <div className={cn(
                  "rounded-lg p-3 transition-colors border",
                  includeBills
                    ? "bg-orange-500/10 border-orange-500/20"
                    : "bg-muted/30 border-border/30"
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Receipt className={cn("w-4 h-4 shrink-0", includeBills ? "text-orange-500" : "text-muted-foreground")} />
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", includeBills ? "text-orange-500" : "text-muted-foreground")}>
                          Contas a pagar
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {billsCount} conta{billsCount !== 1 ? 's' : ''} paga{billsCount !== 1 ? 's' : ''} no período
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn(
                        "text-sm font-semibold",
                        includeBills ? "text-orange-500" : "text-muted-foreground/50"
                      )}>
                        -{formatCurrency(billsPaidTotal)}
                      </span>
                      <Switch
                        checked={includeBills}
                        onCheckedChange={setIncludeBills}
                        className="scale-90"
                      />
                    </div>
                  </div>
                </div>

                {/* Custos extras */}
                <div className="rounded-lg border border-border/30 bg-background/40 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-purple-500 shrink-0" />
                      <span className="text-sm font-medium text-muted-foreground">Custos extras</span>
                    </div>
                    {extraCostsTotal > 0 && (
                      <span className="text-sm font-semibold text-purple-500">
                        -{formatCurrency(extraCostsTotal)}
                      </span>
                    )}
                  </div>

                  <div className="px-3 py-2 space-y-1.5">
                    {/* Lista de custos extras */}
                    <AnimatePresence>
                      {extraCosts.map((cost) => (
                        <motion.div
                          key={cost.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-2 py-1"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                          <span className="text-xs font-medium flex-1 truncate">{cost.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(parseISO(cost.date), 'dd/MM', { locale: ptBR })}
                          </span>
                          <span className="text-xs font-semibold text-purple-500 shrink-0">
                            -{formatCurrency(cost.amount)}
                          </span>
                          <button
                            onClick={() => handleDeleteExtraCost(cost.id)}
                            disabled={deletingId === cost.id}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0 disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Formulário inline */}
                    <AnimatePresence>
                      {showAddForm && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="pt-1"
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Nome do custo"
                              value={formName}
                              onChange={(e) => setFormName(e.target.value)}
                              className="h-8 text-xs flex-1 min-w-0"
                              autoFocus
                            />
                            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs px-2 shrink-0 gap-1"
                                >
                                  <CalendarIcon className="w-3 h-3" />
                                  {format(formDate, 'dd/MM')}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={formDate}
                                  onSelect={(d) => { if (d) { setFormDate(d); setDatePickerOpen(false); } }}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                            <Input
                              placeholder="Valor"
                              value={formAmount}
                              onChange={(e) => setFormAmount(e.target.value)}
                              className="h-8 text-xs w-20 shrink-0"
                              type="number"
                              min="0"
                              step="0.01"
                            />
                            <Button
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0"
                              onClick={handleSaveExtraCost}
                              disabled={isSaving || !formName.trim() || !formAmount}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 shrink-0"
                              onClick={handleCancelForm}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Botão adicionar */}
                    {!showAddForm && (
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-purple-500 transition-colors py-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar custo extra
                      </button>
                    )}
                  </div>
                </div>

                {/* Total saídas */}
                <div className="flex items-center justify-between pt-1 border-t border-destructive/20">
                  <span className="text-sm font-semibold text-muted-foreground">Total saídas</span>
                  <span className="text-base font-bold text-destructive">
                    -{formatCurrency(totalOutflows)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Divisor ─────────────────────────────────────────── */}
            <div className="flex justify-center -my-1">
              <ChevronDown className="w-5 h-5 text-muted-foreground/40" />
            </div>

            {/* ── ENTRADAS ────────────────────────────────────────── */}
            <div className="bg-muted/40 rounded-xl border border-border/50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Entradas</span>
              </div>

              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-sm text-muted-foreground">Pagamentos recebidos</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-500">
                    +{formatCurrency(receivedInPeriod)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-sm text-muted-foreground">Juros recebidos</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400">
                    +{formatCurrency(interestReceived)}
                  </span>
                </div>

                {/* Total entradas */}
                <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20">
                  <span className="text-sm font-semibold text-muted-foreground">Total entradas</span>
                  <span className="text-base font-bold text-emerald-500">
                    +{formatCurrency(totalInflows)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Indicador ───────────────────────────────────────── */}
            <div className="flex justify-center -my-1">
              <ChevronDown className="w-5 h-5 text-muted-foreground/40" />
            </div>

            {/* ── Saldo Atual ─────────────────────────────────────── */}
            <div className={cn(
              "rounded-xl p-5 border-2 text-center",
              isPositive
                ? "bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-emerald-500/30"
                : "bg-gradient-to-r from-destructive/20 to-destructive/10 border-destructive/30"
            )}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Wallet className={cn("w-5 h-5", isPositive ? "text-emerald-500" : "text-destructive")} />
                <span className="text-sm text-muted-foreground font-medium">Saldo Atual</span>
              </div>
              <p className={cn(
                "text-3xl sm:text-4xl font-bold tracking-tight",
                isPositive ? "text-emerald-500" : "text-destructive"
              )}>
                {formatCurrency(currentBalance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">em caixa</p>
            </div>

            {/* ── Rodapé: 3 métricas ──────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 pt-1">

              {/* Capital na Rua */}
              <div className="bg-orange-500/10 rounded-xl p-3 text-center border border-orange-500/20">
                <Briefcase className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground mb-0.5">Capital na Rua</p>
                <p className="text-sm font-bold text-orange-500">{formatCurrency(totalOnStreet)}</p>
              </div>

              {/* Lucro */}
              <div className={cn(
                "rounded-xl p-3 text-center border",
                hasProfit ? "bg-primary/10 border-primary/20" : "bg-muted/30 border-muted/20"
              )}>
                <TrendingUp className={cn("w-4 h-4 mx-auto mb-1", hasProfit ? "text-primary" : "text-muted-foreground")} />
                <p className="text-[10px] text-muted-foreground mb-0.5">Lucro</p>
                <p className={cn("text-sm font-bold", hasProfit ? "text-primary" : "text-muted-foreground")}>
                  {formatCurrency(interestReceived)}
                </p>
              </div>

              {/* Resultado Líquido */}
              <div className={cn(
                "rounded-xl p-3 text-center border",
                isNetPositive
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-destructive/10 border-destructive/20"
              )}>
                <Scale className={cn("w-4 h-4 mx-auto mb-1", isNetPositive ? "text-emerald-500" : "text-destructive")} />
                <p className="text-[10px] text-muted-foreground mb-0.5">Resultado</p>
                <p className={cn("text-sm font-bold", isNetPositive ? "text-emerald-500" : "text-destructive")}>
                  {isNetPositive ? '+' : ''}{formatCurrency(dynamicNetResult)}
                </p>
              </div>
            </div>

          </CardContent>
        </Card>
      </motion.div>

      <CashFlowConfigModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        currentBalance={initialBalance}
        suggestedBalance={calculatedInitialBalance}
        onSave={onUpdateInitialBalance}
      />
    </>
  );
}
