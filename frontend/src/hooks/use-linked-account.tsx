"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  getAllLinkedAccounts,
  getLinkedAccount,
  createAPILinkedAccount,
  createNoAuthLinkedAccount,
  deleteLinkedAccount,
  updateLinkedAccount,
  getOauth2LinkURL,
  getLinkedAccountByOwnerId,
} from "@/lib/api/linkedaccount";
import { LinkedAccount } from "@/lib/types/linkedaccount";
import { toast } from "sonner";
import { useMetaInfo } from "@/components/context/metainfo";

export const linkedAccountKeys = {
  all: (projectId: string) => [projectId, "linkedaccounts"] as const,
  detail: (projectId: string, linkedAccountId: string) =>
    [projectId, "linkedaccounts", linkedAccountId] as const,
  getByOwnerId: (
    projectId: string,
    linkedAccountOwnerId: string,
    appName: string,
  ) =>
    [
      projectId,
      "linkedaccounts",
      "getByOwnerId",
      linkedAccountOwnerId,
      appName,
    ] as const,
};

export const useLinkedAccounts = () => {
  const { activeProject } = useMetaInfo();

  return useQuery<LinkedAccount[], Error>({
    queryKey: linkedAccountKeys.all(activeProject.id),
    queryFn: () => getAllLinkedAccounts(),
  });
};

export const useLinkedAccount = (linkedAccountId?: string) => {
  const { activeProject } = useMetaInfo();

  return useQuery<LinkedAccount, Error>({
    queryKey: linkedAccountKeys.detail(activeProject.id, linkedAccountId || ""),
    queryFn: () => getLinkedAccount(linkedAccountId!),
    enabled: !!linkedAccountId,
  });
};

export const useAppLinkedAccounts = (appName?: string | null) => {
  const base = useLinkedAccounts();
  return {
    ...base,
    data: useMemo(
      () =>
        appName && base.data
          ? base.data.filter((a) => a.app_name === appName)
          : [],
      [base.data, appName],
    ),
  };
};

type CreateAPILinkedAccountParams = {
  appName: string;
  linkedAccountOwnerId: string;
  description?: string;
  linkedAPIKey: string;
};

export const useCreateAPILinkedAccount = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<LinkedAccount, Error, CreateAPILinkedAccountParams>({
    mutationFn: (params) =>
      createAPILinkedAccount(
        params.appName,
        params.linkedAccountOwnerId,
        params.linkedAPIKey,
      ),

    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(activeProject.id),
      }),
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

type CreateNoAuthLinkedAccountParams = {
  appName: string;
  linkedAccountOwnerId: string;
  description?: string;
};

export const useCreateNoAuthLinkedAccount = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<LinkedAccount, Error, CreateNoAuthLinkedAccountParams>({
    mutationFn: (params) =>
      createNoAuthLinkedAccount(params.appName, params.linkedAccountOwnerId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(activeProject.id),
      }),
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
type GetOauth2LinkURLParams = {
  appName: string;
  linkedAccountOwnerId: string;
  description?: string;
  afterOAuth2LinkRedirectURL?: string;
};

export const useGetOauth2LinkURL = () => {
  return useMutation<string, Error, GetOauth2LinkURLParams>({
    mutationFn: (params) =>
      getOauth2LinkURL(
        params.appName,
        params.linkedAccountOwnerId,
        params.afterOAuth2LinkRedirectURL,
      ),
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

type DeleteLinkedAccountParams = {
  linkedAccountId: string;
};

export const useDeleteLinkedAccount = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<void, Error, DeleteLinkedAccountParams>({
    mutationFn: (params) => deleteLinkedAccount(params.linkedAccountId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(activeProject.id),
      }),
  });
};

type UpdateLinkedAccountParams = {
  linkedAccountId: string;
  enabled: boolean;
  description?: string;
};

export const useUpdateLinkedAccount = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<LinkedAccount, Error, UpdateLinkedAccountParams>({
    mutationFn: (params) =>
      updateLinkedAccount(
        params.linkedAccountId,
        params.enabled,
        params.description,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(activeProject.id),
      }),
  });
};

export const useLinkedAccountByOwnerId = (
  linkedAccountOwnerId?: string | null,
  appName?: string | null,
) => {
  const { activeProject } = useMetaInfo();

  return useQuery<LinkedAccount | null, Error>({
    queryKey: linkedAccountKeys.getByOwnerId(
      activeProject.id,
      linkedAccountOwnerId!,
      appName!,
    ),
    queryFn: () => getLinkedAccountByOwnerId(linkedAccountOwnerId!, appName!),
    enabled: !!linkedAccountOwnerId && !!appName,
  });
};
