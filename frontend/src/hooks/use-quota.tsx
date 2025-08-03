import { getQuotaUsage } from "@/lib/api/quota";
import { useQuery } from "@tanstack/react-query";

export const quotaKeys = {
  all: ["quota"] as const,
};

export function useQuota() {
  return useQuery({
    queryKey: quotaKeys.all,
    queryFn: () => getQuotaUsage(),
    staleTime: 0,
  });
}
