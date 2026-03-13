import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, Moon, Sun, LogOut } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useSession } from '../../context/SessionContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { formatDistanceToNow } from 'date-fns';

export function TopBar() {
  const navigate = useNavigate();
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useNotifications();
  const { logout } = useSession();
  const { currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/requests?search=${encodeURIComponent(search.trim())}`);
      setSearch('');
    }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 dark:bg-gray-900 dark:border-gray-700">
      <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search requests..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border-0 bg-transparent text-sm focus:outline-none w-full placeholder:text-gray-400 dark:text-gray-100"
        />
      </form>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-800"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark'
            ? <Sun className="w-5 h-5 text-gray-300" />
            : <Moon className="w-5 h-5 text-gray-600" />}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-800"
          >
            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl border border-gray-200 shadow-lg z-50 dark:bg-gray-900 dark:border-gray-700">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 text-center">No notifications</p>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markAsRead(n.id);
                        if (n.action_url) navigate(n.action_url);
                        setShowNotifications(false);
                      }}
                      className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors dark:border-gray-800 dark:hover:bg-gray-800 ${
                        !n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 dark:text-gray-400">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => { navigate('/notifications'); setShowNotifications(false); }}
                className="w-full p-3 text-center text-sm text-blue-600 hover:bg-gray-50 border-t border-gray-100 rounded-b-xl dark:hover:bg-gray-800 dark:border-gray-700 dark:text-blue-400"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>

        {currentUser && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-700 dark:text-gray-300">{currentUser.display_name}</span>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-800"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
