import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Registrar Service Worker com controle manual de atualizações
const updateSW = registerSW({
  onNeedRefresh() {
    // Verificar se é um fechamento real ou apenas minimização
    const sessionActive = sessionStorage.getItem('pwa_session_active');
    if (!sessionActive) {
      // App foi fechado e reaberto - pode atualizar
      updateSW(true);
    }
    // Se só minimizou, não atualiza automaticamente
  },
  onOfflineReady() {
    console.log('App pronto para uso offline');
  },
});

createRoot(document.getElementById("root")!).render(<App />);
