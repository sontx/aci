import {
  DistributionDatapoint,
  TimeSeriesDatapoint,
} from "@/lib/types/analytics";
import axiosInstance from "@/lib/axios";

export async function getAppDistributionData(): Promise<DistributionDatapoint[]> {
  const response = await axiosInstance.get('/v1/analytics/app-usage-distribution');
  return response.data;
}

export async function getFunctionDistributionData(): Promise<DistributionDatapoint[]> {
  const response = await axiosInstance.get('/v1/analytics/function-usage-distribution');
  return response.data;
}

export async function getAppTimeSeriesData(): Promise<TimeSeriesDatapoint[]> {
  const response = await axiosInstance.get('/v1/analytics/app-usage-timeseries');
  return response.data;
}

export async function getFunctionTimeSeriesData(): Promise<TimeSeriesDatapoint[]> {
  const response = await axiosInstance.get('/v1/analytics/function-usage-timeseries');
  return response.data;
}
