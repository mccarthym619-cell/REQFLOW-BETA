import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../client';
import type { Request as ReqType } from '@req-tracker/shared';

interface UseRequestsParams {
  status?: string;
  command?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

interface RequestsResponse {
  data: ReqType[];
  meta: { total: number; page: number; per_page: number };
}

export function useRequests({ status, command, search, page = 1, perPage = 20 }: UseRequestsParams) {
  return useQuery({
    queryKey: ['requests', { status, command, search, page, perPage }],
    queryFn: async (): Promise<RequestsResponse> => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (command) params.set('command', command);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('per_page', String(perPage));
      const res = await api.get(`/requests?${params}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
}
