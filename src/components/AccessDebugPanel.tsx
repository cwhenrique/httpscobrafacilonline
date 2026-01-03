import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function AccessDebugPanel() {
  const { user } = useAuth();
  const { 
    isEmployee, 
    isOwner, 
    loading, 
    permissions, 
    ownerId, 
    effectiveUserId,
    employeeName,
    refreshContext
  } = useEmployeeContext();
  const location = useLocation();

  // Só mostrar se ?debugAccess=1 estiver na URL
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.get('debugAccess') !== '1') {
    return null;
  }

  const handleRefresh = async () => {
    console.log('[AccessDebugPanel] Forçando refresh do contexto...');
    await refreshContext();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-black text-white text-xs p-3 font-mono border-b-2 border-yellow-500">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-yellow-400 font-bold">🔧 DEBUG PANEL</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleRefresh}
            className="h-6 text-xs bg-transparent border-white/30 text-white hover:bg-white/10"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <span className="text-gray-400">User:</span>{' '}
            <span>{user?.email || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-400">ID:</span>{' '}
            <span>{user?.id?.slice(0, 8) || 'N/A'}...</span>
          </div>
          <div>
            <span className="text-gray-400">Loading:</span>{' '}
            <span className={loading ? 'text-orange-400' : 'text-green-400'}>
              {loading ? 'TRUE' : 'FALSE'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Path:</span>{' '}
            <span>{location.pathname}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 pt-2 border-t border-white/20">
          <div>
            <span className="text-gray-400">isEmployee:</span>{' '}
            <span className={isEmployee ? 'text-yellow-400 font-bold' : 'text-gray-500'}>
              {isEmployee ? '✓ TRUE' : 'FALSE'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">isOwner:</span>{' '}
            <span className={isOwner ? 'text-green-400 font-bold' : 'text-gray-500'}>
              {isOwner ? '✓ TRUE' : 'FALSE'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">employeeName:</span>{' '}
            <span>{employeeName || '-'}</span>
          </div>
          <div>
            <span className="text-gray-400">ownerId:</span>{' '}
            <span>{ownerId?.slice(0, 8) || '-'}...</span>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-white/20">
          <span className="text-gray-400">Permissões ({permissions.length}):</span>{' '}
          {permissions.length > 0 ? (
            <span className="text-cyan-400">{permissions.join(', ')}</span>
          ) : (
            <span className="text-red-400">
              {isOwner ? '(DONO - acesso total)' : 'NENHUMA'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
