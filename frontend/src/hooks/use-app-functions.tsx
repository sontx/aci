import { useMetaInfo } from "@/components/context/metainfo";
import { getAppFunctions } from "@/lib/api/app";
import { getApiKey } from "@/lib/api/util";
import { useQuery } from "@tanstack/react-query";

export const appFunctionKeys = {
  all: ["appFunctions"] as const,
  byApp: (appName: string) => [...appFunctionKeys.all, appName] as const,
};

export function useAppFunctions(appName?: string) {
  const { activeProject } = useMetaInfo();
  const apiKey = getApiKey(activeProject);

  return useQuery({
    queryKey: appFunctionKeys.byApp(appName || ""),
    queryFn: () => getAppFunctions(appName!, apiKey),
    enabled: !!appName, // Only run query if appName is provided
  });
}
