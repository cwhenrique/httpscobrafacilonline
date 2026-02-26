import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useVisibilityControl() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Verificar quanto tempo ficou oculto
        const lastHidden = sessionStorage.getItem('pwa_last_hidden');
        const hiddenDuration = lastHidden ? Date.now() - parseInt(lastHidden) : 0;
        
        // Se ficou oculto por mais de 30 segundos, invalidar cache para buscar dados frescos
        if (hiddenDuration > 30000) {
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          queryClient.invalidateQueries({ queryKey: ['operational-stats'] });
          queryClient.invalidateQueries({ queryKey: ['loans'] });
          queryClient.invalidateQueries({ queryKey: ['clients'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-health'] });
        }
      } else {
        // Saiu do app - registrar momento
        sessionStorage.setItem('pwa_last_hidden', Date.now().toString());
      }
    };
    
    // Limpar dados de formulário quando a janela for fechada
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('hideEmployeeBanner');
      // Limpar dados do formulário de cliente
      sessionStorage.removeItem('client_dialog_open');
      sessionStorage.removeItem('client_form_data');
      sessionStorage.removeItem('client_form_tab');
      sessionStorage.removeItem('client_editing');
      sessionStorage.removeItem('client_created_id');
      sessionStorage.removeItem('client_created_name');
      // Limpar dados do formulário de empréstimo
      sessionStorage.removeItem('loan_dialog_open');
      sessionStorage.removeItem('loan_daily_dialog_open');
      sessionStorage.removeItem('loan_price_dialog_open');
      sessionStorage.removeItem('loan_payment_dialog_open');
      sessionStorage.removeItem('loan_selected_id');
      sessionStorage.removeItem('loan_form_data');
      sessionStorage.removeItem('loan_payment_data');
      sessionStorage.removeItem('loan_price_form_data');
      sessionStorage.removeItem('loan_installment_dates');
      sessionStorage.removeItem('loan_installment_value');
      sessionStorage.removeItem('loan_daily_date_mode');
      sessionStorage.removeItem('loan_daily_first_date');
      sessionStorage.removeItem('loan_daily_installment_count');
      sessionStorage.removeItem('loan_skip_saturday');
      sessionStorage.removeItem('loan_skip_sunday');
      sessionStorage.removeItem('loan_skip_holidays');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [queryClient]);
}
