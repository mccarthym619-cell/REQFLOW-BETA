import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '@req-tracker/shared';
import type { UserRole } from '@req-tracker/shared';

export function DevToolbar() {
  const { currentUser, allUsers, switchUser } = useAuth();

  if (!currentUser) return null;

  return (
    <div className="bg-gray-900 text-white px-4 py-2 flex items-center gap-3 text-sm overflow-x-auto">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-gray-400">Dev Mode</span>
        <span className="text-yellow-400 font-medium">|</span>
        <span className="text-gray-300">Acting as:</span>
      </div>
      <div className="flex items-center gap-2 flex-nowrap">
        {allUsers.map(user => (
          <button
            key={user.id}
            onClick={() => switchUser(user.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              currentUser.id === user.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {user.display_name}
            <span className="ml-1 opacity-60">({ROLE_LABELS[user.role as UserRole]})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
