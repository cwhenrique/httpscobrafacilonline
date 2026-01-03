import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle2, Loader2, ShieldCheck, Rocket, CreditCard } from 'lucide-react';

interface EmployeeFeatureCardProps {
  isUnlocked: boolean;
  onUnlock: () => void;
  isAdmin?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export default function EmployeeFeatureCard({ 
  isUnlocked, 
  onUnlock, 
  isAdmin = false,
  isLoading = false,
  children 
}: EmployeeFeatureCardProps) {
  if (isUnlocked) {
    return <>{children}</>;
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
              Adicione colaboradores para ajudar no seu dia a dia. Cada funcionário pode trabalhar de qualquer lugar!
            </p>
          </div>

          {/* Lista de benefícios */}
          <div className="grid sm:grid-cols-2 gap-4 text-left max-w-lg mx-auto">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Registrar Pagamentos</p>
                <p className="text-xs text-muted-foreground">Funcionários podem baixar parcelas dos clientes</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Criar Empréstimos</p>
                <p className="text-xs text-muted-foreground">Novos negócios direto pelo celular</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Permissões Granulares</p>
                <p className="text-xs text-muted-foreground">Você define o que cada um pode fazer</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Controle Total</p>
                <p className="text-xs text-muted-foreground">Tudo fica salvo na sua conta principal</p>
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
