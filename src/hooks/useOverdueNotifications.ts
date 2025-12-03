import { useEffect, useRef } from 'react';
import { Loan } from '@/types/database';

export function useOverdueNotifications(loans: Loan[], loading: boolean) {
  const notifiedRef = useRef(false);

  const getOverdueLoans = (loans: Loan[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return loans.filter((loan) => {
      if (loan.status === 'paid') return false;

      const numInstallments = loan.installments || 1;
      const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
      const totalToReceive = loan.principal_amount + (interestPerInstallment * numInstallments);
      const remainingToReceive = totalToReceive - (loan.total_paid || 0);

      if (remainingToReceive <= 0) return false;

      const principalPerInstallment = loan.principal_amount / numInstallments;
      const totalPerInstallment = principalPerInstallment + interestPerInstallment;
      const paidInstallments = Math.floor((loan.total_paid || 0) / totalPerInstallment);
      const dates = (loan.installment_dates as string[]) || [];

      if (dates.length > 0 && paidInstallments < dates.length) {
        const nextDueDate = new Date(dates[paidInstallments]);
        nextDueDate.setHours(0, 0, 0, 0);
        return today > nextDueDate;
      } else {
        const dueDate = new Date(loan.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return today > dueDate;
      }
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
        const hasPermission = await requestNotificationPermission();
        
        if (hasPermission) {
          const totalAmount = overdueLoans.reduce((sum, loan) => {
            const numInstallments = loan.installments || 1;
            const interestPerInstallment = loan.principal_amount * (loan.interest_rate / 100);
            const totalToReceive = loan.principal_amount + (interestPerInstallment * numInstallments);
            return sum + (totalToReceive - (loan.total_paid || 0));
          }, 0);

          showNotification(overdueLoans.length, totalAmount);
          notifiedRef.current = true;
        }
      }
    };

    checkAndNotify();
  }, [loans, loading]);

  return {
    requestPermission: requestNotificationPermission,
    isSupported: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'denied',
  };
}
