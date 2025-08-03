import { useMetaInfo } from "@/components/context/metainfo";
import { getAllApps } from "@/lib/api/app";
import { getApiKey } from "@/lib/api/util";
import { useQuery } from "@tanstack/react-query";
import { App } from "@/lib/types/app";
import { useMemo } from "react";

export const appKeys = {
  all: ["apps"] as const,
};

export function useApps(appNames?: string[]) {
  const { activeProject } = useMetaInfo();
  const apiKey = getApiKey(activeProject);

  return useQuery({
    queryKey: appKeys.all,
    queryFn: () => getAllApps(apiKey),
    select: (data) => {
      if (!appNames || appNames.length === 0) {
        return data;
      }
      return data.filter((app) => appNames.includes(app.name));
    },
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
