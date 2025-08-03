"use client";

import { useQuery } from "@tanstack/react-query";
import { getSubscription } from "@/lib/api/billing";
import { getStorageActiveOrgId } from "@/lib/utils";

export const useSubscription = () => {
  const orgId = getStorageActiveOrgId();
  return useQuery({
    queryKey: ["subscription", orgId],
    queryFn: () => getSubscription(),
  });
};
