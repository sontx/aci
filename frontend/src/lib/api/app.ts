import { App } from "@/lib/types/app";
import { AppFunction } from "@/lib/types/appfunction";

export interface BasicFunctionDefinition {
  name: string;
  description: string;
  tags: string[] | null;
  display_name: string;
}

export async function getAllApps(apiKey: string): Promise<App[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/apps`, {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch app: ${response.status} ${response.statusText}`,
    );
  }

  const apps = await response.json();
  return apps;
}

export async function getApps(
  appNames: string[],
  apiKey: string,
): Promise<App[]> {
  const params = new URLSearchParams();
  appNames.forEach((name) => {
    params.append("app_names", name);
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/apps?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch app`);
  }

  const apps = await response.json();
  return apps;
}

export async function getApp(
  appName: string,
  apiKey: string,
): Promise<App | null> {
  const apps = await getApps([appName], apiKey);
  return apps.length > 0 ? apps[0] : null;
}

export async function getAppFunctions(
  appName: string,
  raw: boolean,
  apiKey: string,
): Promise<BasicFunctionDefinition[] | AppFunction[]> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/apps/${appName}/functions?raw=${raw}`,
    {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch app functions: ${response.status} ${response.statusText}`,
    );
  }

  const functions = await response.json();
  return functions;
}
