import { AppConfig } from "@/lib/types/appconfig";
import axiosInstance from "@/lib/axios";
import { AxiosError } from "axios";

export async function getAppConfig(appName: string): Promise<AppConfig | null> {
  const params = new URLSearchParams();
  params.append("app_names", appName);

  const response = await axiosInstance.get(
    `/v1/app-configurations?${params.toString()}`
  );

  const configs = response.data;
  return configs.length > 0 ? configs[0] : null;
}

export async function getAllAppConfigs(): Promise<AppConfig[]> {
  const response = await axiosInstance.get('/v1/app-configurations');
  return response.data;
}

export class AppAlreadyConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppAlreadyConfiguredError";
    Object.setPrototypeOf(this, new.target.prototype); // Restore prototype chain
  }
}

export async function createAppConfig(
  appName: string,
  security_scheme: string,
  security_scheme_overrides?: {
    oauth2?: {
      client_id: string;
      client_secret: string;
      redirect_url?: string;
    } | null;
  },
): Promise<AppConfig> {
  try {
    const response = await axiosInstance.post('/v1/app-configurations', {
      app_name: appName,
      security_scheme: security_scheme,
      security_scheme_overrides: security_scheme_overrides ?? {},
      all_functions_enabled: true,
      enabled_functions: [],
    });

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 409) {
      throw new AppAlreadyConfiguredError(
        `App configuration already exists for app: ${appName}`,
      );
    }
    throw error;
  }
}

export async function updateAppConfig(
  appName: string,
  enabled: boolean,
): Promise<AppConfig> {
  const response = await axiosInstance.patch(
    `/v1/app-configurations/${appName}`,
    {
      enabled: enabled,
    }
  );

  return response.data;
}

export async function deleteAppConfig(appName: string): Promise<void> {
  await axiosInstance.delete(`/v1/app-configurations/${appName}`);
}
