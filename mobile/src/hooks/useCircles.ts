import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { circlesApi } from '../lib/api';

export function useCircles() {
  return useQuery({
    queryKey: ['circles'],
    queryFn: async () => {
      const { data } = await circlesApi.list();
      return data;
    },
  });
}

export function useCreateCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: circlesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['circles'] }),
  });
}
