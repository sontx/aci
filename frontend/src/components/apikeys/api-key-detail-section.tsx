"use client";

import { Badge } from "@/components/ui/badge";
import { APIKeyDetail } from "@/lib/types/apikey";
import { formatToLocalTime } from "@/utils/time";

interface APIKeyDetailSectionProps {
  apiKey: APIKeyDetail;
}

export function APIKeyDetailSection({ apiKey }: APIKeyDetailSectionProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "disabled":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Name
          </label>
          <div className="mt-1 text-sm">{apiKey.name}</div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Status
          </label>
          <div className="mt-1">
            <Badge
              variant={getStatusVariant(apiKey.status)}
              className="capitalize"
            >
              {apiKey.status}
            </Badge>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Created
          </label>
          <div className="mt-1 text-sm">
            {formatToLocalTime(apiKey.created_at)}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Updated
          </label>
          <div className="mt-1 text-sm">
            {formatToLocalTime(apiKey.updated_at)}
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground">
          API Key
        </label>
        <div className="mt-1 space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded-md font-mono text-sm">
              {apiKey.key}${"*".repeat(30)}
            </code>
          </div>
          <p className="text-sm text-muted-foreground">
            API key is shown only once. Use it in your application headers as{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              X-API-KEY: &lt;your-api-key&gt;
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
