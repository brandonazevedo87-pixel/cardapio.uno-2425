import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export const useOfferings = () =>
  useQuery(orpc.account.offerings.queryOptions({ staleTime: 60000 }));
export const useProfile = () =>
  useQuery(orpc.account.profile.queryOptions({ retry: false, staleTime: 0 }));
export const useAdmin = () =>
  useQuery(orpc.admin.overview.queryOptions({ retry: false, refetchInterval: 30000 }));
export const useMerchant = () =>
  useQuery(orpc.catalog.overview.queryOptions({ retry: false, refetchInterval: 10000 }));
export const useMenu = (slug: string) =>
  useQuery(orpc.orders.menu.queryOptions({ input: { slug }, retry: false }));
export const useTracking = (token: string) =>
  useQuery(
    orpc.orders.track.queryOptions({ input: { token }, retry: false, refetchInterval: 10000 }),
  );
export function useOperation<T, R>(fn: (input: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}
