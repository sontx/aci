"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAPIKeys,
  getAPIKeyByName,
  createAPIKey,
  updateAPIKey,
  deleteAPIKey,
} from "@/lib/api/apikey";
import { APIKey, APIKeyDetail, APIKeyCreate, APIKeyUpdate, APIKeySearchParams } from "@/lib/types/apikey";
import { toast } from "sonner";

export const apiKeyKeys = {
  all: () => ["api-keys"] as const,
  lists: () => [...apiKeyKeys.all(), "list"] as const,
  list: (params?: APIKeySearchParams) => [...apiKeyKeys.lists(), params] as const,
  details: () => [...apiKeyKeys.all(), "detail"] as const,
  detail: (name: string) => [...apiKeyKeys.details(), name] as const,
};

export const useAPIKeys = (params?: APIKeySearchParams) => {
  return useQuery({
    queryKey: apiKeyKeys.list(params),
    queryFn: () => getAPIKeys(params),
    retry: 2,
    retryDelay: 1000,
  });
};

export const useAPIKey = (apiKeyName: string) => {
  return useQuery({
    queryKey: apiKeyKeys.detail(apiKeyName),
    queryFn: () => getAPIKeyByName(apiKeyName),
    enabled: !!apiKeyName,
    retry: 2,
    retryDelay: 1000,
  });
};

export const useCreateAPIKey = () => {
  const queryClient = useQueryClient();
  
  return useMutation<APIKeyDetail, Error, APIKeyCreate>({
    mutationFn: (data) => createAPIKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: apiKeyKeys.lists(),
      });
      toast.success("API key created successfully");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create API key");
      }
    },
  });
};

type UpdateAPIKeyParams = {
  name: string;
  data: APIKeyUpdate;
};

export const useUpdateAPIKey = () => {
  const queryClient = useQueryClient();
  
  return useMutation<APIKey, Error, UpdateAPIKeyParams>({
    mutationFn: ({ name, data }) => updateAPIKey(name, data),
    onSuccess: (updatedAPIKey) => {
      queryClient.invalidateQueries({
        queryKey: apiKeyKeys.lists(),
      });
      queryClient.setQueryData(
        apiKeyKeys.detail(updatedAPIKey.name),
        updatedAPIKey
      );
      toast.success("API key updated successfully");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to update API key");
      }
    },
  });
};

export const useDeleteAPIKey = () => {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, string>({
    mutationFn: (apiKeyName) => deleteAPIKey(apiKeyName),
    onSuccess: (_, deletedName) => {
      queryClient.invalidateQueries({
        queryKey: apiKeyKeys.lists(),
      });
      queryClient.removeQueries({
        queryKey: apiKeyKeys.detail(deletedName),
      });
      toast.success("API key deleted successfully");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete API key");
      }
    },
  });
};
