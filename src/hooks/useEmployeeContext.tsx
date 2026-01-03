import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type EmployeePermission =
  | 'view_loans'
  | 'create_loans'
  | 'register_payments'
  | 'adjust_dates'
  | 'delete_loans'
  | 'view_clients'
  | 'create_clients'
  | 'edit_clients'
  | 'delete_clients'
  | 'view_reports'
  | 'manage_bills'
  | 'manage_vehicles'
  | 'manage_products'
  | 'view_settings';

interface EmployeeContextType {
  isEmployee: boolean;
  ownerId: string | null;
  permissions: EmployeePermission[];
  hasPermission: (permission: EmployeePermission) => boolean;
  effectiveUserId: string | null;
  loading: boolean;
  employeeName: string | null;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isEmployee, setIsEmployee] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<EmployeePermission[]>([]);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkEmployeeStatus() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Verificar se o usuário é um funcionário ativo
        const { data: employeeData, error } = await supabase
          .from('employees')
          .select(`
            id,
            owner_id,
            name,
            is_active
          `)
          .eq('employee_user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Erro ao verificar status de funcionário:', error);
          setLoading(false);
          return;
        }

        if (employeeData) {
          // Buscar permissões do funcionário
          const { data: permissionsData } = await supabase
            .from('employee_permissions')
            .select('permission')
            .eq('employee_id', employeeData.id);

          setIsEmployee(true);
          setOwnerId(employeeData.owner_id);
          setEmployeeName(employeeData.name);
          setPermissions((permissionsData || []).map(p => p.permission as EmployeePermission));
        } else {
          setIsEmployee(false);
          setOwnerId(null);
          setEmployeeName(null);
          setPermissions([]);
        }
      } catch (err) {
        console.error('Erro ao verificar funcionário:', err);
      } finally {
        setLoading(false);
      }
    }

    checkEmployeeStatus();
  }, [user?.id]);

  // ID efetivo para queries - usa ID do dono se for funcionário
  const effectiveUserId = isEmployee ? ownerId : user?.id ?? null;

  // Verifica se tem permissão específica
  const hasPermission = (permission: EmployeePermission): boolean => {
    // Dono tem todas as permissões
    if (!isEmployee) return true;
    return permissions.includes(permission);
  };

  return (
    <EmployeeContext.Provider
      value={{
        isEmployee,
        ownerId,
        permissions,
        hasPermission,
        effectiveUserId,
        loading,
        employeeName,
      }}
    >
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployeeContext() {
  const context = useContext(EmployeeContext);
  if (context === undefined) {
    throw new Error('useEmployeeContext must be used within an EmployeeProvider');
  }
  return context;
}
