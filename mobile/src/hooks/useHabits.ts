import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { habitsApi } from '../lib/api';

export function useHabits() {
  return useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const { data } = await habitsApi.list();
      return data;
    },
  });
}

export function useToggleHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => habitsApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: habitsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  });
}
