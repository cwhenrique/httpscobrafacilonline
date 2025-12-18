import { useEffect, useRef } from 'react';
import { Loan } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useOverdueNotifications(loans: Loan[], loading: boolean) {
  const notifiedRef = useRef(false);
  const { user } = useAuth();

  const getOverdueLoans = (loans: Loan[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return loans.filter((loan) => {
      // Skip paid loans
      if (loan.status === 'paid') return false;

      // Skip historical contracts
      const isHistorical = (loan.notes || '').includes('[HISTORICAL_CONTRACT]');
      if (isHistorical) return false;

      const isDaily = loan.payment_type === 'daily';
      const numInstallments = loan.installments || 1;
      
      // Calculate total to receive correctly based on loan type
      let totalToReceive: number;
      if (isDaily) {
        // For daily loans, total_interest stores the daily installment amount
        const dailyInstallmentAmount = loan.total_interest || 0;
        totalToReceive = dailyInstallmentAmount * numInstallments;
      } else {
        const totalInterest = loan.total_interest || 0;
        totalToReceive = loan.principal_amount + totalInterest;
      }

      const remainingToReceive = totalToReceive - (loan.total_paid || 0);

      // If nothing remaining, not overdue
      if (remainingToReceive <= 0) return false;

      // Calculate installment value for payment tracking
      const installmentValue = totalToReceive / numInstallments;
      const paidInstallments = Math.floor((loan.total_paid || 0) / installmentValue);
      const dates = (loan.installment_dates as string[]) || [];

      if (dates.length > 0 && paidInstallments < dates.length) {
        const nextDueDate = new Date(dates[paidInstallments]);
        nextDueDate.setHours(0, 0, 0, 0);
        // Only overdue if today is AFTER due date (not on due date)
        return today > nextDueDate;
      } else {
        const dueDate = new Date(loan.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return today > dueDate;
      }
    });
  };

  const createOverdueNotification = async (overdueCount: number, totalAmount: number) => {
    if (!user) return;
    
    // Check if notification already exists for today to avoid duplicates
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: existingNotifications } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', '⚠️ Empréstimos em Atraso')
      .gte('created_at', `${todayStr}T00:00:00`)
      .limit(1);
    
    // Don't create if one already exists today
    if (existingNotifications && existingNotifications.length > 0) {
      return;
    }
    
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(totalAmount);

    await supabase.from('notifications').insert({
      user_id: user.id,
      title: '⚠️ Empréstimos em Atraso',
      message: `Você tem ${overdueCount} ${overdueCount === 1 ? 'empréstimo' : 'empréstimos'} em atraso totalizando ${formattedAmount}`,
      type: 'warning',
    });
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  };

  const showNotification = (overdueCount: number, totalAmount: number) => {
    if (Notification.permission !== 'granted') return;

    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(totalAmount);

    const notification = new Notification('⚠️ Empréstimos em Atraso', {
      body: `Você tem ${overdueCount} ${overdueCount === 1 ? 'empréstimo' : 'empréstimos'} em atraso totalizando ${formattedAmount}`,
      icon: '/favicon.ico',
      tag: 'overdue-loans',
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  };

  useEffect(() => {
    if (loading || notifiedRef.current) return;

    const checkAndNotify = async () => {
      const overdueLoans = getOverdueLoans(loans);
      
      if (overdueLoans.length > 0) {
        // Calculate total amount correctly for all loan types
        const totalAmount = overdueLoans.reduce((sum, loan) => {
          const isDaily = loan.payment_type === 'daily';
          const numInstallments = loan.installments || 1;
          
          let totalToReceive: number;
          if (isDaily) {
            // For daily loans, total_interest is the daily installment amount
            totalToReceive = (loan.total_interest || 0) * numInstallments;
          } else {
            const totalInterest = loan.total_interest || 0;
            totalToReceive = loan.principal_amount + totalInterest;
          }
          
          return sum + (totalToReceive - (loan.total_paid || 0));
        }, 0);

        // Create in-app notification (with duplicate check inside)
        await createOverdueNotification(overdueLoans.length, totalAmount);

        // Also show browser notification
        const hasPermission = await requestNotificationPermission();
        if (hasPermission) {
          showNotification(overdueLoans.length, totalAmount);
        }
        
        notifiedRef.current = true;
      }
    };

    checkAndNotify();
  }, [loans, loading, user]);

  return {
    requestPermission: requestNotificationPermission,
    isSupported: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'denied',
  };
}
