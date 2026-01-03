import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { cn } from '@/lib/utils';
import { ProfileSetupModal } from '@/components/ProfileSetupModal';
import { SubscriptionExpiringBanner } from '@/components/SubscriptionExpiringBanner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  User,
  ChevronRight,
  Calendar,
  Calculator,
  Award,
  ShoppingBag,
  Car,
  TrendingUp,
  FileText,
  GraduationCap,
  UserCheck,
} from 'lucide-react';
import { NotificationCenter } from '@/components/NotificationCenter';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = [
  // Geral
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clientes', href: '/clients', icon: Users },
  { name: 'Score de Clientes', href: '/scores', icon: Award },
  // Empréstimos
  { name: 'Empréstimos', href: '/loans', icon: DollarSign },
  { name: 'Relatório de Empréstimos', href: '/reports', icon: BarChart3 },
  { name: 'Calendário de Cobranças', href: '/calendar', icon: Calendar },
  // Vendas e Veículos
  { name: 'Vendas de Produtos', href: '/product-sales', icon: ShoppingBag },
  { name: 'Veículos Registrados', href: '/vehicles', icon: Car },
  { name: 'Rel. Vendas', href: '/reports-sales', icon: TrendingUp },
  // Contas e Ferramentas
  { name: 'Simulador', href: '/simulator', icon: Calculator },
  { name: 'Minhas Contas a Pagar', href: '/bills', icon: FileText },
  { name: 'Funcionários', href: '/employees', icon: UserPlus },
  { name: 'Aulas do App', href: '/tutorials', icon: GraduationCap },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="CobraFácil" 
            className="w-10 h-10 rounded-xl"
          />
          <div>
            <h1 className="font-display font-bold text-lg text-sidebar-foreground">CobraFácil</h1>
            <p className="text-xs text-sidebar-foreground/70">Gestão Financeira</p>
          </div>
        </div>
      </div>

      {/* Profile Section - Top of menu */}
      <div className="px-3 mb-4">
        <Link
          to="/profile"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border',
            location.pathname === '/profile'
              ? 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-accent'
              : 'bg-sidebar-accent/20 text-sidebar-foreground border-sidebar-border/50 hover:bg-sidebar-accent/40'
          )}
        >
          <div className="w-9 h-9 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-sidebar-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">Meu Perfil</p>
            <p className="text-xs text-sidebar-foreground/60">Ver informações</p>
          </div>
          <ChevronRight className="w-4 h-4 opacity-60" />
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3">
        <p className="px-4 mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">Menu</p>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* PWA Install Banner - Fixed at bottom */}
      <div className="px-3 py-2">
        <PWAInstallBanner variant="sidebar" />
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/60 text-center">
          © 2024 CobraFácil
        </p>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isProfileComplete, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const { isEmployee, employeeName } = useEmployeeContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show modal on settings page or while loading
  const showProfileModal = !profileLoading && !isProfileComplete && location.pathname !== '/settings';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-sidebar-background/40 backdrop-blur-md border-r border-sidebar-border overflow-hidden">
          <ScrollArea className="flex-1">
            <SidebarContent />
          </ScrollArea>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar-background/40 backdrop-blur-md border-sidebar-border">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="CobraFácil" className="w-6 h-6 rounded" />
            <span className="font-display font-bold">CobraFácil</span>
            {isEmployee && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                {employeeName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <NotificationCenter />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-muted-foreground">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:pl-72 overflow-x-auto">
        <div className="min-h-screen pt-16 lg:pt-0 min-w-fit">
          {/* Desktop Header */}
          <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-border bg-card">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-display font-semibold">
                  Bem-vindo de volta!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Gerencie seus empréstimos
                </p>
              </div>
              {isEmployee && (
                <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <UserCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Funcionário: {employeeName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <User className="w-4 h-4" />
                    {user?.email}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="p-4 lg:p-8">
            <SubscriptionExpiringBanner />
            {children}
          </div>
        </div>
      </main>

      {/* Profile Setup Modal - blocks usage until profile is complete */}
      <ProfileSetupModal open={showProfileModal} onComplete={refetchProfile} />
    </div>
  );
}
