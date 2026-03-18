import { useQuery } from '@tanstack/react-query';
import { salahApi } from '../lib/api';

export function usePrayers() {
  return useQuery({
    queryKey: ['salah'],
    queryFn: async () => {
      const { data } = await salahApi.today();
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
