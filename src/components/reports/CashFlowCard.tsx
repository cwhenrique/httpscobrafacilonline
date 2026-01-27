import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/calculations';
import { Wallet, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CashFlowConfigModal } from './CashFlowConfigModal';

interface CashFlowCardProps {
  initialBalance: number;
  loanedInPeriod: number;
  receivedInPeriod: number;
  interestReceived: number;
  onUpdateInitialBalance: (value: number) => void;
}

export function CashFlowCard({
  initialBalance,
  loanedInPeriod,
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
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
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
          <CardContent className="pt-2">
            {/* Grid de métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {/* Caixa Inicial */}
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <PiggyBank className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground font-medium">Inicial</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-blue-500">
                  {formatCurrency(initialBalance)}
                </p>
              </div>

              {/* Saídas (Emprestado) */}
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-muted-foreground font-medium">Saídas</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-red-500">
                  -{formatCurrency(loanedInPeriod)}
                </p>
                <p className="text-[10px] text-muted-foreground">emprestado</p>
              </div>

              {/* Entradas (Recebido) */}
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground font-medium">Entradas</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-emerald-500">
                  +{formatCurrency(receivedInPeriod)}
                </p>
                <p className="text-[10px] text-muted-foreground">recebido</p>
              </div>

              {/* Caixa Atual */}
              <div className={cn(
                "rounded-lg p-3 text-center border-2",
                isPositive 
                  ? "bg-emerald-500/10 border-emerald-500/30" 
                  : "bg-red-500/10 border-red-500/30"
              )}>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Wallet className={cn("w-4 h-4", isPositive ? "text-emerald-500" : "text-red-500")} />
                  <span className="text-xs text-muted-foreground font-medium">Atual</span>
                </div>
                <p className={cn(
                  "text-sm sm:text-base font-bold",
                  isPositive ? "text-emerald-500" : "text-red-500"
                )}>
                  {formatCurrency(currentBalance)}
                </p>
                <p className="text-[10px] text-muted-foreground">em caixa</p>
              </div>
            </div>

            {/* Lucro do período */}
            <div className={cn(
              "rounded-lg p-3 flex items-center justify-between",
              hasProfit ? "bg-primary/10" : "bg-muted/30"
            )}>
              <div className="flex items-center gap-2">
                <TrendingUp className={cn("w-4 h-4", hasProfit ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-medium">Lucro no Período</span>
              </div>
              <span className={cn(
                "text-sm sm:text-base font-bold",
                hasProfit ? "text-primary" : "text-muted-foreground"
              )}>
                {formatCurrency(interestReceived)}
              </span>
            </div>

            {/* Dica se não configurou saldo inicial */}
            {initialBalance === 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
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
