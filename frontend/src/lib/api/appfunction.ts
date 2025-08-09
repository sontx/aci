import {
  AppFunction,
  FunctionExecute,
  FunctionExecutionResult,
  FunctionsSearchParams,
} from "@/lib/types/appfunction";
import axiosInstance from "@/lib/axios";
import { AxiosError } from "axios";

export async function executeFunction(
  functionName: string,
  body: FunctionExecute,
): Promise<FunctionExecutionResult> {
  try {
    const response = await axiosInstance.post(
      `/v1/functions/${functionName}/execute`,
      body,
    );

    return response.data;
  } catch (error) {
    return {
      success: false,
      data: {},
      error:
        error instanceof AxiosError
          ? error.response?.data?.error || error.message
          : String(error),
    };
  }
}

export async function searchFunctions(
  params: FunctionsSearchParams,
): Promise<AppFunction[]> {
  const searchParams = new URLSearchParams();

  if (params.app_names?.length) {
    params.app_names.forEach((name) => searchParams.append("app_names", name));
  }
  if (params.intent) {
    searchParams.append("intent", params.intent);
  }
  if (params.allowed_apps_only) {
    searchParams.append("allowed_apps_only", "true");
  }
  if (params.format) {
    searchParams.append("format", params.format);
  }
  if (params.limit) {
    searchParams.append("limit", params.limit.toString());
  }
  if (params.offset) {
    searchParams.append("offset", params.offset.toString());
  }

  const response = await axiosInstance.get(
    `/v1/functions/search?${searchParams.toString()}`,
  );

  return response.data;
}

export async function getAppFunction(name: string): Promise<AppFunction> {
  const response = await axiosInstance.get(`/v1/functions/${name}/definition`, {
    params: {
      format: "raw",
    },
  });

  return response.data;
}
