import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Registrar Service Worker com atualização automática
const updateSW = registerSW({
  onNeedRefresh() {
    // Aplicar atualização imediatamente — skipWaiting garante controle
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App pronto para uso offline');
  },
});

// Verificar atualizações a cada 5 minutos
setInterval(() => {
  updateSW();
}, 5 * 60 * 1000);

createRoot(document.getElementById("root")!).render(<App />);
