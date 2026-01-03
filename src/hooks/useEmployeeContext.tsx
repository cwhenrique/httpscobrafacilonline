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

      // Resetar para estado de loading (bloqueado por padrão)
      setLoading(true);
      setIsEmployee(false);
      setIsOwner(false);
      setOwnerId(null);
      setPermissions([]);
      setEmployeeName(null);

      try {
        // Verificar se o usuário é um funcionário
        console.log('[EmployeeContext] Buscando registro de funcionário...');
        const { data: employeeData, error } = await supabase
          .from('employees')
          .select('id, owner_id, name, is_active')
          .eq('employee_user_id', user.id)
          .maybeSingle();

        console.log('[EmployeeContext] Resultado da busca:', { employeeData, error });

        if (error) {
          console.error('[EmployeeContext] Erro ao verificar status de funcionário:', error);
          // IMPORTANTE: Em caso de erro, NÃO assumir nada
          // Deixar como estado "indeterminado" (isEmployee=false, isOwner=false)
          // Isso vai bloquear acesso até conseguir verificar corretamente
          setLoading(false);
          return;
        }

        if (employeeData) {
          // Usuário é um funcionário
          console.log('[EmployeeContext] FUNCIONÁRIO DETECTADO:', employeeData.name);
          setIsEmployee(true);
          setIsOwner(false);
          setOwnerId(employeeData.owner_id);
          setEmployeeName(employeeData.name);
          
          if (!employeeData.is_active) {
            // Funcionário inativo - sem permissões
            console.warn('[EmployeeContext] Funcionário inativo - sem permissões');
            setPermissions([]);
          } else {
            // Funcionário ativo - buscar permissões
            console.log('[EmployeeContext] Buscando permissões para employee_id:', employeeData.id);
            const { data: permissionsData, error: permError } = await supabase
              .from('employee_permissions')
              .select('permission')
              .eq('employee_id', employeeData.id);

            console.log('[EmployeeContext] Permissões encontradas:', { permissionsData, permError });

            if (permError) {
              console.error('[EmployeeContext] Erro ao buscar permissões:', permError);
              // Erro ao buscar permissões = sem permissões (seguro)
              setPermissions([]);
            } else {
              const permList = (permissionsData || []).map(p => p.permission as EmployeePermission);
              console.log('[EmployeeContext] Lista de permissões:', permList);
              setPermissions(permList);
            }
          }
        } else {
          // Não é funcionário - é dono
          console.log('[EmployeeContext] NÃO é funcionário - tratando como DONO');
          setIsEmployee(false);
          setIsOwner(true);
          setOwnerId(null);
          setEmployeeName(null);
          setPermissions([]);
        }
      } catch (err) {
        console.error('[EmployeeContext] Erro crítico ao verificar funcionário:', err);
        // IMPORTANTE: Em erro crítico, NÃO assumir que é dono
        // Deixar bloqueado por segurança
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

  // Verifica se tem permissão específica - SEGURO: só libera se confirmado
  const hasPermission = useCallback((permission: EmployeePermission): boolean => {
    // Durante carregamento, SEMPRE negar
    if (loading) return false;
    
    // Dono CONFIRMADO tem todas as permissões
    if (isOwner && !isEmployee) return true;
    
    // Funcionário: verificar permissão específica
    if (isEmployee) {
      return permissions.includes(permission);
    }
    
    // Estado indeterminado (não é dono nem funcionário): NEGAR por segurança
    // Isso acontece quando há erro de conexão/RLS/etc
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
