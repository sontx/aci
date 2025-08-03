"use client";

import { useQuery } from "@tanstack/react-query";
import { OrgMemberInfoClass, UserClass } from "@propelauth/react";
import { useCallback } from "react";

export const orgKeys = {
  all: (userId: string) => ["orgs", userId] as const,
};

export const useOrgs = (
  userClass: UserClass,
  refreshAuthInfo: () => Promise<void>,
) => {
  const fetchOrgs = useCallback(async (): Promise<OrgMemberInfoClass[]> => {
    let retrievedOrgs = userClass.getOrgs();
    let attempts = 0;
    const maxAttempts = 5;

    // Wait for the default Personal Org to be created
    while (retrievedOrgs.length === 0 && attempts < maxAttempts) {
      await refreshAuthInfo();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retrievedOrgs = userClass.getOrgs();
      attempts++;
      console.log("retrievedOrgs", retrievedOrgs, attempts);
    }

    return retrievedOrgs;
  }, [userClass, refreshAuthInfo]);

  return useQuery({
    queryKey: orgKeys.all(userClass.userId),
    queryFn: fetchOrgs,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
