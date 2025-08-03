"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  getAllLinkedAccounts,
  createAPILinkedAccount,
  createNoAuthLinkedAccount,
  deleteLinkedAccount,
  updateLinkedAccount,
  getOauth2LinkURL,
} from "@/lib/api/linkedaccount";
import { LinkedAccount } from "@/lib/types/linkedaccount";
import { toast } from "sonner";
import { useMetaInfo } from "@/components/context/metainfo";

export const linkedAccountKeys = {
  all: (projectId: string) => [projectId, "linkedaccounts"] as const,
};

export const useLinkedAccounts = () => {
  const { activeProject } = useMetaInfo();

  return useQuery<LinkedAccount[], Error>({
    queryKey: linkedAccountKeys.all(activeProject.id),
    queryFn: () => getAllLinkedAccounts(),
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
};

export const useCreateNoAuthLinkedAccount = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<LinkedAccount, Error, CreateNoAuthLinkedAccountParams>({
    mutationFn: (params) =>
      createNoAuthLinkedAccount(
        params.appName,
        params.linkedAccountOwnerId,
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
type GetOauth2LinkURLParams = {
  appName: string;
  linkedAccountOwnerId: string;
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
};

export const useUpdateLinkedAccount = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<LinkedAccount, Error, UpdateLinkedAccountParams>({
    mutationFn: (params) =>
      updateLinkedAccount(params.linkedAccountId, params.enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(activeProject.id),
      }),
  });
};
