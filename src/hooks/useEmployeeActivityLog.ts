import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityLogEntry {
  id: string;
  employee_id: string;
  employee_user_id: string;
  action_type: string;
  description: string;
  related_id: string | null;
  related_type: string | null;
  amount: number | null;
  client_name: string | null;
  created_at: string;
  metadata: unknown;
  employee_name?: string;
}

interface EmployeeReceiptSummary {
  employee_id: string;
  employee_name: string;
  total_received: number;
  total_principal: number;
  total_interest: number;
  payment_count: number;
}

export function useEmployeeActivityLog() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [receiptSummaries, setReceiptSummaries] = useState<EmployeeReceiptSummary[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  const fetchActivities = useCallback(async (filters?: {
    employeeId?: string;
    actionType?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('employee_activity_log')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.employeeId) {
        query = query.eq('employee_id', filters.employeeId);
      }
      if (filters?.actionType) {
        query = query.eq('action_type', filters.actionType);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrich with employee names
      const employeeIds = [...new Set((data || []).map(a => a.employee_id))];
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name')
        .in('id', employeeIds);

      const nameMap = new Map((employees || []).map(e => [e.id, e.name]));

      const enriched = (data || []).map(a => ({
        ...a,
        employee_name: nameMap.get(a.employee_id) || 'Funcionário',
      }));

      setActivities(enriched);
    } catch (err) {
      console.error('Erro ao buscar atividades:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchReceiptSummaries = useCallback(async (dateFrom?: string, dateTo?: string) => {
    if (!user) return;
    setLoadingSummaries(true);

    try {
      // Get employees
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, employee_user_id')
        .eq('owner_id', user.id);

      if (!employees?.length) {
        setReceiptSummaries([]);
        return;
      }

      const summaries: EmployeeReceiptSummary[] = [];

      for (const emp of employees) {
        let query = supabase
          .from('loan_payments')
          .select('amount, principal_paid, interest_paid')
          .eq('user_id', user.id)
          .eq('created_by', emp.employee_user_id);

        if (dateFrom) query = query.gte('payment_date', dateFrom);
        if (dateTo) query = query.lte('payment_date', dateTo);

        const { data: payments } = await query;

        if (payments?.length) {
          summaries.push({
            employee_id: emp.id,
            employee_name: emp.name,
            total_received: payments.reduce((s, p) => s + (p.amount || 0), 0),
            total_principal: payments.reduce((s, p) => s + (p.principal_paid || 0), 0),
            total_interest: payments.reduce((s, p) => s + (p.interest_paid || 0), 0),
            payment_count: payments.length,
          });
        } else {
          summaries.push({
            employee_id: emp.id,
            employee_name: emp.name,
            total_received: 0,
            total_principal: 0,
            total_interest: 0,
            payment_count: 0,
          });
        }
      }

      setReceiptSummaries(summaries);
    } catch (err) {
      console.error('Erro ao buscar resumo de recebimentos:', err);
    } finally {
      setLoadingSummaries(false);
    }
  }, [user]);

  return {
    activities,
    loading,
    fetchActivities,
    receiptSummaries,
    loadingSummaries,
    fetchReceiptSummaries,
  };
}
