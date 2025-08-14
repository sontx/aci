"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUserApp,
  createUserAppFunctions,
  deleteUserApp,
  deleteUserAppFunction,
  getAllFunctionTags,
  getUserApp,
  getUserAppFunction,
  getUserAppFunctions,
  searchUserApps,
  updateUserApp,
  updateUserAppFunction,
} from "@/lib/api/userapp";
import { useMetaInfo } from "@/components/context/metainfo";
import {
  BasicFunctionDefinition,
  PagedUserApps,
  UserAppDetails,
  UserAppSearchParams,
  UserAppUpsert,
} from "@/lib/types/userapp";
import { toast } from "sonner";
import {
  AppFunction,
  FunctionUpdate,
  FunctionUpsert,
} from "@/lib/types/appfunction";

export const userAppKeys = {
  all: (projectId: string) => [projectId, "userapps"] as const,
  search: (projectId: string, params?: UserAppSearchParams) =>
    [projectId, "userapps", "search", params] as const,
  detail: (projectId: string, appName: string) =>
    [projectId, "userapps", appName] as const,
  functions: (projectId: string, appName: string) =>
    [projectId, "userapps", appName, "functions"] as const,
  functionDetail: (projectId: string, appName: string, functionName: string) =>
    [projectId, "userapps", appName, "functions", functionName] as const,
  functionTags: (projectId: string) =>
    [projectId, "userapps", "function-tags"] as const,
};

export const useSearchUserApps = (params?: UserAppSearchParams) => {
  const { activeProject } = useMetaInfo();

  return useQuery<PagedUserApps, Error>({
    queryKey: userAppKeys.search(activeProject.id, params),
    queryFn: () => searchUserApps(params),
  });
};

export const useUserApp = (appName?: string) => {
  const { activeProject } = useMetaInfo();

  return useQuery<UserAppDetails, Error>({
    queryKey: userAppKeys.detail(activeProject.id, appName || ""),
    queryFn: () => getUserApp(appName!),
    enabled: !!appName,
  });
};

export const useUserAppFunctions = (appName?: string) => {
  const { activeProject } = useMetaInfo();

  return useQuery<AppFunction[], Error>({
    queryKey: userAppKeys.functions(activeProject.id, appName || ""),
    queryFn: () => getUserAppFunctions(appName!),
    enabled: !!appName,
  });
};

export const useCreateUserApp = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<UserAppDetails, Error, UserAppUpsert>({
    mutationFn: (data) => createUserApp(data),
    onSuccess: (newUserApp) => {
      queryClient.setQueryData<UserAppDetails[]>(
        userAppKeys.all(activeProject.id),
        (old = []) => [...old, newUserApp],
      );
      queryClient.invalidateQueries({
        queryKey: userAppKeys.all(activeProject.id),
      });
      queryClient.invalidateQueries({
        queryKey: [activeProject.id, "userapps", "search"],
      });
      toast.success("User app created successfully");
    },
    onError: (error) => {
      console.error("Create user app failed:", error);
      toast.error("Failed to create user app");
    },
  });
};

type UpdateUserAppParams = {
  appName: string;
  data: UserAppUpsert;
};

export const useUpdateUserApp = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<UserAppDetails, Error, UpdateUserAppParams>({
    mutationFn: (params) => updateUserApp(params.appName, params.data),
    onSuccess: (updatedUserApp, variables) => {
      queryClient.setQueryData<UserAppDetails[]>(
        userAppKeys.all(activeProject.id),
        (old = []) =>
          old.map((app) =>
            app.name === variables.appName ? updatedUserApp : app,
          ),
      );
      queryClient.invalidateQueries({
        queryKey: userAppKeys.all(activeProject.id),
      });
      queryClient.invalidateQueries({
        queryKey: [activeProject.id, "userapps", "search"],
      });
      queryClient.invalidateQueries({
        queryKey: userAppKeys.detail(activeProject.id, variables.appName),
      });
      toast.success("User app updated successfully");
    },
    onError: (error) => {
      console.error("Update user app failed:", error);
      toast.error("Failed to update user app");
    },
  });
};

export const useDeleteUserApp = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<void, Error, string>({
    mutationFn: (appName) => deleteUserApp(appName),
    onSuccess: (_, appName) => {
      queryClient.setQueryData<UserAppDetails[]>(
        userAppKeys.all(activeProject.id),
        (old = []) => old.filter((app) => app.name !== appName),
      );
      queryClient.invalidateQueries({
        queryKey: userAppKeys.all(activeProject.id),
      });
      queryClient.invalidateQueries({
        queryKey: [activeProject.id, "userapps", "search"],
      });
      queryClient.removeQueries({
        queryKey: userAppKeys.detail(activeProject.id, appName),
      });
      queryClient.removeQueries({
        queryKey: userAppKeys.functions(activeProject.id, appName),
      });
      toast.success("User app deleted successfully");
    },
    onError: (error) => {
      console.error("Delete user app failed:", error);
      toast.error("Failed to delete user app");
    },
  });
};

interface CreateUserAppFunctionsParams {
  functionDefinitions: FunctionUpsert[];
  overrideExisting?: boolean;
  removePrevious?: boolean;
}

export function useCreateUserAppFunctions(appName: string) {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<
    BasicFunctionDefinition[],
    Error,
    CreateUserAppFunctionsParams
  >({
    mutationFn: (functionData) => {
      return createUserAppFunctions(
        appName,
        functionData.functionDefinitions,
        functionData.overrideExisting,
        functionData.removePrevious,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: userAppKeys.functions(activeProject.id, appName),
      });
      toast.success("Functions created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create functions: ${error.message}`);
    },
  });
}

export function useUserAppFunction(appName: string, functionName: string) {
  const { activeProject } = useMetaInfo();

  return useQuery<AppFunction, Error>({
    queryKey: userAppKeys.functionDetail(
      activeProject.id,
      appName || "",
      functionName,
    ),
    queryFn: () => getUserAppFunction(functionName),
    enabled: !!functionName && !!appName,
  });
}

export function useDeleteUserAppFunction(
  appName: string,
  functionName: string,
) {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<void, Error, string>({
    mutationFn: (functionName) => {
      return deleteUserAppFunction(functionName);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: userAppKeys.functions(activeProject.id, appName),
      });
      queryClient.removeQueries({
        queryKey: userAppKeys.functionDetail(
          activeProject.id,
          appName,
          functionName,
        ),
      });
      toast.success("Function deleted successfully");
    },
    onError: (error) => {
      console.error("Delete user app function failed:", error);
      toast.error("Failed to delete user app function");
    },
  });
}

export function useUpdateUserAppFunction(
  appName: string,
  functionName: string,
) {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<void, Error, FunctionUpdate>({
    mutationFn: (functionData) => {
      return updateUserAppFunction(functionName, functionData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: userAppKeys.functionDetail(
          activeProject.id,
          appName,
          functionName,
        ),
      });
      toast.success("Function updated successfully");
    },
    onError: (error) => {
      console.error("Update user app function failed:", error);
      toast.error("Failed to update user app function");
    },
  });
}

export function useGetAllFunctionTags() {
  const { activeProject } = useMetaInfo();

  return useQuery<string[], Error>({
    queryKey: userAppKeys.functionTags(activeProject.id),
    queryFn: () => getAllFunctionTags(),
  });
}
