import { LogSearchParams, LogSearchResponse } from "@/lib/types/log";
import axiosInstance from "@/lib/axios";

export async function searchFunctionExecutionLogs(
  params: LogSearchParams = {},
): Promise<LogSearchResponse> {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      queryParams.set(key, value.toString());
    }
  }

  // Note: This uses the Next.js API route instead of direct API call
  // If you want to use the direct API endpoint, change this to use axiosInstance
  const response = await axiosInstance.get(
    `/api/logs?${queryParams.toString()}`,
  );
  return response.data;
}
