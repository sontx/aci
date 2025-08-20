import { LinkedAccount } from "@/lib/types/linkedaccount";
import axiosInstance from "@/lib/axios";
import { AxiosError } from "axios";

export async function getAllLinkedAccounts(): Promise<LinkedAccount[]> {
  const response = await axiosInstance.get("/v1/linked-accounts");
  return response.data;
}

export async function getLinkedAccount(
  linkedAccountId: string,
): Promise<LinkedAccount> {
  const response = await axiosInstance.get(
    `/v1/linked-accounts/${linkedAccountId}`,
  );
  return response.data;
}

export async function getAppLinkedAccounts(
  appName: string,
): Promise<LinkedAccount[]> {
  const params = new URLSearchParams();
  params.append("app_name", appName);

  const response = await axiosInstance.get(
    `/v1/linked-accounts?${params.toString()}`,
  );
  return response.data;
}

export async function createAPILinkedAccount(
  appName: string,
  linkedAccountOwnerId: string,
  linkedAPIKey: string,
  description?: string,
): Promise<LinkedAccount> {
  try {
    const requestBody: {
      app_name: string;
      linked_account_owner_id: string;
      api_key: string;
      description?: string;
    } = {
      app_name: appName,
      linked_account_owner_id: linkedAccountOwnerId,
      api_key: linkedAPIKey,
    };

    if (description) {
      requestBody.description = description;
    }

    const response = await axiosInstance.post(
      "/v1/linked-accounts/api-key",
      requestBody,
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
}

export async function createNoAuthLinkedAccount(
  appName: string,
  linkedAccountOwnerId: string,
  description?: string,
): Promise<LinkedAccount> {
  try {
    const requestBody: {
      app_name: string;
      linked_account_owner_id: string;
      description?: string;
    } = {
      app_name: appName,
      linked_account_owner_id: linkedAccountOwnerId,
    };

    if (description) {
      requestBody.description = description;
    }

    const response = await axiosInstance.post(
      "/v1/linked-accounts/no-auth",
      requestBody,
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
}

export async function getOauth2LinkURL(
  appName: string,
  linkedAccountOwnerId: string,
  afterOAuth2LinkRedirectURL?: string,
): Promise<string> {
  const params = new URLSearchParams();
  params.append("app_name", appName);
  params.append("linked_account_owner_id", linkedAccountOwnerId);
  if (afterOAuth2LinkRedirectURL) {
    params.append("after_oauth2_link_redirect_url", afterOAuth2LinkRedirectURL);
  }

  try {
    const response = await axiosInstance.get(
      `/v1/linked-accounts/oauth2?${params.toString()}`,
    );

    if (!response.data.url || typeof response.data.url !== "string") {
      throw new Error("Invalid response: missing or invalid URL");
    }
    return response.data.url;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
}

export async function deleteLinkedAccount(
  linkedAccountId: string,
): Promise<void> {
  await axiosInstance.delete(`/v1/linked-accounts/${linkedAccountId}`);
}

export async function updateLinkedAccount(
  linkedAccountId: string,
  enabled: boolean,
  description?: string,
): Promise<LinkedAccount> {
  const requestBody: {
    enabled: boolean;
    description?: string;
  } = {
    enabled,
  };

  if (description !== undefined) {
    requestBody.description = description;
  }

  const response = await axiosInstance.patch(
    `/v1/linked-accounts/${linkedAccountId}`,
    requestBody,
  );

  return response.data;
}

export async function getLinkedAccountByOwnerId(
  linkedAccountOwnerId: string,
  appName: string,
): Promise<LinkedAccount | null> {
  const response = await axiosInstance.get(
    "/v1/linked-accounts/get-by-owner-id",
    {
      params: {
        owner_id: linkedAccountOwnerId,
        app_name: appName,
      },
    },
  );
  return response.data;
}
