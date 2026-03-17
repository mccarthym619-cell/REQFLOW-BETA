import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { showError, showSuccess } from '../../utils/toast';

function useRequestMutation(requestId: string | undefined) {
  const queryClient = useQueryClient();
  return {
    queryClient,
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  };
}

export function useCancelRequest(requestId: string | undefined) {
  const { invalidate } = useRequestMutation(requestId);
  return useMutation({
    mutationFn: async () => {
      await api.post(`/requests/${requestId}/cancel`);
    },
    onSuccess: () => {
      invalidate();
      showSuccess('Request cancelled');
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Cancel failed');
    },
  });
}

export function useCompleteRequest(requestId: string | undefined) {
  const { invalidate } = useRequestMutation(requestId);
  return useMutation({
    mutationFn: async (trackingComment?: string) => {
      await api.post(`/requests/${requestId}/complete`, { tracking_comment: trackingComment || undefined });
    },
    onSuccess: () => {
      invalidate();
      showSuccess('Purchase marked as complete');
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Action failed');
    },
  });
}

export function useReviewRequest(requestId: string | undefined) {
  const { invalidate } = useRequestMutation(requestId);
  return useMutation({
    mutationFn: async (notes?: string) => {
      await api.post(`/requests/${requestId}/review`, { notes: notes || undefined });
    },
    onSuccess: () => {
      invalidate();
      showSuccess('Request marked as reviewed');
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Action failed');
    },
  });
}

export function useReviewReturnRequest(requestId: string | undefined) {
  const { invalidate } = useRequestMutation(requestId);
  return useMutation({
    mutationFn: async (notes: string) => {
      await api.post(`/requests/${requestId}/review-return`, { notes });
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Action failed');
    },
  });
}

export function useContractAward(requestId: string | undefined) {
  const { invalidate } = useRequestMutation(requestId);
  return useMutation({
    mutationFn: async ({ comment, documentUrl }: { comment?: string; documentUrl?: string }) => {
      await api.post(`/requests/${requestId}/contract-awarded`, {
        comment: comment || undefined,
        document_url: documentUrl || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      showSuccess('Contract awarded');
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Action failed');
    },
  });
}

export function useAddComment(requestId: string | undefined) {
  const { invalidate } = useRequestMutation(requestId);
  return useMutation({
    mutationFn: async (body: string) => {
      await api.post(`/requests/${requestId}/comments`, { body });
    },
    onSuccess: () => {
      invalidate();
    },
    onError: () => {
      showError('Failed to add comment');
    },
  });
}

export function useNudge(requestId: string | undefined) {
  const { invalidate } = useRequestMutation(requestId);
  return useMutation({
    mutationFn: async () => {
      await api.post(`/requests/${requestId}/nudge`);
    },
    onSuccess: () => {
      invalidate();
      showSuccess('Nudge sent successfully');
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Nudge failed');
    },
  });
}

export function useAcknowledgeNudge(requestId: string | undefined) {
  const { invalidate } = useRequestMutation(requestId);
  return useMutation({
    mutationFn: async ({ nudgeId, comment }: { nudgeId: number; comment: string }) => {
      await api.post(`/requests/${requestId}/nudge/${nudgeId}/acknowledge`, { comment });
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Acknowledge failed');
    },
  });
}
