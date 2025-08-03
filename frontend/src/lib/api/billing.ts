import { Interval, Subscription } from "@/lib/types/billing";
import axiosInstance from "@/lib/axios";

export async function getSubscription(): Promise<Subscription> {
  const response = await axiosInstance.get("/v1/billing/get-subscription");
  return response.data;
}

export async function createCheckoutSession(
  planName: string,
  interval: Interval,
): Promise<string> {
  const response = await axiosInstance.post(
    "/v1/billing/create-checkout-session",
    {
      plan_name: planName,
      interval,
    },
  );
  return response.data;
}

export async function createCustomerPortalSession(): Promise<string> {
  const response = await axiosInstance.post(
    "/v1/billing/create-customer-portal-session",
  );
  return response.data;
}
