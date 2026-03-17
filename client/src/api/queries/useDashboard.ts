import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { DashboardSummary, DashboardPendingItem, DashboardActivityItem, DashboardAwaitingItem } from '@req-tracker/shared';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async (): Promise<DashboardSummary> => {
      const res = await api.get('/dashboard/summary');
      return res.data.data;
    },
  });
}

export function useDashboardPending() {
  return useQuery({
    queryKey: ['dashboard', 'pending'],
    queryFn: async (): Promise<DashboardPendingItem[]> => {
      const res = await api.get('/dashboard/my-pending');
      return res.data.data;
    },
  });
}

export function useDashboardActivity(limit = 15) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: async (): Promise<DashboardActivityItem[]> => {
      const res = await api.get(`/dashboard/recent-activity?limit=${limit}`);
      return res.data.data;
    },
  });
}

export function useDashboardAwaitingCompletion(enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'awaiting-completion'],
    queryFn: async (): Promise<DashboardAwaitingItem[]> => {
      const res = await api.get('/dashboard/awaiting-completion');
      return res.data.data;
    },
    enabled,
  });
}
