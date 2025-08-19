"use client";

import { Badge } from "@/components/ui/badge";
import { LinkedAccount } from "@/lib/types/linkedaccount";
import { formatToLocalTime } from "@/utils/time";
import { AppItemDisplay } from "../apps/app-item-display";

interface LinkedAccountOverviewProps {
  linkedAccount: LinkedAccount;
}

export function LinkedAccountOverview({ 
  linkedAccount
}: LinkedAccountOverviewProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Account Owner ID
          </label>
          <div className="mt-1">
            {linkedAccount.linked_account_owner_id}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            App
          </label>
          <div className="mt-1">
            <AppItemDisplay appName={linkedAccount.app_name} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Security Scheme
          </label>
          <div className="mt-1">
            <Badge variant="outline" className="text-xs">
              {linkedAccount.security_scheme}
            </Badge>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Status
          </label>
          <div className="mt-1">
            <Badge variant={linkedAccount.enabled ? "default" : "secondary"}>
              {linkedAccount.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Created At
          </label>
          <div className="mt-1">
            {formatToLocalTime(linkedAccount.created_at)}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Updated At
          </label>
          <div className="mt-1">
            {formatToLocalTime(linkedAccount.updated_at)}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Last Used At
          </label>
          <div className="mt-1">
            {linkedAccount.last_used_at
              ? formatToLocalTime(linkedAccount.last_used_at)
              : "Never"}
          </div>
        </div>
      </div>
    </div>
  );
}
