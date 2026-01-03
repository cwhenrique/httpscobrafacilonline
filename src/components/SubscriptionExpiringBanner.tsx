import { useMemo } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function SubscriptionExpiringBanner() {
  const { profile } = useProfile();
  const navigate = useNavigate();

  const expirationInfo = useMemo(() => {
    if (!profile?.subscription_expires_at) return null;
    
    // Only show for monthly and annual plans
    const plan = profile.subscription_plan;
    if (plan === 'trial' || plan === 'lifetime' || !plan) return null;

    const expiresAt = new Date(profile.subscription_expires_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiresAt.setHours(0, 0, 0, 0);
    
    const diffTime = expiresAt.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Only show if 3 days or less remaining and not expired
    if (diffDays > 3 || diffDays < 0) return null;

    return {
      days: diffDays,
      plan: plan === 'monthly' ? 'mensal' : plan === 'quarterly' ? 'trimestral' : 'anual',
    };
  }, [profile]);

  if (!expirationInfo) return null;

  const { days, plan } = expirationInfo;

  // Dynamic styling based on urgency
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

  const handleRenew = () => {
    if (profile?.payment_link) {
      window.open(profile.payment_link, '_blank');
    } else {
      navigate('/profile');
    }
  };

  return (
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
        onClick={handleRenew}
      >
        Renovar
      </Button>
    </div>
  );
}
