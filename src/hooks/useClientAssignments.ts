import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ClientAssignment {
  id: string;
  client_id: string;
  employee_id: string;
  assigned_by: string;
  created_at: string;
}

export function useClientAssignments() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const fetchAssignmentsForEmployee = useCallback(async (employeeId: string): Promise<string[]> => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('client_assignments')
        .select('client_id')
        .eq('employee_id', employeeId);

      if (error) throw error;
      return (data || []).map(a => a.client_id);
    } catch (err) {
      console.error('Error fetching client assignments:', err);
      return [];
    }
  }, [user]);

  const updateAssignments = useCallback(async (
    employeeId: string, 
    clientIds: string[]
  ): Promise<boolean> => {
    if (!user) return false;
    
    setLoading(true);
    try {
      // First, delete all existing assignments for this employee
      const { error: deleteError } = await supabase
        .from('client_assignments')
        .delete()
        .eq('employee_id', employeeId);

      if (deleteError) throw deleteError;

      // Then insert new assignments
      if (clientIds.length > 0) {
        const assignments = clientIds.map(clientId => ({
          client_id: clientId,
          employee_id: employeeId,
          assigned_by: user.id,
        }));

        const { error: insertError } = await supabase
          .from('client_assignments')
          .insert(assignments);

        if (insertError) throw insertError;
      }

      toast.success('Clientes atribuídos com sucesso!');
      return true;
    } catch (err) {
      console.error('Error updating client assignments:', err);
      toast.error('Erro ao atribuir clientes');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    loading,
    fetchAssignmentsForEmployee,
    updateAssignments,
  };
}
