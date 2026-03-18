import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useImpersonationStore } from '../store/impersonationStore';
import { adminApi } from '../lib/api';

export function useImpersonation() {
  const { isImpersonating, targetUserName, targetUserId, startImpersonation, stopImpersonation } =
    useImpersonationStore();
  const qc = useQueryClient();

  const impersonate = useCallback(
    async (userId: string, userName: string) => {
      const { data } = await adminApi.impersonate(userId);
      await startImpersonation(userId, userName, data.accessToken, data.refreshToken);
      qc.invalidateQueries();
    },
    [startImpersonation, qc]
  );

  const stop = useCallback(async () => {
    await stopImpersonation();
    qc.invalidateQueries();
  }, [stopImpersonation, qc]);

  return { isImpersonating, targetUserName, targetUserId, impersonate, stop };
}
