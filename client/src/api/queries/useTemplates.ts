import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { RequestTemplate, CustomFieldDefinition } from '@req-tracker/shared';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async (): Promise<RequestTemplate[]> => {
      const res = await api.get('/templates');
      return res.data.data;
    },
  });
}

export function useTemplate(templateId: number | null) {
  return useQuery({
    queryKey: ['template', templateId],
    queryFn: async (): Promise<RequestTemplate & { fields: CustomFieldDefinition[] }> => {
      const res = await api.get(`/templates/${templateId}`);
      return res.data.data;
    },
    enabled: !!templateId,
  });
}
