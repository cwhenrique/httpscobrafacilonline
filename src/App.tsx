import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { WhatsAppStatusProvider } from "@/contexts/WhatsAppStatusContext";
import { EmployeeProvider } from "@/hooks/useEmployeeContext";
import { useVisibilityControl } from "@/hooks/useVisibilityControl";
import { useDevToolsProtection } from "@/hooks/useDevToolsProtection";
import ProtectedRoute from "@/components/ProtectedRoute";
import { PermissionRoute } from "@/components/PermissionRoute";
import { OwnerOnlyRoute } from "@/components/OwnerOnlyRoute";
import { AccessDebugPanel } from "@/components/AccessDebugPanel";
import ErrorBoundary from "@/components/ErrorBoundary";

// Landing carrega eager (primeira página)
import Landing from "./pages/Landing";

// Todas as outras páginas com lazy loading
const PvWhatsapp = lazy(() => import("./pages/PvWhatsapp"));
const Affiliate = lazy(() => import("./pages/Affiliate"));
const AffiliateId = lazy(() => import("./pages/AffiliateId"));
const Auth = lazy(() => import("./pages/Auth"));
const CreateTrialUser = lazy(() => import("./pages/CreateTrialUser"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientScores = lazy(() => import("./pages/ClientScores"));
const Loans = lazy(() => import("./pages/Loans"));
const Bills = lazy(() => import("./pages/Bills"));
const ProductSales = lazy(() => import("./pages/ProductSales"));
const CalendarView = lazy(() => import("./pages/CalendarView"));
const ReportsLoans = lazy(() => import("./pages/ReportsLoans"));
const ReportsSales = lazy(() => import("./pages/ReportsSales"));
const Vehicles = lazy(() => import("./pages/Vehicles"));
const CheckDiscounts = lazy(() => import("./pages/CheckDiscounts"));
const Simulator = lazy(() => import("./pages/Simulator"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const Install = lazy(() => import("./pages/Install"));
const Tutorials = lazy(() => import("./pages/Tutorials"));
const Employees = lazy(() => import("./pages/Employees"));
const Quiz = lazy(() => import("./pages/Quiz"));
const Plans = lazy(() => import("./pages/Plans"));
const ConnectionTest = lazy(() => import("./pages/ConnectionTest"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--background, #0a0a0a)'}}>
    <div style={{textAlign:'center'}}>
      <div style={{width:48,height:48,border:'3px solid #1a1a1a',borderTopColor:'#22c55e',borderRadius:'50%',margin:'0 auto 16px',animation:'spin 1s linear infinite'}} />
      <p style={{color:'#22c55e',fontSize:14,margin:0}}>Carregando...</p>
    </div>
  </div>
);

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
      <WhatsAppStatusProvider>
      <EmployeeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Painel de debug ativado via ?debugAccess=1 */}
            <AccessDebugPanel />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/pvwhatsapp" element={<PvWhatsapp />} />
              <Route path="/aff" element={<Affiliate />} />
              <Route path="/affid" element={<AffiliateId />} />
              <Route path="/dasiydsad-adsyasfdca" element={<CreateTrialUser />} />
              <Route path="/quiz" element={<Quiz />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/planos" element={<Plans />} />
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
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </EmployeeProvider>
      </WhatsAppStatusProvider>
    </AuthProvider>
  );
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" storageKey="cobrafacil-theme">
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary fallbackType="global">
        <AppContent />
      </ErrorBoundary>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
