import {
  ExecutionDetail,
  ExecutionLog,
  LogSearchParams,
  LogSearchResponse,
} from "@/lib/types/log";
import axiosInstance from "@/lib/axios";
import { Paged } from "./common";

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

export type ExecutionLogWithDetail = ExecutionLog & ExecutionDetail;

export interface ExecutionLogSearchParams {
  start_time?: string;
  end_time?: string;
  app_name?: string;
  function_name?: string;
  limit?: number;
  offset?: number;
}

export async function getExecutionLogs(
  params: ExecutionLogSearchParams,
): Promise<Paged<ExecutionLog>> {
  const response = await axiosInstance.get('/v1/execution-logs', {
    params,
  });
  return response.data;
}

export async function getExecutionLogDetail(
  logId: string,
): Promise<ExecutionLogWithDetail> {
  const response = await axiosInstance.get(`/v1/execution-logs/${logId}`);
  return response.data;
}
