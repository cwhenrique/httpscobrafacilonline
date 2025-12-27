import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TutorialVideo {
  id: string;
  order_number: number;
  title: string;
  description: string | null;
  category: string;
  youtube_video_id: string | null;
  duration: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useTutorials = () => {
  const queryClient = useQueryClient();

  const { data: tutorials, isLoading } = useQuery({
    queryKey: ['tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorial_videos')
        .select('*')
        .eq('is_active', true)
        .order('order_number');
      
      if (error) throw error;
      return data as TutorialVideo[];
    }
  });

  const updateTutorial = useMutation({
    mutationFn: async ({ id, youtube_video_id, duration }: { id: string; youtube_video_id: string; duration?: string }) => {
      const { error } = await supabase
        .from('tutorial_videos')
        .update({ 
          youtube_video_id, 
          duration,
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorials'] });
      toast.success('Aula atualizada com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating tutorial:', error);
      toast.error('Erro ao atualizar aula. Verifique se você tem permissão de admin.');
    }
  });

  return { tutorials, isLoading, updateTutorial };
};

export const useIsAdmin = () => {
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ['isAdmin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
      
      return !!data;
    }
  });

  return { isAdmin: isAdmin ?? false, isLoading };
};
