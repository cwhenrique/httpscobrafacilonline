import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { EmployeeProvider } from "@/hooks/useEmployeeContext";
import { useVisibilityControl } from "@/hooks/useVisibilityControl";
import { useDevToolsProtection } from "@/hooks/useDevToolsProtection";
import ProtectedRoute from "@/components/ProtectedRoute";
import { PermissionRoute } from "@/components/PermissionRoute";
import { OwnerOnlyRoute } from "@/components/OwnerOnlyRoute";
import { AccessDebugPanel } from "@/components/AccessDebugPanel";
import Landing from "./pages/Landing";
import PvWhatsapp from "./pages/PvWhatsapp";
import Affiliate from "./pages/Affiliate";
import AffiliateId from "./pages/AffiliateId";
import Auth from "./pages/Auth";
import CreateTrialUser from "./pages/CreateTrialUser";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientScores from "./pages/ClientScores";
import Loans from "./pages/Loans";
import Bills from "./pages/Bills";
import ProductSales from "./pages/ProductSales";
import CalendarView from "./pages/CalendarView";
import ReportsLoans from "./pages/ReportsLoans";
import ReportsSales from "./pages/ReportsSales";
import Vehicles from "./pages/Vehicles";
import CheckDiscounts from "./pages/CheckDiscounts";
import Simulator from "./pages/Simulator";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Install from "./pages/Install";
import Tutorials from "./pages/Tutorials";
import Employees from "./pages/Employees";

import Quiz from "./pages/Quiz";
import ConnectionTest from "./pages/ConnectionTest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 1000 * 30, // 30 segundos
    },
  },
});

// Componente interno que usa hooks que dependem dos providers
const AppContent = () => {
  useVisibilityControl();
  useDevToolsProtection();
  
  return (
    <AuthProvider>
      <EmployeeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Painel de debug ativado via ?debugAccess=1 */}
            <AccessDebugPanel />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/pvwhatsapp" element={<PvWhatsapp />} />
              <Route path="/aff" element={<Affiliate />} />
              <Route path="/affid" element={<AffiliateId />} />
              <Route path="/dasiydsad-adsyasfdca" element={<CreateTrialUser />} />
              <Route path="/quiz" element={<Quiz />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/teste-conexao" element={<ConnectionTest />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><PermissionRoute permission="view_clients"><Clients /></PermissionRoute></ProtectedRoute>} />
              <Route path="/scores" element={<ProtectedRoute><PermissionRoute permission="view_clients"><ClientScores /></PermissionRoute></ProtectedRoute>} />
              <Route path="/loans" element={<ProtectedRoute><PermissionRoute permission="view_loans"><Loans /></PermissionRoute></ProtectedRoute>} />
              <Route path="/bills" element={<ProtectedRoute><PermissionRoute permission="manage_bills"><Bills /></PermissionRoute></ProtectedRoute>} />
              <Route path="/product-sales" element={<ProtectedRoute><PermissionRoute permission="manage_products"><ProductSales /></PermissionRoute></ProtectedRoute>} />
              <Route path="/vehicles" element={<ProtectedRoute><PermissionRoute permission="manage_vehicles"><Vehicles /></PermissionRoute></ProtectedRoute>} />
              <Route path="/check-discounts" element={<ProtectedRoute><PermissionRoute permission="manage_checks"><CheckDiscounts /></PermissionRoute></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><PermissionRoute permission="view_loans"><CalendarView /></PermissionRoute></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><PermissionRoute permission="view_reports"><ReportsLoans /></PermissionRoute></ProtectedRoute>} />
              <Route path="/reports-sales" element={<ProtectedRoute><PermissionRoute permission="view_reports"><ReportsSales /></PermissionRoute></ProtectedRoute>} />
              <Route path="/simulator" element={<ProtectedRoute><Simulator /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><PermissionRoute permission="view_settings"><Settings /></PermissionRoute></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/install" element={<ProtectedRoute><Install /></ProtectedRoute>} />
              <Route path="/tutorials" element={<ProtectedRoute><Tutorials /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><OwnerOnlyRoute><Employees /></OwnerOnlyRoute></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </EmployeeProvider>
    </AuthProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
);

export default App;
