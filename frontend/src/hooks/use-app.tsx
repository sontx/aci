import {
  AppSearch,
  getAllApps,
  getAllCategories,
  getApp,
  searchApps,
} from "@/lib/api/app";
import { useQuery } from "@tanstack/react-query";
import { App } from "@/lib/types/app";
import { useMemo } from "react";

export const appKeys = {
  queryApps: (appNames?: string[]) =>
    appNames?.length ? ["apps", ...appNames.sort()] : (["apps"] as const),
  allCategories: ["categories"] as const,
  search: (params: AppSearch) => ["apps", "search", params] as const,
  queryApp: (appName: string) => ["app", appName],
};

export function useApps(appNames?: string[]) {
  return useQuery({
    queryKey: appKeys.queryApps(appNames),
    queryFn: () => getAllApps(appNames),
    enabled: !appNames || appNames.length > 0,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: appKeys.allCategories,
    queryFn: () => getAllCategories(),
  });
}

export function useSearchApps(params: AppSearch) {
  return useQuery({
    queryKey: appKeys.search(params),
    queryFn: () => searchApps(params),
  });
}

export function useApp(appName: string) {
  return useQuery({
    queryKey: appKeys.queryApp(appName),
    queryFn: () => getApp(appName),
    enabled: !!appName,
  });
}

export function useAppsMap(appNames?: string[]) {
  const { data: apps = [] } = useApps(appNames);
  return useMemo(
    () =>
      apps.reduce(
        (acc, app) => {
          acc[app.name] = app;
          return acc;
        },
        {} as Record<string, App>,
      ),
    [apps],
  );
}
