import { QuotaUsage } from "@/lib/types/quota";
import axiosInstance from "@/lib/axios";

export async function getQuotaUsage(): Promise<QuotaUsage> {
  const response = await axiosInstance.get("/v1/billing/quota-usage");
  return response.data;
}
