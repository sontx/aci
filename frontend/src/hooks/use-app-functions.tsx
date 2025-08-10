import { getAppFunctions } from "@/lib/api/app";
import { useMutation, useQuery } from "@tanstack/react-query";
import { executeFunction, getAppFunction } from "@/lib/api/appfunction";
import { toast } from "sonner";
import { FunctionExecutionResult } from "@/lib/types/appfunction";

export const appFunctionKeys = {
  all: ["appFunctions"] as const,
  byApp: (appName: string) => [...appFunctionKeys.all, appName] as const,
  byFuncName: (name: string, format?: string) =>
    ["function", name, format || "prettier"] as const,
};

export function useAppFunctions(appName?: string) {
  return useQuery({
    queryKey: appFunctionKeys.byApp(appName || ""),
    queryFn: () => getAppFunctions(appName!),
    enabled: !!appName, // Only run query if appName is provided
  });
}

export function useAppFunction(name?: string, format?: string) {
  return useQuery({
    queryKey: appFunctionKeys.byFuncName(name!, format),
    queryFn: () => getAppFunction(name!, format),
    enabled: !!name,
  });
}

interface ExecuteAppFunctionParams {
  functionName: string;
  parameters: Record<string, unknown>;
  // Default is "default" if not specified
  linkedAccountOwnerId?: string;
}

export function useExecuteAppFunction() {
  return useMutation<FunctionExecutionResult, Error, ExecuteAppFunctionParams>({
    mutationFn: ({
      functionName,
      parameters,
      linkedAccountOwnerId,
    }: ExecuteAppFunctionParams) =>
      executeFunction(functionName, {
        function_input: parameters,
        linked_account_owner_id: linkedAccountOwnerId,
      }),
    onError: (error: Error) => {
      console.error("Create AppConfig failed:", error);
      toast.error("Failed to create app configuration");
    },
  });
}
