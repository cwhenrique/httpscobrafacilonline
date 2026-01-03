import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';

interface RegisterMessageParams {
  loanId: string;
  contractType: 'loan' | 'product' | 'vehicle' | 'contract';
  messageType: 'overdue' | 'due_today' | 'early';
  clientPhone: string;
  clientName: string;
}

export function useWhatsappMessages(loanId?: string) {
  const { user } = useAuth();
  const { effectiveUserId, loading: employeeLoading } = useEmployeeContext();
  const queryClient = useQueryClient();

  const { data: messageCount = 0, isLoading } = useQuery({
    queryKey: ['whatsapp-messages', effectiveUserId, loanId],
    queryFn: async () => {
      if (!loanId || !effectiveUserId) return 0;
      
      const { count, error } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('loan_id', loanId)
        .eq('user_id', effectiveUserId);
      
      if (error) {
        console.error('Error fetching message count:', error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!loanId && !!user && !employeeLoading && !!effectiveUserId,
  });

  const registerMutation = useMutation({
    mutationFn: async (params: RegisterMessageParams) => {
      if (!effectiveUserId) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('whatsapp_messages')
        .insert({
          user_id: effectiveUserId,
          loan_id: params.loanId,
          contract_type: params.contractType,
          message_type: params.messageType,
          client_phone: params.clientPhone,
          client_name: params.clientName,
        });
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', variables.loanId] });
    },
  });

  const registerMessage = async (params: RegisterMessageParams) => {
    return registerMutation.mutateAsync(params);
  };

  return { 
    messageCount, 
    isLoading, 
    registerMessage,
    isRegistering: registerMutation.isPending 
  };
}
