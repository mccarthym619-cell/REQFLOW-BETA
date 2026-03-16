import { useSession } from '../context/SessionContext';

export function useTimezone(): string {
  const { user } = useSession();
  return user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
