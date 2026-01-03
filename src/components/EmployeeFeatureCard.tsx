import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Lock, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

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
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            {isAdmin ? (
              <ShieldCheck className="w-8 h-8 text-primary" />
            ) : (
              <Lock className="w-8 h-8 text-primary" />
            )}
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {isAdmin ? 'Liberar Funcionário (Admin)' : 'Adicione Funcionários'}
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            {isAdmin 
              ? 'Como administrador, você pode liberar slots de funcionários sem pagamento.'
              : 'Cada funcionário adicional requer um pagamento separado. Libere um slot para cadastrar seu primeiro colaborador.'
            }
          </p>
          <Button onClick={onUnlock} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : isAdmin ? (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Liberar 1 Funcionário
              </>
            ) : (
              'Liberar 1 Funcionário'
            )}
          </Button>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground mt-3">
              Você será redirecionado para a página de pagamento
            </p>
          )}
        </div>
      </div>

      <CardHeader>
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-muted-foreground" />
          <div>
            <CardTitle className="flex items-center gap-2">
              Funcionários
              <Badge variant="secondary">Por Funcionário</Badge>
            </CardTitle>
            <CardDescription>
              1 pagamento = 1 slot de funcionário
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3 opacity-50">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Pague apenas pelos funcionários que usar
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Permissões granulares por função
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Tudo registrado na conta principal
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Ative e desative a qualquer momento
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
