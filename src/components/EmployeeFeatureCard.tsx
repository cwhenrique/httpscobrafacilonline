import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Loader2, ShieldCheck, Rocket, CreditCard, Lock, EyeOff, Shield, Settings, Plus } from 'lucide-react';

interface EmployeeFeatureCardProps {
  isUnlocked: boolean;
  onUnlock: () => void;
  isAdmin?: boolean;
  isLoading?: boolean;
  currentEmployees?: number;
  maxEmployees?: number;
  children?: React.ReactNode;
}

export default function EmployeeFeatureCard({ 
  isUnlocked, 
  onUnlock, 
  isAdmin = false,
  isLoading = false,
  currentEmployees = 0,
  maxEmployees = 0,
  children 
}: EmployeeFeatureCardProps) {
  if (isUnlocked) {
    const usagePercent = maxEmployees > 0 ? (currentEmployees / maxEmployees) * 100 : 0;
    const availableSlots = maxEmployees - currentEmployees;

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Slots de Funcionários</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {currentEmployees} de {maxEmployees} {maxEmployees === 1 ? 'slot utilizado' : 'slots utilizados'}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onUnlock}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    Liberar Mais 1
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Progress value={usagePercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {availableSlots > 0 
                  ? `Você pode adicionar mais ${availableSlots} ${availableSlots === 1 ? 'funcionário' : 'funcionários'}`
                  : 'Todos os slots estão em uso. Libere mais para adicionar funcionários.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
        {children}
      </div>
    );
  }

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardContent className="p-8">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          {/* Ícone principal */}
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Users className="w-10 h-10 text-primary" />
          </div>

          {/* Título */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">
              Expanda seu Negócio com Funcionários
            </h2>
            <p className="text-muted-foreground">
              Adicione colaboradores com total controle sobre o que eles podem ver e acessar!
            </p>
          </div>

          {/* Lista de benefícios focada em segurança */}
          <div className="grid sm:grid-cols-2 gap-4 text-left max-w-lg mx-auto">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Lock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
              <p className="font-medium text-sm">Visibilidade Controlada</p>
              <p className="text-xs text-muted-foreground">Você define se ele vê só os dele ou todos</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <EyeOff className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Dashboard Bloqueado</p>
                <p className="text-xs text-muted-foreground">Oculte seus lucros e totais financeiros</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Permissões por Função</p>
                <p className="text-xs text-muted-foreground">Defina exatamente o que cada um pode acessar</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Settings className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Controle Flexível</p>
                <p className="text-xs text-muted-foreground">Libere "ver todos" apenas quando necessário</p>
              </div>
            </div>
          </div>

          {/* Destaque sobre isolamento de empréstimos */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 max-w-lg mx-auto">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">
                  Você controla o que cada funcionário pode ver!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Por padrão, ele só vê os empréstimos que ele mesmo criou. Mas você pode liberar a permissão "Ver Todos os Empréstimos" individualmente se precisar.
                </p>
              </div>
            </div>
          </div>

          {/* Destaque de preço */}
          <div className="flex items-center justify-center">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl px-6 py-4">
              <div className="flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold text-primary">R$ 35,90</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">por funcionário / mês</p>
            </div>
          </div>

          {/* Botão de ação */}
          <div className="space-y-3">
            <Button 
              size="lg" 
              onClick={onUnlock} 
              disabled={isLoading}
              className="px-8"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : isAdmin ? (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Liberar 1 Funcionário (Admin)
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Liberar 1 Funcionário
                </>
              )}
            </Button>
            
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">
                Você será redirecionado para a página de pagamento seguro
              </p>
            )}
            {isAdmin && (
              <p className="text-xs text-muted-foreground">
                Como admin, o slot será liberado automaticamente sem cobrança
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
