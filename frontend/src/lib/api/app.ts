import { App } from "@/lib/types/app";
import { AppFunction } from "@/lib/types/appfunction";
import axiosInstance from "@/lib/axios";

export interface BasicFunctionDefinition {
  name: string;
  description: string;
  tags: string[] | null;
  display_name: string;
}

export async function getAllApps(): Promise<App[]> {
  const response = await axiosInstance.get('/v1/apps');
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
  const apps = await getApps([appName]);
  return apps.length > 0 ? apps[0] : null;
}

export async function getAppFunctions(
  appName: string,
  raw: boolean,
): Promise<BasicFunctionDefinition[] | AppFunction[]> {
  const response = await axiosInstance.get(
    `/v1/apps/${appName}/functions?raw=${raw}`
  );
  return response.data;
}
