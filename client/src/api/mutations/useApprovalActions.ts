import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { showError, showSuccess } from '../../utils/toast';

export function useApprovalAction(requestId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, notes }: { action: 'approve' | 'reject' | 'return'; notes?: string }) => {
      await api.post(`/requests/${requestId}/approvals/${action}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Action failed');
    },
  });
}
