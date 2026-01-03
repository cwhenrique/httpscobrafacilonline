import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
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
  
  // Track which user we last checked to avoid duplicate calls
  const lastCheckedUserRef = useRef<string | null>(null);

  useEffect(() => {
    async function checkEmployeeStatus() {
      // Se não há usuário, resetar tudo
      if (!user) {
        console.log('[EmployeeContext] Sem usuário, resetando estado');
        setLoading(false);
        setIsEmployee(false);
        setIsOwner(false);
        setOwnerId(null);
        setPermissions([]);
        setEmployeeName(null);
        lastCheckedUserRef.current = null;
        return;
      }

      // Se já verificamos este usuário, não verificar novamente
      if (lastCheckedUserRef.current === user.id) {
        console.log('[EmployeeContext] Usuário já verificado:', user.id);
        return;
      }

      console.log('[EmployeeContext] Iniciando verificação para:', user.email, user.id);

      // Marcar que estamos verificando este usuário
      lastCheckedUserRef.current = user.id;

      // Resetar para estado de loading
      setLoading(true);
      setIsEmployee(false);
      setIsOwner(false);
      setOwnerId(null);
      setPermissions([]);
      setEmployeeName(null);

      try {
        // Usar a função RPC segura para obter contexto do funcionário
        console.log('[EmployeeContext] Chamando RPC get_employee_context...');
        const { data, error } = await supabase
          .rpc('get_employee_context', { _user_id: user.id });

        console.log('[EmployeeContext] Resultado da RPC:', { data, error });

        if (error) {
          console.error('[EmployeeContext] Erro ao chamar get_employee_context:', error);
          // Em caso de erro, deixar em estado indeterminado (bloqueado)
          setLoading(false);
          return;
        }

        // A RPC retorna um array, pegamos o primeiro resultado
        const result = Array.isArray(data) ? data[0] : data;
        
        if (!result) {
          console.log('[EmployeeContext] RPC retornou vazio - tratando como DONO');
          setIsEmployee(false);
          setIsOwner(true);
          setLoading(false);
          return;
        }

        const ctx = result as EmployeeContextResult;
        console.log('[EmployeeContext] Contexto recebido:', ctx);

        if (ctx.is_employee) {
          // Usuário É um funcionário
          console.log('[EmployeeContext] ✓ FUNCIONÁRIO DETECTADO:', ctx.employee_name);
          setIsEmployee(true);
          setIsOwner(false);
          setOwnerId(ctx.owner_id);
          setEmployeeName(ctx.employee_name);
          
          if (!ctx.is_active) {
            console.warn('[EmployeeContext] Funcionário INATIVO - sem permissões');
            setPermissions([]);
          } else {
            const permList = (ctx.permissions || []) as EmployeePermission[];
            console.log('[EmployeeContext] Permissões do funcionário:', permList);
            setPermissions(permList);
          }
        } else {
          // Não é funcionário - é DONO
          console.log('[EmployeeContext] ✓ NÃO é funcionário - tratando como DONO');
          setIsEmployee(false);
          setIsOwner(true);
          setOwnerId(null);
          setEmployeeName(null);
          setPermissions([]);
        }
      } catch (err) {
        console.error('[EmployeeContext] Erro crítico:', err);
        // Em erro crítico, deixar bloqueado por segurança
        setIsEmployee(false);
        setIsOwner(false);
      } finally {
        console.log('[EmployeeContext] Verificação concluída');
        setLoading(false);
      }
    }

    checkEmployeeStatus();
  }, [user?.id]);

  // ID efetivo para queries - usa ID do dono se for funcionário
  const effectiveUserId = isEmployee ? ownerId : user?.id ?? null;

  // Verifica se tem permissão específica
  const hasPermission = useCallback((permission: EmployeePermission): boolean => {
    // Durante carregamento, SEMPRE negar
    if (loading) return false;
    
    // Dono CONFIRMADO tem todas as permissões
    if (isOwner && !isEmployee) return true;
    
    // Funcionário: verificar permissão específica
    if (isEmployee) {
      const has = permissions.includes(permission);
      console.log(`[EmployeeContext] hasPermission(${permission}):`, has);
      return has;
    }
    
    // Estado indeterminado: NEGAR por segurança
    return false;
  }, [loading, isOwner, isEmployee, permissions]);

  // Log do estado atual para debug
  useEffect(() => {
    if (!loading) {
      console.log('[EmployeeContext] Estado final:', {
        isEmployee,
        isOwner,
        ownerId,
        employeeName,
        permissions,
        effectiveUserId
      });
    }
  }, [loading, isEmployee, isOwner, ownerId, employeeName, permissions, effectiveUserId]);

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
