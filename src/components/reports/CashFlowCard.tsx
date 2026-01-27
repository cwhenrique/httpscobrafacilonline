import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/calculations';
import { Wallet, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp, Settings, Briefcase, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CashFlowConfigModal } from './CashFlowConfigModal';

interface CashFlowCardProps {
  initialBalance: number;
  loanedInPeriod: number;
  totalOnStreet: number;
  receivedInPeriod: number;
  interestReceived: number;
  onUpdateInitialBalance: (value: number) => void;
}

export function CashFlowCard({
  initialBalance,
  loanedInPeriod,
  totalOnStreet,
  receivedInPeriod,
  interestReceived,
  onUpdateInitialBalance,
}: CashFlowCardProps) {
  const [configOpen, setConfigOpen] = useState(false);
  
  // Cálculo do caixa atual
  const currentBalance = initialBalance - loanedInPeriod + receivedInPeriod;
  
  // Determina se o caixa está positivo ou negativo
  const isPositive = currentBalance >= 0;
  const hasProfit = interestReceived > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-primary/30 bg-card shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Fluxo de Caixa
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfigOpen(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Configurar</span>
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Linha do fluxo: Inicial → Saídas → Entradas */}
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {/* Caixa Inicial */}
              <div className="flex-1 bg-muted/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <PiggyBank className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                  <span className="text-sm sm:text-base text-muted-foreground font-medium">Inicial</span>
                </div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-500 tracking-tight">
                  {formatCurrency(initialBalance)}
                </p>
              </div>

              {/* Seta */}
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground/50 flex-shrink-0" />

              {/* Saídas (Emprestado) */}
              <div className="flex-1 bg-muted/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                  <span className="text-sm sm:text-base text-muted-foreground font-medium">Saídas</span>
                </div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-500 tracking-tight">
                  -{formatCurrency(loanedInPeriod)}
                </p>
              </div>

              {/* Seta */}
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground/50 flex-shrink-0" />

              {/* Entradas (Recebido) */}
              <div className="flex-1 bg-muted/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <ArrowDownLeft className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
                  <span className="text-sm sm:text-base text-muted-foreground font-medium">Entradas</span>
                </div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-500 tracking-tight">
                  +{formatCurrency(receivedInPeriod)}
                </p>
              </div>
            </div>

            {/* Indicador de resultado */}
            <div className="flex justify-center">
              <ChevronDown className="w-6 h-6 text-muted-foreground/50" />
            </div>

            {/* Card destacado: Saldo Atual */}
            <div className={cn(
              "rounded-xl p-5 sm:p-6 border-2 text-center",
              isPositive 
                ? "bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-emerald-500/30" 
                : "bg-gradient-to-r from-red-500/20 to-red-500/10 border-red-500/30"
            )}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Wallet className={cn("w-6 h-6 sm:w-7 sm:h-7", isPositive ? "text-emerald-500" : "text-red-500")} />
                <span className="text-base sm:text-lg text-muted-foreground font-medium">Saldo Atual</span>
              </div>
              <p className={cn(
                "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight",
                isPositive ? "text-emerald-500" : "text-red-500"
              )}>
                {formatCurrency(currentBalance)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">em caixa</p>
            </div>

            {/* Linha de métricas: Capital na Rua | Lucro */}
            <div className="grid grid-cols-2 gap-3">
              {/* Capital na Rua */}
              <div className="bg-orange-500/10 rounded-xl p-4 text-center border border-orange-500/20">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Briefcase className="w-5 h-5 text-orange-500" />
                  <span className="text-sm sm:text-base text-muted-foreground font-medium">Capital na Rua</span>
                </div>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-500 tracking-tight">
                  {formatCurrency(totalOnStreet)}
                </p>
              </div>

              {/* Lucro do Período */}
              <div className={cn(
                "rounded-xl p-4 text-center border",
                hasProfit 
                  ? "bg-primary/10 border-primary/20" 
                  : "bg-muted/30 border-muted/20"
              )}>
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <TrendingUp className={cn("w-5 h-5", hasProfit ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm sm:text-base text-muted-foreground font-medium">Lucro</span>
                </div>
                <p className={cn(
                  "text-lg sm:text-xl lg:text-2xl font-bold tracking-tight",
                  hasProfit ? "text-primary" : "text-muted-foreground"
                )}>
                  {formatCurrency(interestReceived)}
                </p>
              </div>
            </div>

            {/* Dica se não configurou saldo inicial */}
            {initialBalance === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                💡 Configure seu saldo inicial para acompanhar seu fluxo de caixa
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <CashFlowConfigModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        currentBalance={initialBalance}
        onSave={onUpdateInitialBalance}
      />
    </>
  );
}
