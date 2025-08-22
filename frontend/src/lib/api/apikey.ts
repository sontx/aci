import { APIKey, APIKeyDetail, APIKeyCreate, APIKeyUpdate, APIKeysPagedResult, APIKeySearchParams } from "@/lib/types/apikey";
import axiosInstance from "@/lib/axios";
import { AxiosError } from "axios";

export async function getAPIKeys(params?: APIKeySearchParams): Promise<APIKeysPagedResult> {
  try {
    const searchParams = new URLSearchParams();
    
    if (params?.limit) {
      searchParams.append("limit", params.limit.toString());
    }
    if (params?.offset) {
      searchParams.append("offset", params.offset.toString());
    }

    const response = await axiosInstance.get(`/v1/api-keys?${searchParams.toString()}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
}

export async function getAPIKeyByName(apiKeyName: string): Promise<APIKeyDetail> {
  try {
    const response = await axiosInstance.get(`/v1/api-keys/${apiKeyName}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
}

export async function createAPIKey(data: APIKeyCreate): Promise<APIKeyDetail> {
  try {
    const response = await axiosInstance.post("/v1/api-keys", data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
}

export async function updateAPIKey(apiKeyName: string, data: APIKeyUpdate): Promise<APIKey> {
  try {
    const response = await axiosInstance.patch(`/v1/api-keys/${apiKeyName}`, data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
}

export async function deleteAPIKey(apiKeyName: string): Promise<void> {
  try {
    await axiosInstance.delete(`/v1/api-keys/${apiKeyName}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw error;
  }
}
