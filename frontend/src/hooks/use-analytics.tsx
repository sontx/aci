"use client";

import { useQueries, UseQueryResult } from "@tanstack/react-query";
import { useMetaInfo } from "@/components/context/metainfo";
import {
  getAppTimeSeriesData,
  getFunctionTimeSeriesData,
} from "@/lib/api/analytics";
import { TimeSeriesDatapoint } from "@/lib/types/analytics";

export const analyticsKeys = {
  // Since it is not a data source of an interface, in order to unify the usage of all APIs, use base
  base: (projectId: string) => ["analytics", projectId] as const,
  appTimeSeries: (projectId: string) =>
    [...analyticsKeys.base(projectId), "app-time-series"] as const,
  functionTimeSeries: (projectId: string) =>
    [...analyticsKeys.base(projectId), "function-time-series"] as const,
};

export function useAnalyticsQueries() {
  const { activeProject } = useMetaInfo();

  const results = useQueries({
    queries: [
      {
        queryKey: analyticsKeys.appTimeSeries(activeProject.id),
        queryFn: () => getAppTimeSeriesData(),
        enabled: !!activeProject,
        staleTime: 0,
      },
      {
        queryKey: analyticsKeys.functionTimeSeries(activeProject.id),
        queryFn: () => getFunctionTimeSeriesData(),
        enabled: !!activeProject,
        staleTime: 0,
      },
    ],
  });

  const [appTimeSeriesQuery, functionTimeSeriesQuery] = results as [
    UseQueryResult<TimeSeriesDatapoint[], Error>,
    UseQueryResult<TimeSeriesDatapoint[], Error>,
  ];

  return {
    appTimeSeriesData: appTimeSeriesQuery.data ?? [],
    functionTimeSeriesData: functionTimeSeriesQuery.data ?? [],
    isLoading: results.some((query) => query.isLoading),
    error: results.find((query) => query.error)?.error || null,
    refetchAll: () => Promise.all(results.map((query) => query.refetch())),
  };
}
