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
  const totalInflows = receivedInPeriod;

  // Saldo Atual = Capital Inicial - Saídas + Entradas
  const currentBalance = effectiveInitialBalance - totalOutflows + totalInflows;
  const isPositive = currentBalance >= 0;

  // Resultado líquido dinâmico (ajusta conforme toggle)
  const dynamicNetResult = (receivedInPeriod + interestReceived) - totalOutflows;
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

          <CardContent className="pt-0 space-y-5">

            {/* ── Capital Inicial ─────────────────────────────────── */}
            <button
              onClick={() => setConfigOpen(true)}
              className="w-full bg-blue-500/10 hover:bg-blue-500/20 rounded-xl p-4
                         border-2 border-dashed border-blue-500/30
                         hover:border-blue-500/50 transition-all duration-200
                         cursor-pointer group hover:scale-[1.01] active:scale-[0.99] text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-semibold text-blue-500">Capital Inicial</span>
                  <Pencil className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-blue-500 tracking-tight">
                  {formatCurrency(effectiveInitialBalance)}
                </p>
              </div>
              <p className="text-xs text-blue-400/70 mt-1.5">
                {isUsingCalculatedBalance
                  ? 'Calculado automaticamente com base nos seus empréstimos · Clique para personalizar'
                  : 'Baseado nos seus empréstimos · Clique para editar'}
              </p>
            </button>

            {/* ── Saídas | Entradas ────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">

              {/* SAÍDAS */}
              <div className="bg-muted/40 rounded-xl p-4 space-y-3 border border-border/50">
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-destructive" />
                  <span className="text-xs font-bold text-destructive uppercase tracking-wide">Saídas</span>
                </div>

                {/* Empréstimos concedidos */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Empréstimos</span>
                    <span className="text-sm font-semibold text-destructive">
                      -{formatCurrency(loanedInPeriod)}
                    </span>
                  </div>
                </div>

                {/* Contas a pagar com toggle */}
                <div className="space-y-1.5 border-t border-border/40 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Receipt className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">Contas a pagar</span>
                    </div>
                    <Switch
                      checked={includeBills}
                      onCheckedChange={setIncludeBills}
                      className="scale-75 shrink-0"
                    />
                  </div>
                  <div className={cn(
                    "flex items-center justify-between transition-opacity",
                    !includeBills && "opacity-40"
                  )}>
                    <span className="text-xs text-orange-500">
                      {billsCount} conta{billsCount !== 1 ? 's' : ''} pagas
                    </span>
                    <span className={cn(
                      "text-sm font-semibold",
                      includeBills ? "text-orange-500" : "text-muted-foreground"
                    )}>
                      -{formatCurrency(billsPaidTotal)}
                    </span>
                  </div>
                </div>

                {/* ── Custos extras ────────────────────────────────── */}
                <div className="border-t border-border/40 pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span className="text-xs text-muted-foreground">Custos extras</span>
                    </div>
                    {extraCostsTotal > 0 && (
                      <span className="text-sm font-semibold text-purple-500">
                        -{formatCurrency(extraCostsTotal)}
                      </span>
                    )}
                  </div>

                  {/* List of extra costs */}
                  <AnimatePresence>
                    {extraCosts.map((cost) => (
                      <motion.div
                        key={cost.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between gap-1 pl-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-medium truncate">{cost.name}</p>
                          <p className="text-[9px] text-muted-foreground">
                            {format(parseISO(cost.date), 'dd/MM', { locale: ptBR })}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-purple-500 shrink-0">
                          -{formatCurrency(cost.amount)}
                        </span>
                        <button
                          onClick={() => handleDeleteExtraCost(cost.id)}
                          disabled={deletingId === cost.id}
                          className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Inline add form */}
                  <AnimatePresence>
                    {showAddForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-1.5 bg-muted/60 rounded-lg p-2"
                      >
                        <Input
                          placeholder="Nome do custo"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="h-7 text-xs"
                          autoFocus
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs justify-start font-normal px-2"
                              >
                                <CalendarIcon className="w-3 h-3 mr-1 shrink-0" />
                                {format(formDate, 'dd/MM/yy')}
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
                            className="h-7 text-xs"
                            type="number"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-6 text-[10px] flex-1 gap-1"
                            onClick={handleSaveExtraCost}
                            disabled={isSaving || !formName.trim() || !formAmount}
                          >
                            <Check className="w-3 h-3" />
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2"
                            onClick={handleCancelForm}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Add button */}
                  {!showAddForm && (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-purple-500 transition-colors pl-1"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar custo extra
                    </button>
                  )}
                </div>

                {/* Subtotal saídas */}
                <div className="border-t border-destructive/20 pt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Total saídas</span>
                  <span className="text-base font-bold text-destructive">
                    {formatCurrency(totalOutflows)}
                  </span>
                </div>
              </div>

              {/* ENTRADAS */}
              <div className="bg-muted/40 rounded-xl p-4 space-y-3 border border-border/50">
                <div className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-500 uppercase tracking-wide">Entradas</span>
                </div>

                {/* Pagamentos recebidos */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Recebido</span>
                    <span className="text-sm font-semibold text-emerald-500">
                      +{formatCurrency(receivedInPeriod)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Juros recebidos</span>
                    <span className="text-xs font-medium text-emerald-400">
                      +{formatCurrency(interestReceived)}
                    </span>
                  </div>
                </div>

                {/* Subtotal entradas */}
                <div className="border-t border-emerald-500/20 pt-2 flex items-center justify-between mt-auto">
                  <span className="text-xs font-semibold text-muted-foreground">Total entradas</span>
                  <span className="text-base font-bold text-emerald-500">
                    {formatCurrency(receivedInPeriod + interestReceived)}
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
