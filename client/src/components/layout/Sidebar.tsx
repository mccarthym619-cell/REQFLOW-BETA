import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, FileText, CheckSquare, Bell, Settings, Users, ClipboardList, ScrollText, HelpCircle, Globe, Building2, Shield } from 'lucide-react';
import { HelpGuide } from '../shared/HelpGuide';
import { hasPermission } from '@req-tracker/shared';
import type { UserRole } from '@req-tracker/shared';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/requests', icon: FileText, label: 'My Requests' },
  { to: '/approvals', icon: CheckSquare, label: 'Pending Approvals' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/settings', icon: Globe, label: 'Settings' },
];

const adminItems = [
  { to: '/admin/templates', icon: ClipboardList, label: 'Templates', permission: 'templates.manage' as const },
  { to: '/admin/users', icon: Users, label: 'Users', permission: 'users.manage' as const },
  { to: '/admin/departments', icon: Building2, label: 'Departments', permission: 'departments.manage' as const },
  { to: '/admin/permissions', icon: Shield, label: 'Permissions', permission: 'permissions.manage' as const },
  { to: '/admin/audit', icon: ScrollText, label: 'Audit Log', permission: 'audit.view' as const },
  { to: '/admin/settings', icon: Settings, label: 'Settings', permission: 'settings.manage' as const },
];

export function Sidebar() {
  const { currentUser } = useAuth();
  const role = (currentUser?.role ?? 'standard') as UserRole;
  const [showHelp, setShowHelp] = useState(false);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full dark:bg-gray-900 dark:border-gray-700">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ReqFlow</h1>
        <p className="text-xs text-gray-500 mt-0.5">Requisition Portal</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(item => {
          if ('permission' in item && !hasPermission(role, (item as any).permission)) return null;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}

        {adminItems.some(item => hasPermission(role, item.permission)) && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map(item => {
              if (!hasPermission(role, item.permission)) return null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      <div className="px-3 pb-2">
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          <HelpCircle className="w-5 h-5" />
          Help Guide
        </button>
      </div>

      {showHelp && <HelpGuide onClose={() => setShowHelp(false)} />}

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium dark:bg-blue-900/40 dark:text-blue-400">
            {currentUser?.display_name?.charAt(0) ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">{currentUser?.display_name}</p>
            <p className="text-xs text-gray-500 capitalize">{currentUser?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
