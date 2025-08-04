import {
  AppSearch,
  getAllApps,
  getAllCategories,
  searchApps,
} from "@/lib/api/app";
import { useQuery } from "@tanstack/react-query";
import { App } from "@/lib/types/app";
import { useMemo } from "react";

export const appKeys = {
  all: ["apps"] as const,
  allCategories: ["categories"] as const,
  search: (params: AppSearch) => ["apps", "search", params] as const,
};

export function useApps(appNames?: string[]) {
  return useQuery({
    queryKey: appKeys.all,
    queryFn: () => getAllApps(),
    select: (data) => {
      if (!appNames || appNames.length === 0) {
        return data;
      }
      return data.filter((app) => appNames.includes(app.name));
    },
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
  const query = useApps([appName]);
  return {
    app: query.data?.[0],
    ...query,
  };
}

export function useAppsMap() {
  const { data: apps = [] } = useApps();
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
