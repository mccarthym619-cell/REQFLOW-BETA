import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { showError } from '../../utils/toast';

interface CreateRequestInput {
  template_id: number;
  title: string;
  priority: string;
  field_values: Record<string, string>;
}

interface UpdateRequestInput {
  title: string;
  priority: string;
  field_values: Record<string, string>;
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, submitAfter }: { data: CreateRequestInput; submitAfter: boolean }) => {
      const res = await api.post('/requests', data);
      const requestId = res.data.data.id;
      if (submitAfter) {
        await api.post(`/requests/${requestId}/submit`);
      }
      return requestId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Failed to save request');
    },
  });
}

export function useUpdateRequest(requestId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, submitAfter }: { data: UpdateRequestInput; submitAfter: boolean }) => {
      await api.put(`/requests/${requestId}`, data);
      if (submitAfter) {
        await api.post(`/requests/${requestId}/submit`);
      }
      return requestId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      showError(err.response?.data?.error?.message || 'Failed to save request');
    },
  });
}
