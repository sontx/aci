"use client";

import { QuotaUsageDisplay } from "@/components/quota/quota-usage-display";
import { Separator } from "@/components/ui/separator";
import { useQuota } from "@/hooks/use-quota";
import { Badge } from "@/components/ui/badge";

export default function UsagePage() {
  const {
    data: quotaUsage,
    isLoading: isQuotaLoading,
    error: quotaError,
  } = useQuota();

  return (
    <div>
      <div className="m-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quota Usage</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{quotaUsage?.plan.name} Plan</Badge>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-6 p-6">
        {/* Quota Usage Section - Independent Loading */}
        <div className="w-full">
          {quotaError ? (
            <div className="p-4 text-red-500">
              Failed to load quota data. Please try again later.
            </div>
          ) : isQuotaLoading ? (
            <div className="p-4">Loading quota data...</div>
          ) : quotaUsage ? (
            <QuotaUsageDisplay quotaUsage={quotaUsage} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
