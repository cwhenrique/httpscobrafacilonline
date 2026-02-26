import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type EmployeePermission =
  | 'view_loans'
  | 'view_all_loans'
  | 'create_loans'
  | 'register_payments'
  | 'adjust_dates'
  | 'delete_loans'
  | 'view_clients'
  | 'view_all_clients'
  | 'create_clients'
  | 'edit_clients'
  | 'delete_clients'
  | 'view_reports'
  | 'manage_bills'
  | 'manage_vehicles'
  | 'manage_products'
  | 'manage_checks'
  | 'view_settings'
  | 'view_dashboard'
  | 'view_calendar';

interface EmployeeContextType {
  isEmployee: boolean;
  isOwner: boolean;
  ownerId: string | null;
  permissions: EmployeePermission[];
  hasPermission: (permission: EmployeePermission) => boolean;
  effectiveUserId: string | null;
  loading: boolean;
  employeeName: string | null;
  refreshContext: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

interface EmployeeContextResult {
  is_employee: boolean;
  employee_id: string | null;
  owner_id: string | null;
  employee_name: string | null;
  is_active: boolean | null;
  permissions: string[] | null;
}

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isEmployee, setIsEmployee] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<EmployeePermission[]>([]);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contextReady, setContextReady] = useState(false);

  const fetchEmployeeContext = useCallback(async (userId: string, opts?: { silent?: boolean }) => {
    console.log('[EmployeeContext] Buscando contexto para:', userId, opts?.silent ? '(silent)' : '');

    // Em refresh por foco/retorno do seletor de arquivos, não bloquear a UI
    if (!opts?.silent) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase.rpc('get_employee_context', { _user_id: userId });

      if (error) {
        console.error('[EmployeeContext] Erro RPC:', error);
        // Em erro, assume dono por segurança (para não bloquear tudo)
        setIsEmployee(false);
        setIsOwner(true);
        setOwnerId(null);
        setPermissions([]);
        setEmployeeName(null);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result || !result.is_employee) {
        // Não é funcionário = é DONO
        console.log('[EmployeeContext] ✓ Usuário é DONO (não é funcionário)');
        setIsEmployee(false);
        setIsOwner(true);
        setOwnerId(null);
        setPermissions([]);
        setEmployeeName(null);
      } else {
        // É funcionário
        const ctx = result as EmployeeContextResult;
        console.log('[EmployeeContext] ✓ FUNCIONÁRIO detectado:', ctx.employee_name);
        console.log('[EmployeeContext] Permissões:', ctx.permissions);

        setIsEmployee(true);
        setIsOwner(false);
        setOwnerId(ctx.owner_id);
        setEmployeeName(ctx.employee_name);

        if (!ctx.is_active) {
          console.warn('[EmployeeContext] Funcionário INATIVO');
          setPermissions([]);
        } else {
          setPermissions((ctx.permissions || []) as EmployeePermission[]);
        }
      }
    } catch (err) {
      console.error('[EmployeeContext] Erro crítico:', err);
      // Em erro crítico, assume dono
      setIsEmployee(false);
      setIsOwner(true);
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
      setContextReady(true);
    }
  }, []);

  // Método público para forçar refresh
  const refreshContext = useCallback(async () => {
    if (user?.id) {
      await fetchEmployeeContext(user.id);
    }
  }, [user?.id, fetchEmployeeContext]);

  // Carregar contexto quando usuário muda
  useEffect(() => {
    if (!user) {
      console.log('[EmployeeContext] Sem usuário, resetando');
      setLoading(false);
      setIsEmployee(false);
      setIsOwner(false);
      setOwnerId(null);
      setPermissions([]);
      setEmployeeName(null);
      setContextReady(false);
      return;
    }

    fetchEmployeeContext(user.id);
  }, [user?.id, fetchEmployeeContext]);

  // Recarregar ao focar a janela (detecta mudanças feitas pelo dono)
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id && contextReady) {
        console.log('[EmployeeContext] Window focus - revalidando (silent)...');
        fetchEmployeeContext(user.id, { silent: true });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user?.id, contextReady, fetchEmployeeContext]);

  // Ping de presença a cada 2 minutos (somente funcionários)
  useEffect(() => {
    if (!isEmployee || !contextReady || loading) return;

    // Registrar login na primeira vez
    supabase.rpc('update_employee_last_login').then(({ error }) => {
      if (error) console.error('[EmployeeContext] Erro ao registrar login:', error);
      else console.log('[EmployeeContext] ✓ Login registrado');
    });

    // Ping periódico de presença
    const interval = setInterval(() => {
      supabase.rpc('update_employee_last_seen').then(({ error }) => {
        if (error) console.error('[EmployeeContext] Erro no ping de presença:', error);
      });
    }, 2 * 60 * 1000); // 2 minutos

    return () => clearInterval(interval);
  }, [isEmployee, contextReady, loading]);

  // Para dono: usar user.id; para funcionário: usar owner_id
  const effectiveUserId = isEmployee ? ownerId : (user?.id ?? null);

  const hasPermission = useCallback((permission: EmployeePermission): boolean => {
    // Durante carregamento, NEGAR
    if (loading) return false;
    
    // Dono tem todas as permissões
    if (isOwner && !isEmployee) return true;
    
    // Funcionário: verificar permissão específica
    if (isEmployee) {
      return permissions.includes(permission);
    }
    
    // Estado indeterminado: NEGAR
    return false;
  }, [loading, isOwner, isEmployee, permissions]);

  // Log do estado final
  useEffect(() => {
    if (!loading && contextReady) {
      console.log('[EmployeeContext] Estado final:', {
        isEmployee,
        isOwner,
        ownerId,
        employeeName,
        permissions,
        effectiveUserId
      });
    }
  }, [loading, contextReady, isEmployee, isOwner, ownerId, employeeName, permissions, effectiveUserId]);

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
        refreshContext,
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
