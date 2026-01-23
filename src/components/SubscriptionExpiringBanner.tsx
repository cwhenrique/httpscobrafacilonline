import { useMemo, useState } from 'react';
import { AlertTriangle, Clock, Calendar, Star, CalendarDays } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const RENEWAL_LINKS = {
  monthly: "https://pay.cakto.com.br/35qwwgz?SCK=renew",
  quarterly: "https://pay.cakto.com.br/eb6ern9?SCK=renew",
  annual: "https://pay.cakto.com.br/fhwfptb?SCK=renew",
};

export function SubscriptionExpiringBanner() {
  const { profile } = useProfile();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const expirationInfo = useMemo(() => {
    if (!profile?.subscription_expires_at) return null;
    
    const plan = profile.subscription_plan;
    if (plan === 'trial' || plan === 'lifetime' || !plan) return null;

    const expiresAt = new Date(profile.subscription_expires_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiresAt.setHours(0, 0, 0, 0);
    
    const diffTime = expiresAt.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 3 || diffDays < 0) return null;

    return {
      days: diffDays,
      plan: plan === 'monthly' ? 'mensal' : plan === 'quarterly' ? 'trimestral' : 'anual',
    };
  }, [profile]);

  if (!expirationInfo) return null;

  const { days, plan } = expirationInfo;

  const getStyles = () => {
    if (days <= 1) {
      return {
        bg: 'bg-red-50 border-red-200',
        text: 'text-red-800',
        icon: 'text-red-500',
        button: 'bg-red-600 hover:bg-red-700',
      };
    }
    if (days === 2) {
      return {
        bg: 'bg-orange-50 border-orange-200',
        text: 'text-orange-800',
        icon: 'text-orange-500',
        button: 'bg-orange-600 hover:bg-orange-700',
      };
    }
    return {
      bg: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-800',
      icon: 'text-yellow-500',
      button: 'bg-yellow-600 hover:bg-yellow-700',
    };
  };

  const styles = getStyles();

  const getMessage = () => {
    if (days === 0) return 'vence hoje!';
    if (days === 1) return 'vence amanhã!';
    return `vence em ${days} dias!`;
  };

  const handleSelectPlan = (link: string) => {
    window.open(link, '_blank');
    setIsDialogOpen(false);
  };

  return (
    <>
      <div className={`mb-4 p-4 rounded-lg border ${styles.bg} flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          {days <= 1 ? (
            <AlertTriangle className={`h-5 w-5 ${styles.icon} flex-shrink-0`} />
          ) : (
            <Clock className={`h-5 w-5 ${styles.icon} flex-shrink-0`} />
          )}
          <div className={styles.text}>
            <span className="font-semibold">
              Sua assinatura {plan} {getMessage()}
            </span>
            <span className="hidden sm:inline ml-1">
              Renove agora para continuar usando o CobraFácil.
            </span>
          </div>
        </div>
        <Button 
          size="sm" 
          className={`${styles.button} text-white flex-shrink-0`}
          onClick={() => setIsDialogOpen(true)}
        >
          Renovar
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha seu plano de renovação</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <button
              onClick={() => handleSelectPlan(RENEWAL_LINKS.monthly)}
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-left"
            >
              <Calendar className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Mensal</div>
                <div className="text-lg font-bold text-primary">R$ 55,90/mês</div>
              </div>
            </button>

            <button
              onClick={() => handleSelectPlan(RENEWAL_LINKS.quarterly)}
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-left"
            >
              <CalendarDays className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Trimestral</div>
                <div className="text-lg font-bold text-primary">R$ 149,00/3 meses</div>
                <div className="text-sm text-green-600 font-medium">Economia de 11%</div>
              </div>
            </button>

            <button
              onClick={() => handleSelectPlan(RENEWAL_LINKS.annual)}
              className="relative flex items-center gap-4 p-4 rounded-lg border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors text-left"
            >
              <div className="absolute -top-2 right-4 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded">
                MAIS VENDIDO
              </div>
              <Star className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Anual</div>
                <div className="text-lg font-bold text-primary">R$ 479,00/ano</div>
                <div className="text-sm text-green-600 font-medium">Economia de R$ 191</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
