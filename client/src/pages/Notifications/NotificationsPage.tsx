import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="btn-secondary btn-sm">Mark all as read</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState title="No notifications" description="You'll see updates here when there's activity on your requests" />
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => {
                markAsRead(n.id);
                if (n.action_url) navigate(n.action_url);
              }}
              className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-start gap-3 ${
                !n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
              }`}
            >
              <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${!n.is_read ? 'text-blue-500' : 'text-gray-400'}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
