import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { useLocation } from 'react-router-dom';

export function AccessDebugPanel() {
  const { user } = useAuth();
  const { 
    isEmployee, 
    isOwner, 
    loading, 
    permissions, 
    effectiveUserId, 
    ownerId, 
    employeeName 
  } = useEmployeeContext();
  const location = useLocation();

  // Só mostra se ?debugAccess=1 estiver na URL
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.get('debugAccess') !== '1') {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-black/90 text-white p-3 text-xs font-mono overflow-x-auto">
      <div className="flex flex-wrap gap-4 items-start">
        <div>
          <span className="text-gray-400">Email:</span>{' '}
          <span className="text-cyan-300">{user?.email || 'null'}</span>
        </div>
        <div>
          <span className="text-gray-400">UserID:</span>{' '}
          <span className="text-cyan-300">{user?.id?.slice(0, 8) || 'null'}...</span>
        </div>
        <div>
          <span className="text-gray-400">Loading:</span>{' '}
          <span className={loading ? 'text-yellow-400' : 'text-green-400'}>
            {loading ? 'true' : 'false'}
          </span>
        </div>
        <div>
          <span className="text-gray-400">isEmployee:</span>{' '}
          <span className={isEmployee ? 'text-amber-400 font-bold' : 'text-gray-500'}>
            {isEmployee ? 'TRUE' : 'false'}
          </span>
        </div>
        <div>
          <span className="text-gray-400">isOwner:</span>{' '}
          <span className={isOwner ? 'text-green-400 font-bold' : 'text-gray-500'}>
            {isOwner ? 'TRUE' : 'false'}
          </span>
        </div>
        <div>
          <span className="text-gray-400">EmployeeName:</span>{' '}
          <span className="text-purple-300">{employeeName || 'null'}</span>
        </div>
        <div>
          <span className="text-gray-400">OwnerID:</span>{' '}
          <span className="text-cyan-300">{ownerId?.slice(0, 8) || 'null'}...</span>
        </div>
        <div>
          <span className="text-gray-400">EffectiveID:</span>{' '}
          <span className="text-cyan-300">{effectiveUserId?.slice(0, 8) || 'null'}...</span>
        </div>
        <div>
          <span className="text-gray-400">Path:</span>{' '}
          <span className="text-pink-300">{location.pathname}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="text-gray-400">Permissions ({permissions.length}):</span>{' '}
        {permissions.length === 0 ? (
          <span className="text-red-400">[NENHUMA]</span>
        ) : (
          permissions.map((p) => (
            <span key={p} className="bg-green-800 text-green-200 px-1 rounded">
              {p}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
