import { useMetaInfo } from "@/components/context/metainfo";
import { getAppFunctions } from "@/lib/api/app";
import { getApiKey } from "@/lib/api/util";
import { useQuery } from "@tanstack/react-query";
import { getAppFunction } from "@/lib/api/appfunction";

export const appFunctionKeys = {
  all: ["appFunctions"] as const,
  byApp: (appName: string, raw?: boolean) =>
    [...appFunctionKeys.all, raw ? "raw" : "basic", appName] as const,
  byFuncName: (name: string) => ["function", name] as const,
};

export function useAppFunctions(appName?: string, raw?: boolean) {
  const { activeProject } = useMetaInfo();
  const apiKey = getApiKey(activeProject);

  return useQuery({
    queryKey: appFunctionKeys.byApp(appName || "", raw),
    queryFn: () => getAppFunctions(appName!, !!raw, apiKey),
    enabled: !!appName, // Only run query if appName is provided
  });
}

export function useAppFunction(name?: string) {
  const { activeProject } = useMetaInfo();
  const apiKey = getApiKey(activeProject);

  return useQuery({
    queryKey: appFunctionKeys.byFuncName(name!),
    queryFn: () => getAppFunction(name!, apiKey),
    enabled: !!name,
  });
}
