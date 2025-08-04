import { App } from "@/lib/types/app";
import { AppFunction } from "@/lib/types/appfunction";
import axiosInstance from "@/lib/axios";
import { Paged, PaginationParams } from "./common";

export interface BasicFunctionDefinition {
  name: string;
  description: string;
  tags: string[] | null;
  display_name: string;
}

export interface AppSearch extends PaginationParams {
  search?: string;
  categories?: string[];
}

export async function getAllApps(appNames?: string[]): Promise<App[]> {
  const response = await axiosInstance.get("/v1/apps", {
    params: {
      app_names: appNames,
    },
  });
  return response.data;
}

export async function searchApps(params: AppSearch): Promise<Paged<App>> {
  const response = await axiosInstance.get("/v1/apps/search", { params });
  return response.data;
}

export async function getAllCategories(): Promise<string[]> {
  const response = await axiosInstance.get<string[]>("/v1/apps/categories");
  return response.data;
}

export async function getApps(appNames: string[]): Promise<App[]> {
  const params = new URLSearchParams();
  appNames.forEach((name) => {
    params.append("app_names", name);
  });

  const response = await axiosInstance.get(`/v1/apps?${params.toString()}`);
  return response.data;
}

export async function getApp(appName: string): Promise<App | null> {
  const response = await axiosInstance.get<App>(`/v1/apps/${appName}`);
  return response.data;
}

export async function getAppFunctions(
  appName: string,
  raw: boolean,
): Promise<BasicFunctionDefinition[] | AppFunction[]> {
  const response = await axiosInstance.get(
    `/v1/apps/${appName}/functions?raw=${raw}`,
  );
  return response.data;
}
