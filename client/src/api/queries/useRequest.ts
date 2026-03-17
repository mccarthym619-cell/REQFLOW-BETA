import { useQuery, useQueries } from '@tanstack/react-query';
import { api } from '../client';
import type { Request as ReqType, RequestApprovalStep, AuditEntry, Comment, Nudge, CustomFieldDefinition } from '@req-tracker/shared';

export function useRequest(id: string | undefined) {
  const requestQuery = useQuery({
    queryKey: ['request', id],
    queryFn: async (): Promise<ReqType> => {
      const res = await api.get(`/requests/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const templateId = requestQuery.data?.template_id;

  const [stepsQuery, timelineQuery, commentsQuery, nudgesQuery, templateQuery] = useQueries({
    queries: [
      {
        queryKey: ['request', id, 'steps'],
        queryFn: async (): Promise<RequestApprovalStep[]> => {
          const res = await api.get(`/requests/${id}/approval-status`);
          return res.data.data;
        },
        enabled: !!id,
      },
      {
        queryKey: ['request', id, 'timeline'],
        queryFn: async (): Promise<AuditEntry[]> => {
          const res = await api.get(`/requests/${id}/timeline`);
          return res.data.data;
        },
        enabled: !!id,
      },
      {
        queryKey: ['request', id, 'comments'],
        queryFn: async (): Promise<Comment[]> => {
          const res = await api.get(`/requests/${id}/comments`);
          return res.data.data;
        },
        enabled: !!id,
      },
      {
        queryKey: ['request', id, 'nudges'],
        queryFn: async (): Promise<Nudge[]> => {
          const res = await api.get(`/requests/${id}/nudges`);
          return res.data.data;
        },
        enabled: !!id,
      },
      {
        queryKey: ['template', templateId],
        queryFn: async (): Promise<{ fields: CustomFieldDefinition[] }> => {
          const res = await api.get(`/templates/${templateId}`);
          return res.data.data;
        },
        enabled: !!templateId,
      },
    ],
  });

  const isLoading = requestQuery.isLoading || stepsQuery.isLoading || timelineQuery.isLoading || commentsQuery.isLoading || nudgesQuery.isLoading || (!!templateId && templateQuery.isLoading);

  return {
    request: requestQuery.data ?? null,
    steps: stepsQuery.data ?? [],
    timeline: timelineQuery.data ?? [],
    comments: commentsQuery.data ?? [],
    nudges: nudgesQuery.data ?? [],
    template: templateQuery.data ?? null,
    isLoading,
    isError: requestQuery.isError,
  };
}
