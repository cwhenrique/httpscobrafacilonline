import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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
  isOwner: boolean;
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
  const [isOwner, setIsOwner] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<EmployeePermission[]>([]);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  useEffect(() => {
    async function checkEmployeeStatus() {
      // Reset state quando user muda ou não existe
      if (!user) {
        setLoading(false);
        setIsEmployee(false);
        setIsOwner(false);
        setOwnerId(null);
        setPermissions([]);
        setEmployeeName(null);
        setCheckedUserId(null);
        return;
      }

      // Se já verificamos este usuário, não verificar novamente
      if (checkedUserId === user.id) {
        return;
      }

      // Reset completo antes de nova verificação
      setLoading(true);
      setIsEmployee(false);
      setIsOwner(false);
      setOwnerId(null);
      setPermissions([]);
      setEmployeeName(null);

      try {
        // Verificar se o usuário é um funcionário (ativo ou não)
        const { data: employeeData, error } = await supabase
          .from('employees')
          .select(`
            id,
            owner_id,
            name,
            is_active
          `)
          .eq('employee_user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Erro ao verificar status de funcionário:', error);
          // Em caso de erro, assumir que é dono
          setIsOwner(true);
          setLoading(false);
          setCheckedUserId(user.id);
          return;
        }

        if (employeeData) {
          // Usuário é um funcionário
          if (!employeeData.is_active) {
            // Funcionário inativo - sem acesso
            console.warn('Funcionário inativo tentando acessar');
            setIsEmployee(true);
            setOwnerId(employeeData.owner_id);
            setEmployeeName(employeeData.name);
            setPermissions([]); // Sem permissões
          } else {
            // Funcionário ativo - buscar permissões
            const { data: permissionsData, error: permError } = await supabase
              .from('employee_permissions')
              .select('permission')
              .eq('employee_id', employeeData.id);

            if (permError) {
              console.error('Erro ao buscar permissões:', permError);
            }

            setIsEmployee(true);
            setOwnerId(employeeData.owner_id);
            setEmployeeName(employeeData.name);
            setPermissions((permissionsData || []).map(p => p.permission as EmployeePermission));
          }
        } else {
          // Não é funcionário - é dono
          setIsOwner(true);
          setIsEmployee(false);
          setOwnerId(null);
          setEmployeeName(null);
          setPermissions([]);
        }
      } catch (err) {
        console.error('Erro ao verificar funcionário:', err);
        // Em caso de erro crítico, assumir dono
        setIsOwner(true);
      } finally {
        setLoading(false);
        setCheckedUserId(user.id);
      }
    }

    checkEmployeeStatus();
  }, [user?.id, checkedUserId]);

  // ID efetivo para queries - usa ID do dono se for funcionário
  const effectiveUserId = isEmployee ? ownerId : user?.id ?? null;

  // Verifica se tem permissão específica - SEGURO: só libera se confirmado como dono
  const hasPermission = useCallback((permission: EmployeePermission): boolean => {
    // Durante carregamento, negar por segurança
    if (loading) return false;
    
    // Dono confirmado tem todas as permissões
    if (isOwner && !isEmployee) return true;
    
    // Funcionário: verificar permissão específica
    if (isEmployee) {
      return permissions.includes(permission);
    }
    
    // Estado indeterminado: negar por segurança
    return false;
  }, [loading, isOwner, isEmployee, permissions]);

  return (
    <EmployeeContext.Provider
      value={{
        isEmployee,
        isOwner,
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
