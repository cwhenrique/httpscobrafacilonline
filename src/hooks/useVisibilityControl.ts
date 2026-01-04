import { useEffect } from 'react';

export function useVisibilityControl() {
  useEffect(() => {
    // Marcar que o app está ativo na sessão
    sessionStorage.setItem('pwa_session_active', 'true');
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Voltou ao app - apenas manter sessão ativa
        sessionStorage.setItem('pwa_session_active', 'true');
      } else {
        // Saiu do app - registrar momento
        sessionStorage.setItem('pwa_last_hidden', Date.now().toString());
      }
    };
    
    // Limpar sessão quando a janela for fechada de verdade
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('pwa_session_active');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}
