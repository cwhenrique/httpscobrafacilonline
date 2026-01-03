import DashboardLayout from '@/components/layout/DashboardLayout';
import EmployeeManagement from '@/components/EmployeeManagement';
import EmployeeFeatureCard from '@/components/EmployeeFeatureCard';
import { useProfile } from '@/hooks/useProfile';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Employees() {
  const { user } = useAuth();
  const { profile, refetch } = useProfile();
  const { isEmployee } = useEmployeeContext();

  // Funcionários não podem acessar esta página
  if (isEmployee) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
          <p className="text-muted-foreground">
            Apenas o proprietário da conta pode gerenciar funcionários.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleUnlockEmployee = async () => {
    // Aqui seria integrado o pagamento
    // Por enquanto, apenas incrementa max_employees
    if (!user) return;

    try {
      const currentMax = profile?.max_employees || 0;
      const { error } = await supabase
        .from('profiles')
        .update({ 
          employees_feature_enabled: true,
          max_employees: currentMax + 1 
        })
        .eq('id', user.id);

      if (error) throw error;
      
      toast.success('Slot de funcionário liberado!');
      refetch();
    } catch (error) {
      console.error('Erro ao liberar funcionário:', error);
      toast.error('Erro ao liberar funcionário');
    }
  };

  const isUnlocked = profile?.employees_feature_enabled && (profile?.max_employees || 0) > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Funcionários</h1>
          <p className="text-muted-foreground">
            Gerencie colaboradores com acesso à sua conta
          </p>
        </div>

        <EmployeeFeatureCard isUnlocked={!!isUnlocked} onUnlock={handleUnlockEmployee}>
          <EmployeeManagement />
        </EmployeeFeatureCard>
      </div>
    </DashboardLayout>
  );
}
