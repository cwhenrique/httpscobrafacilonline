import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoanPayment } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';

export function useAllPayments() {
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();

  const fetchPayments = async () => {
    if (!user || employeeLoading || !effectiveUserId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('loan_payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Erro ao carregar pagamentos:', error);
    } else {
      setPayments(data as LoanPayment[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, [user, effectiveUserId, employeeLoading]);

  return {
    payments,
    loading,
    fetchPayments,
  };
}
