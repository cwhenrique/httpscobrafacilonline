import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import EmployeeManagement from '@/components/EmployeeManagement';
import EmployeeFeatureCard from '@/components/EmployeeFeatureCard';
import { useProfile } from '@/hooks/useProfile';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// URL de pagamento no Cakto para liberar 1 funcionário
const CAKTO_EMPLOYEE_PAYMENT_URL = 'https://pay.cakto.com.br/B3sKUqX';

export default function Employees() {
  const { user } = useAuth();
  const { profile, refetch } = useProfile();
  const { isEmployee } = useEmployeeContext();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Verificar se o usuário é admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (!error && data) {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error('Erro ao verificar admin:', err);
      } finally {
        setCheckingAdmin(false);
      }
    }

    checkAdminStatus();
  }, [user]);

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
    if (!user) return;

    // Admin: libera diretamente sem pagamento
    if (isAdmin) {
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
        
        toast.success('Slot de funcionário liberado (Admin)!');
        refetch();
      } catch (error) {
        console.error('Erro ao liberar funcionário:', error);
        toast.error('Erro ao liberar funcionário');
      }
      return;
    }

    // Usuário normal: redireciona para pagamento no Cakto
    // O email do usuário é passado como parâmetro para identificar no webhook
    const paymentUrl = `${CAKTO_EMPLOYEE_PAYMENT_URL}?email=${encodeURIComponent(user.email || '')}`;
    window.open(paymentUrl, '_blank');
    
    toast.info('Após o pagamento, o slot será liberado automaticamente.');
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

        <EmployeeFeatureCard 
          isUnlocked={!!isUnlocked} 
          onUnlock={handleUnlockEmployee}
          isAdmin={isAdmin}
          isLoading={checkingAdmin}
        >
          <EmployeeManagement />
        </EmployeeFeatureCard>
      </div>
    </DashboardLayout>
  );
}
