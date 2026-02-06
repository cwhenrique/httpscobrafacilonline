import { Bell, BellOff, Smartphone, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Badge } from '@/components/ui/badge';

export function PushNotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    toggle,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="w-4 h-4 text-muted-foreground" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push. Use o Chrome, Firefox ou Safari para receber notificações.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-primary">Permitido</Badge>;
      case 'denied':
        return <Badge variant="destructive">Bloqueado</Badge>;
      default:
        return <Badge variant="secondary">Não solicitado</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Notificações Push</CardTitle>
          </div>
          {getPermissionBadge()}
        </div>
        <CardDescription>
          Receba alertas de cobranças diretamente no seu celular ou computador, mesmo quando não estiver usando o app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label htmlFor="push-toggle" className="text-sm font-medium">
                Ativar notificações
              </Label>
              <p className="text-xs text-muted-foreground">
                {isSubscribed 
                  ? 'Você receberá alertas de vencimentos e atrasos' 
                  : 'Ative para receber lembretes de cobranças'
                }
              </p>
            </div>
          </div>
          
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              id="push-toggle"
              checked={isSubscribed}
              onCheckedChange={toggle}
              disabled={permission === 'denied'}
            />
          )}
        </div>

        {permission === 'denied' && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              As notificações foram bloqueadas nas configurações do navegador. 
              Para ativar, acesse as configurações do site e permita notificações.
            </p>
          </div>
        )}

        {isSubscribed && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-primary">
              ✓ Notificações ativadas! Você receberá alertas sobre:
            </p>
            <ul className="text-xs text-muted-foreground mt-1 ml-4 list-disc">
              <li>Parcelas vencendo hoje</li>
              <li>Parcelas em atraso</li>
              <li>Pagamentos recebidos</li>
            </ul>
          </div>
        )}

        {!isSubscribed && permission !== 'denied' && (
          <Button
            onClick={toggle}
            disabled={isLoading}
            className="w-full"
            variant="outline"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bell className="w-4 h-4 mr-2" />
            )}
            Ativar Notificações
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
